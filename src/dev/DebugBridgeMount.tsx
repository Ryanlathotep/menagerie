/**
 * Mounts a tiny debug bridge on window.__menagerie inside GameProvider.
 * Available to admins, in dev builds, and to the QA panel. The skill
 * `menagerie-smoke-test` uses this to bypass canvas-input limitations.
 */
import { useEffect } from 'react';
import { useGame } from '@/game/state';
import { runAllInvariants, summarize } from './qaInvariants';

declare global {
  interface Window {
    __menagerie?: {
      getState: () => unknown;
      dispatch: (action: unknown) => void;
      snapshot: () => unknown;
      runSmokeTest: () => ReturnType<typeof runAllInvariants>;
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
      help: () => {
        // eslint-disable-next-line no-console
        console.log([
          'window.__menagerie:',
          '  getState()      — current GameState',
          '  dispatch(a)     — dispatch an action against the live store',
          '  snapshot()      — compact snapshot of persisted progress',
          '  runSmokeTest()  — run all QA invariants, returns results array',
        ].join('\n'));
      },
    };
    return () => { delete window.__menagerie; };
  }, [state, dispatch]);
  return null;
}
