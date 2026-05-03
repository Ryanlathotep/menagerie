// Recruitment modal - shown after impressive defeats
//
// Flow:
//   1. "intro"   — show stats, chance, and an Attempt Recruit button.
//   2. Roll happens on click. On failure → onFail(), modal closes.
//      On success → "decision" step.
//   3. "decision" — choose how to onboard the recruit:
//        a) Add to party (only if party not full)
//        b) Replace a party member (always available)
//        c) Send home (store in roster, no party slot used)
//   4. "replace" — pick which party member to swap out (sent home).

import { useState, useEffect } from 'react';
import { Monster, SPECIES_DATA, ELEMENT_COLORS, UnlockedMonster } from './types';
import { MonsterSprite } from './sprites';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

const AUTO_SKIP_KEY = 'menagerie-auto-skip-useless-recruits';

interface RecruitmentModalProps {
  enemy: Monster;
  recruitChance: number;
  impressiveStats: {
    turnsUsed: number;
    overkillDamage: number;
    statusEffectsApplied: number;
    criticalHits: number;
  };
  /** Current party — used for replacement picker. Optional for backwards compat. */
  party?: Monster[];
  /** Whether party is at max capacity (6). */
  partyFull: boolean;
  /** Called when player declines or after failure cleanup. */
  onDismiss: () => void;
  /** Called when recruit succeeds AND player chose to add to the party directly. */
  onAddToParty: () => void;
  /** Called when recruit succeeds AND player chose to swap out a party member. */
  onReplaceMember: (replaceIndex: number) => void;
  /** Called when recruit succeeds AND player chose to send the recruit home (storage). */
  onSendHome: () => void;
  /** Called when the recruit roll fails. */
  onFail: () => void;
  /** Number of additional defeated enemies queued behind this one. */
  queuedRecruits?: number;
  /** Optional: skip every queued recruit at once (also dismisses current). */
  onSkipAll?: () => void;
  /** Player's full unlocked roster. Used to flag whether this combo is new
   *  and whether recruiting it would be a stat upgrade. */
  unlockedMonsters?: UnlockedMonster[];
}

type Step = 'intro' | 'decision' | 'replace';

export function RecruitmentModal({
  enemy,
  recruitChance,
  impressiveStats,
  party = [],
  partyFull,
  onDismiss,
  onAddToParty,
  onReplaceMember,
  onSendHome,
  onFail,
  queuedRecruits = 0,
  onSkipAll,
}: RecruitmentModalProps) {
  const speciesData = SPECIES_DATA[enemy.species];
  const [step, setStep] = useState<Step>('intro');

  // Visual breakdown of what made it impressive
  const impressiveFactors: { icon: string; label: string; detail: string }[] = [];
  if (impressiveStats.turnsUsed <= 2) {
    impressiveFactors.push({ icon: '⚡', label: 'Quick Victory', detail: `${impressiveStats.turnsUsed} turns` });
  }
  if (impressiveStats.overkillDamage >= 20) {
    impressiveFactors.push({ icon: '💥', label: 'Overwhelming Power', detail: `+${impressiveStats.overkillDamage} overkill` });
  }
  if (impressiveStats.statusEffectsApplied >= 2) {
    impressiveFactors.push({ icon: '🌀', label: 'Status Master', detail: `${impressiveStats.statusEffectsApplied} effects` });
  }
  if (impressiveStats.criticalHits >= 2) {
    impressiveFactors.push({ icon: '✨', label: 'Critical Strikes', detail: `${impressiveStats.criticalHits} crits` });
  }

  // Attempt the recruitment roll. On success, move to decision step;
  // on failure, fire onFail and close.
  const handleAttempt = () => {
    const roll = Math.random() * 100;
    if (roll < recruitChance) {
      setStep('decision');
    } else {
      onFail();
    }
  };

  const renderHeader = (title: string, subtitle: string) => (
    <div className="text-center">
      <h2 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );

  const renderEnemyPreview = () => (
    <div className="flex items-center justify-center gap-4 py-4">
      <div className="text-center">
        <MonsterSprite
          species={enemy.species}
          element={enemy.element}
          classType={enemy.class}
          size={80}
          animated
        />
        <p className="font-bold mt-2 capitalize">{enemy.name}</p>
        <p className="text-xs text-muted-foreground">Lv.{enemy.level}</p>
        <div className="flex gap-1 justify-center mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize">
            {enemy.element}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary capitalize">
            {enemy.class}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {queuedRecruits > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              ⚔️ Multi-kill! {queuedRecruits} more recruit{queuedRecruits === 1 ? '' : 's'} waiting after this one.
            </span>
            {onSkipAll && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onSkipAll}>
                Skip all
              </Button>
            )}
          </div>
        )}
        {step === 'intro' && (
          <>
            {renderHeader('Impressive Victory!', 'The defeated monster is considering joining you!')}
            {renderEnemyPreview()}

            {/* Passive ability */}
            <div className="p-2 bg-muted/50 rounded-lg text-center">
              <p className="text-xs font-semibold text-primary">{speciesData.passiveAbility}</p>
              <p className="text-[10px] text-muted-foreground">{speciesData.passiveDescription}</p>
            </div>

            {/* Impressive factors */}
            {impressiveFactors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">What impressed them:</p>
                <div className="flex flex-wrap gap-2">
                  {impressiveFactors.map((factor, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-xs"
                    >
                      <span>{factor.icon}</span>
                      <span className="font-medium">{factor.label}</span>
                      <span className="text-muted-foreground">({factor.detail})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recruitment chance */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Recruitment Chance</span>
                <span className={`font-bold ${
                  recruitChance >= 70 ? 'text-green-500' :
                  recruitChance >= 40 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {Math.round(recruitChance)}%
                </span>
              </div>
              <Progress value={recruitChance} className="h-2" />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onDismiss}>
                Leave
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500"
                onClick={handleAttempt}
              >
                🤝 Attempt Recruit
              </Button>
            </div>
          </>
        )}

        {step === 'decision' && (
          <>
            {renderHeader('🎉 Joined the Cause!', `${enemy.name} has agreed to join you. Where should they go?`)}
            {renderEnemyPreview()}

            <div className="space-y-2">
              <Button
                className="w-full bg-gradient-to-r from-emerald-500 to-green-500"
                onClick={onAddToParty}
                disabled={partyFull}
              >
                ➕ Add to Active Party {partyFull && '(Full!)'}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setStep('replace')}
                disabled={party.length === 0}
              >
                🔄 Replace a Party Member
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={onSendHome}
              >
                🏠 Send Home (Storage)
              </Button>
            </div>

            {partyFull && (
              <p className="text-[11px] text-center text-muted-foreground">
                Your party is full. Replace a member or send the recruit to storage.
              </p>
            )}
          </>
        )}

        {step === 'replace' && (
          <>
            {renderHeader('Choose Who to Send Home', 'They will be safely stored back in town with all their gear.')}

            <div className="max-h-[min(48vh,320px)] overflow-y-auto overscroll-contain pr-2 touch-pan-y [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
              <div className="space-y-2 pb-1">
                {party.map((m, idx) => {
                  const colors = ELEMENT_COLORS[m.element];
                  const hpPercent = (m.stats.currentHp / m.stats.maxHp) * 100;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onReplaceMember(idx)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full border"
                          style={{
                            backgroundColor: `hsl(${colors.primary})`,
                            borderColor: `hsl(${colors.secondary})`,
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium capitalize">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            Lv.{m.level} {m.element} {SPECIES_DATA[m.species].name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              hpPercent > 50 ? 'bg-green-500' :
                              hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(0, hpPercent)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {m.stats.currentHp}/{m.stats.maxHp} HP
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep('decision')}>
                ← Back
              </Button>
              <Button variant="outline" className="flex-1" onClick={onSendHome}>
                🏠 Send Home Instead
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// Calculate recruitment chance based on battle performance
export function calculateRecruitChance(stats: {
  turnsUsed: number;
  overkillDamage: number;
  statusEffectsApplied: number;
  criticalHits: number;
  playerHpPercent: number;
  enemyLevel: number;
  playerLevel: number;
}): number {
  let chance = 20; // Base 20% chance

  // Quick victory bonus (fewer turns = better)
  if (stats.turnsUsed <= 1) chance += 30;
  else if (stats.turnsUsed <= 2) chance += 20;
  else if (stats.turnsUsed <= 3) chance += 10;
  else if (stats.turnsUsed >= 8) chance -= 10;

  // Overkill bonus (decisive victory)
  if (stats.overkillDamage >= 50) chance += 15;
  else if (stats.overkillDamage >= 30) chance += 10;
  else if (stats.overkillDamage >= 15) chance += 5;

  // Status effect mastery
  chance += Math.min(15, stats.statusEffectsApplied * 5);

  // Critical hit bonus
  chance += Math.min(10, stats.criticalHits * 3);

  // Staying healthy bonus
  if (stats.playerHpPercent >= 90) chance += 10;
  else if (stats.playerHpPercent >= 70) chance += 5;
  else if (stats.playerHpPercent < 30) chance -= 10;

  // Level difference penalty/bonus
  const levelDiff = stats.playerLevel - stats.enemyLevel;
  if (levelDiff < 0) {
    // Fighting higher level = more impressive
    chance += Math.min(15, Math.abs(levelDiff) * 5);
  } else if (levelDiff > 2) {
    // Bullying much weaker = less impressive
    chance -= Math.min(20, levelDiff * 3);
  }

  // Clamp to reasonable range
  return Math.max(5, Math.min(95, chance));
}
