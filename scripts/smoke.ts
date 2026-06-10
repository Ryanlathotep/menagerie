// One-shot CLI smoke test runner. Imports the same invariants the
// Admin QA panel uses and prints results to stdout.
import { runAllInvariants, summarize } from './src/dev/qaInvariants';
import type { GameState } from './src/game/types';

// Minimal live state stub — only inv_unifiedInventoryLive reads it,
// and only checks run.inventory mirroring (skips if no active run).
const stubState: GameState = {
  phase: 'main_menu',
  run: null,
  saveData: {
    unlockedSpecies: ['slime'],
    unlockedCombos: ['slime_water_biological'],
    unlockedMonsters: [],
    highestFloor: 0,
    totalRuns: 0,
    totalEnemiesDefeated: 0,
    gold: 0,
    materials: {},
    storedEquipment: [],
    storedItems: [],
    unlockedRecipes: [],
    dungeonEntrances: {},
    tools: {},
    itemWorldTowerState: {},
    taughtMoves: {},
  },
} as any;

const results = runAllInvariants(stubState);
const sum = summarize(results);

for (const r of results) {
  const icon = r.pass ? '✅' : (r.severity === 'critical' ? '❌' : '⚠️');
  console.log(`${icon} ${r.id}  —  ${r.name}`);
  console.log(`    ${r.detail}`);
}
console.log(`\nTotal: ${sum.pass}/${sum.total} passed (${sum.fail} failed)`);
process.exit(sum.fail > 0 ? 1 : 0);
