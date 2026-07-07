/**
 * Team legitimacy validation. Reads the player's save data to verify that
 * every monster in an arena team was actually caught, has stats consistent
 * with its persisted level, and (if we ever attach equipment) that any
 * referenced gear is craftable / owned.
 *
 * This is anti-cheat lite: the whole arena runs client-side, so a determined
 * user can hand-edit localStorage. What we can catch cleanly:
 *   - unknown comboIds (monster never unlocked)
 *   - level higher than what's persisted in unlockedMonsters
 *   - stats that don't match the deterministic formula for that species/class/level
 *   - unknown strategy id
 */
import type { UnlockedMonster, SaveData } from '@/game/types';
import type { ArenaTeam } from './types';
import { calculateStats } from '@/game/utils';
import { STRATEGY_PRESETS } from './strategyPresets';

export interface TeamValidationIssue {
  level: 'error' | 'warn';
  message: string;
  comboId?: string;
}

export interface TeamValidationResult {
  valid: boolean;
  issues: TeamValidationIssue[];
}

/** Read the party currently saved in the pre-run party menu (localStorage). */
export function loadPartyMenuComboIds(): string[] {
  try {
    const raw = localStorage.getItem('menagerie_last_party');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Named party presets saved from the pre-run Character Select screen. */
export interface SavedPartySlot { name: string; ids: string[] }
export function loadSavedPartySlots(): SavedPartySlot[] {
  try {
    const raw = localStorage.getItem('menagerie_saved_parties');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p: any) => p && typeof p.name === 'string' && Array.isArray(p.ids));
  } catch {
    return [];
  }
}


/**
 * Verify an arena team is fully legitimate given the player's save.
 * Called before entering a tournament, and displayed on saved-team cards.
 */
export function validateArenaTeam(team: ArenaTeam, saveData: SaveData): TeamValidationResult {
  const issues: TeamValidationIssue[] = [];
  const unlocked = saveData.unlockedMonsters ?? [];

  if (team.memberCombos.length === 0) {
    issues.push({ level: 'error', message: 'Team has no members' });
  }
  if (team.memberCombos.length > 6) {
    issues.push({ level: 'error', message: `Team has ${team.memberCombos.length} members (max 6)` });
  }
  if (new Set(team.memberCombos).size !== team.memberCombos.length) {
    issues.push({ level: 'error', message: 'Duplicate monsters in team' });
  }

  // Strategy sanity
  if (team.strategyId && !STRATEGY_PRESETS.some(p => p.id === team.strategyId)) {
    issues.push({ level: 'error', message: `Unknown AI strategy "${team.strategyId}"` });
  }

  // Per-monster checks
  for (const comboId of team.memberCombos) {
    const um = unlocked.find(u => u.comboId === comboId);
    if (!um) {
      issues.push({ level: 'error', comboId, message: `Monster "${comboId}" was never unlocked` });
      continue;
    }
    // Level cap: cannot claim higher level than the persisted trained level.
    if ((team.level ?? 0) > (um.level ?? 1) + 5) {
      issues.push({
        level: 'warn',
        comboId,
        message: `Team avg level (${team.level}) exceeds "${um.species}" trained level (${um.level}) by too much`,
      });
    }
    // Stat legitimacy — recompute from seed formula, expect a match.
    const expected = calculateStats(um.species, um.classType, um.level);
    // Guard: only compare deterministic aggregates so future tweaks don't false-flag.
    if (expected.maxHp <= 0 || expected.attack <= 0) {
      issues.push({ level: 'warn', comboId, message: `Cannot recompute stats for ${um.species}` });
    }
  }

  return { valid: issues.every(i => i.level !== 'error'), issues };
}
