// Party Analyzer — surfaces composition gaps and suggests counter-picks
// for the active dungeon's theme (element / class / species / all).
//
// Rules applied:
//  • Elemental counters: element E is countered by elements that list E in
//    ELEMENT_ADVANTAGES (e.g. Fire tower -> Water + Void are strong vs Fire).
//  • Class counters: same shape against CLASS_ADVANTAGES_CORRECTED.
//  • Species towers: no direct elemental counter (mixed theme inside), so
//    we just surface the highest-level monsters that diversify coverage.
//  • Home / "all" tower: encourage broad element + class spread; flag
//    completely missing class/element buckets.
// Suggestions are sorted by level descending (per the todo).

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MonsterSprite } from '@/game/sprites';

import {
  UnlockedMonster,
  DungeonEntrance,
  DungeonTheme,
  ElementType,
  ClassType,
  ELEMENT_ADVANTAGES,
  CLASS_ADVANTAGES_CORRECTED,
} from '@/game/types';

interface PartyAnalyzerProps {
  party: UnlockedMonster[];
  pool: UnlockedMonster[];
  entrance?: DungeonEntrance;
  onSuggest: (m: UnlockedMonster) => void;
}

// Which elements / classes counter a given themed value.
function elementsThatCounter(target: ElementType): ElementType[] {
  return (Object.entries(ELEMENT_ADVANTAGES) as [ElementType, ElementType[]][])
    .filter(([, beats]) => beats.includes(target))
    .map(([el]) => el);
}
function classesThatCounter(target: ClassType): ClassType[] {
  return (Object.entries(CLASS_ADVANTAGES_CORRECTED) as [ClassType, ClassType[]][])
    .filter(([, beats]) => beats.includes(target))
    .map(([c]) => c);
}

function themeLabel(theme?: DungeonTheme): string {
  if (!theme || theme.kind === 'all') return 'Mixed (no theme)';
  return `${theme.kind}: ${theme.value}`;
}

const DEDUPE_STORAGE_KEY = 'partyAnalyzerDedupe';

interface DedupeOptions {
  species: boolean;
  element: boolean;
  classType: boolean;
}

const DEFAULT_DEDUPE: DedupeOptions = { species: true, element: false, classType: false };

export function PartyAnalyzer({ party, pool, entrance, onSuggest }: PartyAnalyzerProps) {
  const theme = entrance?.theme;

  // Player-controlled diversity filters — persisted so the preference sticks.
  const [dedupe, setDedupe] = useState<DedupeOptions>(() => {
    try {
      const raw = localStorage.getItem(DEDUPE_STORAGE_KEY);
      if (raw) return { ...DEFAULT_DEDUPE, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_DEDUPE;
  });
  useEffect(() => {
    try { localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(dedupe)); } catch { /* ignore */ }
  }, [dedupe]);

  const analysis = useMemo(() => {
    const partyIds = new Set(party.map(m => m.comboId));
    const available = pool.filter(m => !partyIds.has(m.comboId));


    const partyElements = new Set(party.map(m => m.element));
    const partyClasses = new Set(party.map(m => m.classType));

    let counterElements: ElementType[] = [];
    let counterClasses: ClassType[] = [];
    let warnings: string[] = [];

    if (theme?.kind === 'element' && theme.value) {
      const t = theme.value as ElementType;
      counterElements = elementsThatCounter(t);
      const hasCounter = party.some(m => counterElements.includes(m.element));
      if (!hasCounter && counterElements.length > 0) {
        warnings.push(`No counter to ${t}. Bring ${counterElements.join(' or ')}.`);
      }
      if (party.some(m => ELEMENT_ADVANTAGES[t].includes(m.element))) {
        warnings.push(`Some party members are weak to ${t}.`);
      }
    } else if (theme?.kind === 'class' && theme.value) {
      const t = theme.value as ClassType;
      counterClasses = classesThatCounter(t);
      const hasCounter = party.some(m => counterClasses.includes(m.classType));
      if (!hasCounter && counterClasses.length > 0) {
        warnings.push(`No counter to ${t}. Bring ${counterClasses.join(' or ')}.`);
      }
      if (party.some(m => CLASS_ADVANTAGES_CORRECTED[t].includes(m.classType))) {
        warnings.push(`Some party members are weak to ${t}.`);
      }
    } else if (theme?.kind === 'species' && theme.value) {
      warnings.push(`Single-species tower — bring varied elements & classes for safe coverage.`);
    } else {
      // Mixed / home: ensure spread.
      const missingEls = (['fire','water','earth','air','void'] as ElementType[])
        .filter(e => !partyElements.has(e));
      const missingCls = (['kinetic','energy','biological','chemical','political'] as ClassType[])
        .filter(c => !partyClasses.has(c));
      if (party.length >= 4 && missingEls.length >= 4) {
        warnings.push(`Low element diversity — missing ${missingEls.join(', ')}.`);
      }
      if (party.length >= 4 && missingCls.length >= 4) {
        warnings.push(`Low class diversity — missing ${missingCls.join(', ')}.`);
      }
    }

    // Raw combat power: species base stats grown by the standard 1.1x/level
    // curve, plus a rough contribution from persisted equipment. Logged so a
    // hyper-levelled pick can't completely drown out matchup value.
    const powerOf = (m: UnlockedMonster) => {
      const base = SPECIES_DATA[m.species]?.baseStats;
      const statSum = base
        ? base.hp * 0.5 + base.attack + base.defense + base.speed + base.special
        : 30;
      const growth = Math.pow(1.1, Math.max(0, m.level - 1));
      let gear = 0;
      const eq = m.equipment as Record<string, { stats?: Record<string, number> }> | undefined;
      if (eq) {
        for (const item of Object.values(eq)) {
          if (!item || typeof item !== 'object') continue;
          for (const v of Object.values(item.stats ?? {})) {
            if (typeof v === 'number') gear += v;
          }
        }
      }
      return statSum * growth + gear;
    };

    // Normalize power into a 0..6 bonus relative to the strongest candidate so
    // it competes with matchup bonuses instead of dominating or being ignored.
    const powers = new Map(available.map(m => [m.comboId, powerOf(m)]));
    const maxPower = Math.max(1, ...powers.values());

    // Score candidates: counter-element +3, counter-class +3, fills missing
    // element/class bucket +1 each, plus up to +6 for raw strength.
    const scored = available.map(m => {
      let matchup = 0;
      if (counterElements.includes(m.element)) matchup += 3;
      if (counterClasses.includes(m.classType)) matchup += 3;
      if (!partyElements.has(m.element)) matchup += 1;
      if (!partyClasses.has(m.classType)) matchup += 1;
      const power = powers.get(m.comboId) ?? 0;
      const powerScore = 6 * (Math.log10(1 + power) / Math.log10(1 + maxPower));
      return { m, matchup, power, score: matchup + powerScore };
    });
    scored.sort((a, b) => (b.score - a.score) || (b.power - a.power) || (b.m.level - a.m.level));

    // Diversity filters. Two levels of strictness: "party" also excludes traits
    // already on the field, "list" only guarantees the six shown picks differ
    // from each other. Species uniqueness inside the list is never relaxed
    // while the checkbox is on.
    const usedSpecies = new Set(party.map(m => m.species));
    const usedElements = new Set(partyElements);
    const usedClasses = new Set(partyClasses);
    const listSpecies = new Set<string>();
    const listElements = new Set<string>();
    const listClasses = new Set<string>();

    const TARGET = 6;
    const suggestions: UnlockedMonster[] = [];
    const chosen = new Set<string>();

    const passes: Array<{ minMatchup: number; scope: 'party' | 'list' | 'none' }> = [
      { minMatchup: 1, scope: 'party' },
      { minMatchup: 0, scope: 'party' },
      { minMatchup: 0, scope: 'list' },
      { minMatchup: 0, scope: 'none' },
    ];
    for (const pass of passes) {
      for (const { m, matchup } of scored) {
        if (suggestions.length >= TARGET) break;
        if (chosen.has(m.comboId)) continue;
        if (matchup < pass.minMatchup) continue;
        if (pass.scope !== 'none') {
          const strict = pass.scope === 'party';
          if (dedupe.species && (listSpecies.has(m.species) || (strict && usedSpecies.has(m.species)))) continue;
          if (dedupe.element && (listElements.has(m.element) || (strict && usedElements.has(m.element)))) continue;
          if (dedupe.classType && (listClasses.has(m.classType) || (strict && usedClasses.has(m.classType)))) continue;
        }
        suggestions.push(m);
        chosen.add(m.comboId);
        listSpecies.add(m.species);
        listElements.add(m.element);
        listClasses.add(m.classType);
        usedSpecies.add(m.species);
        usedElements.add(m.element);
        usedClasses.add(m.classType);
      }
      if (suggestions.length >= TARGET) break;
    }

    const filteredOut = 0;



    return { warnings, suggestions, counterElements, counterClasses, filteredOut };
  }, [party, pool, theme, dedupe]);


  if (pool.length === 0) return null;

  const themeStr = themeLabel(theme);

  return (
    <Card className="p-3 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            🧠 Party Analyzer
            <span className="text-[10px] font-normal text-muted-foreground">
              vs {entrance?.name || 'Run'} · {themeStr}
            </span>
          </h3>
          {analysis.counterElements.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Recommended elements: <span className="text-primary font-medium">{analysis.counterElements.join(', ')}</span>
            </p>
          )}
          {analysis.counterClasses.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Recommended classes: <span className="text-primary font-medium">{analysis.counterClasses.join(', ')}</span>
            </p>
          )}
          {analysis.warnings.length === 0 ? (
            <p className="text-[11px] text-green-600 mt-1">✓ Party looks well-suited for this run.</p>
          ) : (
            <ul className="text-[11px] text-amber-600 mt-1 space-y-0.5">
              {analysis.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
            </ul>
          )}
        </div>

        <div className="flex-1 min-w-[220px]">
          <p className="text-[11px] text-muted-foreground mb-1">Avoid duplicates in suggestions:</p>
          <div className="flex gap-3 flex-wrap mb-2">
            {([
              ['species', 'Species'],
              ['element', 'Elements'],
              ['classType', 'Classes'],
            ] as [keyof DedupeOptions, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                <Checkbox
                  checked={dedupe[key]}
                  onCheckedChange={(v) => setDedupe(prev => ({ ...prev, [key]: v === true }))}
                  aria-label={`Avoid duplicate ${label.toLowerCase()}`}
                />
                {label}
              </label>
            ))}
          </div>

          {analysis.suggestions.length > 0 ? (
            <>
              <p className="text-[11px] text-muted-foreground mb-1">Suggested picks (click to add):</p>
              <div className="flex gap-1.5 flex-wrap">
                {analysis.suggestions.map(m => (
                  <Button
                    key={m.comboId}
                    variant="outline"
                    size="sm"
                    className="h-auto py-1 px-2 flex items-center gap-1.5"
                    onClick={() => onSuggest(m)}
                    title={`${m.species} · ${m.element} · ${m.classType} · Lv.${m.level}`}
                  >
                    <MonsterSprite
                      species={m.species}
                      element={m.element}
                      classType={m.classType}
                      size={22}
                      animated={false}
                    />
                    <span className="text-[10px] leading-tight text-left">
                      <span className="block capitalize font-medium">{m.species}</span>
                      <span className="block text-muted-foreground">Lv.{m.level}</span>
                    </span>
                  </Button>
                ))}
              </div>
              {analysis.filteredOut > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {analysis.filteredOut} duplicate pick{analysis.filteredOut === 1 ? '' : 's'} hidden by these filters.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No suggestions match these filters — uncheck one to widen the search.
            </p>
          )}
        </div>
      </div>

    </Card>
  );
}
