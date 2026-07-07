/**
 * Mounts a tiny debug bridge on window.__menagerie inside GameProvider.
 * Available to admins, in dev builds, and to the QA panel. The skill
 * `menagerie-smoke-test` uses this to bypass canvas-input limitations.
 */
import { useEffect } from 'react';
import { useGame } from '@/game/state';
import { runAllInvariants, summarize } from './qaInvariants';
import { buildMaxLevelSave, buildMaxLevelParty, buildTwoMaxLevelTeams } from './fixtures/maxLevelSave';
import { runAutobattle, type AutobattleOptions, type AutobattleResult } from '@/game/autobattle';

declare global {
  interface Window {
    __menagerie?: {
      getState: () => unknown;
      dispatch: (action: unknown) => void;
      snapshot: () => unknown;
      runSmokeTest: () => ReturnType<typeof runAllInvariants>;
      /** Load a fully-unlocked, max-level SaveData into the live store. Destructive — asks first via confirm(). */
      loadMaxLevelSave: () => void;
      /** Run an autobattle from the fixture (or between two arbitrary parties). Returns the result. */
      runAutobattle: (opts?: AutobattleOptions & { teamA?: unknown; teamB?: unknown }) => AutobattleResult;
      help: () => void;
    };
  }
}

export function DebugBridgeMount() {
  const { state, dispatch } = useGame();
  useEffect(() => {
    window.__menagerie = {
      getState: () => state,
      dispatch: (a) => dispatch(a as never),
      snapshot: () => {
        const party = state.run?.party ?? [];
        return {
          phase: state.phase,
          gold: state.saveData.gold,
          unlockedMonsters: state.saveData.unlockedMonsters.map(m => ({
            comboId: m.comboId,
            level: m.level,
            experience: m.experience,
            masteryUses: m.moveMastery
              ? Object.values(m.moveMastery).reduce((s, x) => s + (x?.uses ?? 0), 0)
              : 0,
            equippedSlots: m.equipment
              ? Object.values(m.equipment).filter(Boolean).length
              : 0,
          })),
          partyLevels: party.map(p => ({ id: p.id, level: p.level, xp: p.experience })),
          storedItemCount: state.saveData.storedItems?.length ?? 0,
          runInventoryCount: state.run?.inventory.length ?? 0,
        };
      },
      runSmokeTest: () => {
        const results = runAllInvariants(state);
        const s = summarize(results);
        // eslint-disable-next-line no-console
        console.log(`[Menagerie QA] ${s.pass}/${s.total} passed`, results);
        return results;
      },
      loadMaxLevelSave: () => {
        const ok = typeof window !== 'undefined'
          ? window.confirm('Replace your current save with the max-level QA fixture? This cannot be undone unless you have a cloud backup.')
          : true;
        if (!ok) return;
        const save = buildMaxLevelSave();
        dispatch({ type: 'LOAD_SAVE', saveData: save } as never);
        // eslint-disable-next-line no-console
        console.log('[Menagerie QA] Loaded max-level fixture:', {
          monsters: save.unlockedMonsters.length,
          recipes: save.unlockedRecipes.length,
          gold: save.gold,
          entrances: Object.keys(save.dungeonEntrances).length,
        });
      },
      runAutobattle: (opts) => {
        const save = state.saveData;
        // Default to the fixture teams so callers can invoke bare.
        let teamA = opts?.teamA as { id: string; members: unknown[] } | undefined;
        let teamB = opts?.teamB as { id: string; members: unknown[] } | undefined;
        if (!teamA || !teamB) {
          const fixture = buildTwoMaxLevelTeams(save);
          teamA = teamA ?? { id: 'A', members: fixture.teamA };
          teamB = teamB ?? { id: 'B', members: fixture.teamB };
        }
        const res = runAutobattle(
          teamA as never,
          teamB as never,
          { seed: opts?.seed ?? 1, maxTurns: opts?.maxTurns, verbose: opts?.verbose },
        );
        // eslint-disable-next-line no-console
        console.log('[Menagerie Autobattle]', {
          winner: res.winner, turns: res.turns, mvp: res.mvpId, casualties: res.casualties,
        });
        return res;
      },
      help: () => {
        // eslint-disable-next-line no-console
        console.log([
          'window.__menagerie:',
          '  getState()          — current GameState',
          '  dispatch(a)         — dispatch an action against the live store',
          '  snapshot()          — compact snapshot of persisted progress',
          '  runSmokeTest()      — run all QA invariants, returns results array',
          '  loadMaxLevelSave()  — replace save with the max-level QA fixture (confirms first)',
          '  runAutobattle(opts) — headless team-vs-team match; defaults to fixture teams',
        ].join('\n'));
        // Silence unused import warnings if a build strips them.
        void buildMaxLevelParty;
      },
    };
    return () => { delete window.__menagerie; };
  }, [state, dispatch]);
  return null;
}
