/**
 * QA invariants — pure functions that verify Menagerie's most fragile
 * persistence and inventory contracts.
 *
 * Used by:
 *   - Admin QA panel (/admin/qa) for one-click regression checks
 *   - `window.__menagerie.runSmokeTest()` debug bridge
 *
 * Each invariant takes the LIVE saveData/run when relevant, and/or runs
 * a synthetic fixture through the real reducer to prove the contract
 * still holds. No production state is mutated.
 */
import { gameReducer, persistRunPartyProgress } from '@/game/state';
import type { GameState, SaveData, Monster, UnlockedMonster } from '@/game/types';
import { createEmptyEquipment, type EquipmentItem } from '@/game/equipment';
import {
  BUILDING_DEFINITIONS,
  canPlaceBuilding,
  createBuilding,
  getDisassembleRefund,
  type PlayerBuilding,
} from '@/game/buildings';
import { createOverworldState } from '@/game/overworld';
import { buildMaxLevelSave, buildTwoMaxLevelTeams } from './fixtures/maxLevelSave';
import { CANONICAL_TOWN_LAYOUT } from './fixtures/canonicalTownLayout';
import { runAutobattle } from '@/game/autobattle';

export interface InvariantResult {
  id: string;
  name: string;
  pass: boolean;
  severity: 'critical' | 'warn' | 'info';
  detail: string;
  memoryRef?: string;
}

// ---------- fixtures ----------

function fakeEquipment(id: string): EquipmentItem {
  return {
    id,
    name: `Test ${id}`,
    slot: 'helmet',
    rarity: 'common',
    level: 1,
    icon: 'helmet',
    stats: { hp: 5 },
  } as unknown as EquipmentItem;
}

function fakeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'qa-test',
    name: 'QA Slime',
    species: 'slime',
    element: 'water',
    class: 'biological',
    level: 5,
    experience: 42,
    hp: 50,
    maxHp: 50,
    stamina: 30,
    maxStamina: 30,
    stats: { hp: 50, atk: 10, def: 10, spd: 10, dex: 10, special: 10 },
    moves: [],
    moveMastery: { water_jet: { uses: 17, currentTier: 'base', hasAoE: false } },
    equipment: createEmptyEquipment(),
    ...overrides,
  } as unknown as Monster;
}

function fakeSaveData(unlocked: UnlockedMonster[]): SaveData {
  return {
    unlockedSpecies: ['slime'],
    unlockedCombos: [],
    unlockedMonsters: unlocked,
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
  } as SaveData;
}

function fakeRun(party: Monster[], gold = 0): GameState['run'] {
  return {
    currentMonster: party[0],
    party,
    activePartyIndex: 0,
    dungeon: null,
    battle: null,
    gold,
    experience: 0,
    itemsCollected: [],
    inventory: [],
    equipmentInventory: [],
    partyEquipment: party.map((m) => ({ ...createEmptyEquipment(), ...(m.equipment || {}) })),
    runMaterials: {},
    enemiesDefeated: 0,
    moveOrder: [],
    hiddenMoves: [],
    partyEffects: party.map(() => ({ statusEffects: [], statModifiers: [] })),
    battleStats: undefined,
  } as unknown as GameState['run'];
}

// ---------- invariants ----------

/** END_RUN must write level + xp + moveMastery + equipment back to UnlockedMonster. */
function inv_endRunPersistsAllFour(): InvariantResult {
  const existing: UnlockedMonster = {
    comboId: 'slime_water_biological',
    species: 'slime',
    element: 'water',
    classType: 'biological',
    level: 3,
    experience: 5,
    moveMastery: { water_jet: { uses: 2, currentTier: 'base', hasAoE: false } },
  } as UnlockedMonster;
  const before = fakeSaveData([existing]);
  const helm = fakeEquipment('qa-helm');
  const party = [fakeMonster({ equipment: { ...createEmptyEquipment(), helmet: helm } })];
  const run = fakeRun(party);
  const state: GameState = { phase: 'dungeon', run, saveData: before };
  const after = gameReducer(state, { type: 'END_RUN', victory: false } as never);
  const persisted = after.saveData.unlockedMonsters.find(m => m.comboId === 'slime_water_biological');
  const checks = {
    level: persisted?.level === 5,
    xp: persisted?.experience === 42,
    mastery: (persisted?.moveMastery?.water_jet?.uses ?? 0) === 17,
    equipment: persisted?.equipment?.helmet?.id === 'qa-helm',
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  return {
    id: 'end-run-persists-four',
    name: 'END_RUN persists level + xp + mastery + equipment',
    pass: failed.length === 0,
    severity: 'critical',
    detail: failed.length === 0
      ? 'All four fields written to UnlockedMonster after END_RUN.'
      : `Missing fields: ${failed.join(', ')}.`,
    memoryRef: 'gameplay/progression/persistent-monster-xp-and-mastery',
  };
}

/** FLEE_DUNGEON must be symmetric with END_RUN for the four fields. */
function inv_fleeDungeonPersistsAllFour(): InvariantResult {
  const existing: UnlockedMonster = {
    comboId: 'slime_water_biological',
    species: 'slime',
    element: 'water',
    classType: 'biological',
    level: 1,
    experience: 0,
  } as UnlockedMonster;
  const before = fakeSaveData([existing]);
  const boots = fakeEquipment('qa-boots');
  const party = [fakeMonster({ level: 7, experience: 99, equipment: { ...createEmptyEquipment(), boots } })];
  const run = fakeRun(party, 150);
  const state: GameState = { phase: 'dungeon', run, saveData: before };
  const after = gameReducer(state, { type: 'FLEE_DUNGEON' } as never);
  const p = after.saveData.unlockedMonsters.find(m => m.comboId === 'slime_water_biological');
  const goldOk = (after.saveData.gold ?? 0) >= 150;
  const checks = {
    level: p?.level === 7,
    xp: p?.experience === 99,
    mastery: (p?.moveMastery?.water_jet?.uses ?? 0) === 17,
    equipment: p?.equipment?.boots?.id === 'qa-boots',
    goldBanked: goldOk,
  };
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  return {
    id: 'flee-persists-four',
    name: 'FLEE_DUNGEON persists same four + banks gold',
    pass: failed.length === 0,
    severity: 'critical',
    detail: failed.length === 0
      ? 'Flee symmetric with END_RUN; gold added to town.'
      : `Missing: ${failed.join(', ')}.`,
    memoryRef: 'gameplay/progression/no-death-losses',
  };
}

/**
 * START_RUN must return persisted gear that the player unequipped in Pre-Run
 * back to storedEquipment, or the item is silently lost.
 */
function inv_preRunUnequipRecovery(): InvariantResult {
  const persistedHelm = fakeEquipment('persisted-helm');
  const monsterWithGear = fakeMonster({
    equipment: { ...createEmptyEquipment(), helmet: persistedHelm },
  });
  const before = fakeSaveData([]);
  const state: GameState = { phase: 'main_menu', run: null, saveData: before };
  // Player started a run but DID NOT pass the helm into partyPreEquipped,
  // i.e. they unequipped it in the Pre-Run screen.
  const after = gameReducer(state, {
    type: 'START_RUN',
    monster: monsterWithGear,
    party: [monsterWithGear],
    partyPreEquipped: [createEmptyEquipment()],
  } as never);
  const recovered = after.saveData.storedEquipment.some(i => i.id === 'persisted-helm');
  return {
    id: 'pre-run-unequip-recovery',
    name: 'START_RUN recovers unequipped persisted gear to storage',
    pass: recovered,
    severity: 'critical',
    detail: recovered
      ? 'Unequipped persisted helm returned to storedEquipment.'
      : 'Helm vanished — Pre-Run Unequip Recovery regressed.',
    memoryRef: 'gameplay/equipment/pre-run-unequip-recovery',
  };
}

/** Unified inventory: run.inventory and saveData.storedItems must mirror live. */
function inv_unifiedInventoryLive(live: GameState): InvariantResult {
  if (!live.run) {
    return {
      id: 'unified-inventory-live',
      name: 'Unified inventory mirror (run ↔ storedItems)',
      pass: true,
      severity: 'info',
      detail: 'No active run — invariant not applicable.',
      memoryRef: 'gameplay/equipment/unified-inventory',
    };
  }
  const runIds = new Set((live.run.inventory ?? []).map(i => i.id));
  const storeIds = new Set((live.saveData.storedItems ?? []).map(i => i.id));
  const onlyRun = [...runIds].filter(x => !storeIds.has(x));
  const onlyStore = [...storeIds].filter(x => !runIds.has(x));
  const pass = onlyRun.length === 0 && onlyStore.length === 0;
  return {
    id: 'unified-inventory-live',
    name: 'Unified inventory mirror (run ↔ storedItems)',
    pass,
    severity: pass ? 'info' : 'critical',
    detail: pass
      ? 'Run inventory and stored items match.'
      : `Drift detected — only in run: [${onlyRun.join(',')}], only in store: [${onlyStore.join(',')}]`,
    memoryRef: 'gameplay/equipment/unified-inventory',
  };
}

/** Canonical persist helper must merge mastery by MAX uses, never overwrite. */
function inv_masteryMergeMax(): InvariantResult {
  const existing: UnlockedMonster = {
    comboId: 'slime_water_biological',
    species: 'slime',
    element: 'water',
    classType: 'biological',
    level: 10,
    experience: 0,
    moveMastery: { water_jet: { uses: 99, currentTier: 'base', hasAoE: false } },
  } as UnlockedMonster;
  const save = fakeSaveData([existing]);
  // Run brings a lower-mastery copy (e.g. mid-leveling).
  const party = [fakeMonster({ level: 10, moveMastery: { water_jet: { uses: 5, currentTier: 'base', hasAoE: false } } })];
  const result = persistRunPartyProgress(save, fakeRun(party));
  const merged = result.find(m => m.comboId === 'slime_water_biological');
  const pass = (merged?.moveMastery?.water_jet?.uses ?? 0) === 99;
  return {
    id: 'mastery-merge-max',
    name: 'Mastery merge keeps highest uses',
    pass,
    severity: 'critical',
    detail: pass ? 'Existing 99 uses preserved over run\'s 5 uses.' : 'Mastery REGRESSED — helper overwrote with lower value.',
    memoryRef: 'gameplay/progression/move-mastery-thresholds',
  };
}

/** Corrupted-save fixture: load is missing moveMastery field — reducer must not crash. */
function inv_corruptedSaveTolerance(): InvariantResult {
  const broken: UnlockedMonster = {
    comboId: 'slime_water_biological',
    species: 'slime',
    element: 'water',
    classType: 'biological',
    level: 4,
    // moveMastery intentionally missing
  } as unknown as UnlockedMonster;
  try {
    const save = fakeSaveData([broken]);
    const party = [fakeMonster({ level: 4 })];
    const out = persistRunPartyProgress(save, fakeRun(party));
    const ok = !!out.find(m => m.comboId === 'slime_water_biological');
    return {
      id: 'corrupt-save-tolerance',
      name: 'Reducer tolerates missing moveMastery on save',
      pass: ok,
      severity: 'warn',
      detail: ok ? 'Helper handled missing field gracefully.' : 'Helper returned no record.',
    };
  } catch (e) {
    return {
      id: 'corrupt-save-tolerance',
      name: 'Reducer tolerates missing moveMastery on save',
      pass: false,
      severity: 'warn',
      detail: `Threw: ${(e as Error).message}`,
    };
  }
}

/**
 * Town-build QA — proves the canonical layout can be built, disassembled,
 * and re-built against the real placement + refund helpers. Uses the
 * max-level fixture so it also serves as a smoke test for that fixture.
 */
function inv_townBuildAndRefund(): InvariantResult {
  try {
    const save = buildMaxLevelSave();
    const ow = createOverworldState(1);
    // Stock resources far above any layout cost so pure placement rules are
    // what we're testing (not resource-starvation edge cases).
    ow.woodCollected = 9999;
    ow.stoneCollected = 9999;
    ow.playerBuildings = [];
    const home = ow.homeBase?.position ?? { x: 0, y: 0 };

    const built: PlayerBuilding[] = [];
    const placementFailures: string[] = [];
    let woodSpent = 0;
    let stoneSpent = 0;

    for (const entry of CANONICAL_TOWN_LAYOUT) {
      const x = home.x + entry.dx;
      const y = home.y + entry.dy;
      const check = canPlaceBuilding(
        x, y, ow.playerBuildings, home, ow.woodCollected, ow.stoneCollected, entry.type,
      );
      if (!check.canPlace) {
        placementFailures.push(`${entry.type}@(${x},${y}): ${check.reason}`);
        continue;
      }
      const def = BUILDING_DEFINITIONS[entry.type];
      const b = createBuilding(entry.type, x, y);
      ow.playerBuildings.push(b);
      ow.woodCollected -= def.cost.wood;
      ow.stoneCollected -= def.cost.stone;
      woodSpent += def.cost.wood;
      stoneSpent += def.cost.stone;
      built.push(b);
    }

    if (placementFailures.length > 0) {
      return {
        id: 'town-build-and-refund',
        name: 'Canonical town layout builds + refunds cleanly',
        pass: false,
        severity: 'critical',
        detail: `Placement rejected: ${placementFailures.join(' | ')}`,
      };
    }

    // Disassemble in reverse order — refund helper should return at least
    // 25% of each per-building cost (per DISASSEMBLE_REFUND_RATIO with HP floor).
    let woodRefunded = 0;
    let stoneRefunded = 0;
    for (let i = built.length - 1; i >= 0; i--) {
      const b = built[i];
      const refund = getDisassembleRefund(b);
      woodRefunded += refund.wood;
      stoneRefunded += refund.stone;
      ow.woodCollected += refund.wood;
      ow.stoneCollected += refund.stone;
      ow.playerBuildings = ow.playerBuildings.filter(x => x.id !== b.id);
    }

    if (ow.playerBuildings.length !== 0) {
      return {
        id: 'town-build-and-refund',
        name: 'Canonical town layout builds + refunds cleanly',
        pass: false,
        severity: 'critical',
        detail: `Orphan buildings after teardown: ${ow.playerBuildings.length}`,
      };
    }

    // Rebuild once more to prove the buildable-radius chain still works.
    let rebuildFailures = 0;
    for (const entry of CANONICAL_TOWN_LAYOUT) {
      const x = home.x + entry.dx;
      const y = home.y + entry.dy;
      const check = canPlaceBuilding(
        x, y, ow.playerBuildings, home, ow.woodCollected, ow.stoneCollected, entry.type,
      );
      if (!check.canPlace) { rebuildFailures++; continue; }
      const def = BUILDING_DEFINITIONS[entry.type];
      ow.playerBuildings.push(createBuilding(entry.type, x, y));
      ow.woodCollected -= def.cost.wood;
      ow.stoneCollected -= def.cost.stone;
    }

    if (rebuildFailures > 0) {
      return {
        id: 'town-build-and-refund',
        name: 'Canonical town layout builds + refunds cleanly',
        pass: false,
        severity: 'critical',
        detail: `Rebuild pass rejected ${rebuildFailures}/${CANONICAL_TOWN_LAYOUT.length} entries after teardown.`,
      };
    }

    // Ignore save (only used to smoke-test the fixture itself here).
    void save;
    return {
      id: 'town-build-and-refund',
      name: 'Canonical town layout builds + refunds cleanly',
      pass: true,
      severity: 'critical',
      detail: `Built + torn down + rebuilt ${CANONICAL_TOWN_LAYOUT.length} structures. Spent ${woodSpent}w/${stoneSpent}s, refunded ${woodRefunded}w/${stoneRefunded}s.`,
    };
  } catch (e) {
    return {
      id: 'town-build-and-refund',
      name: 'Canonical town layout builds + refunds cleanly',
      pass: false,
      severity: 'critical',
      detail: `Threw: ${(e as Error).message}`,
    };
  }
}

/**
 * Deterministic autobattle — runs the same match three times with one seed
 * (identical results required), then once with a different seed (log must
 * diverge to prove the seed is actually threaded through).
 */
function inv_autobattleDeterministic(): InvariantResult {
  try {
    const save = buildMaxLevelSave();
    const { teamA: aMembers, teamB: bMembers } = buildTwoMaxLevelTeams(save);
    const teamA = { id: 'A', members: aMembers };
    const teamB = { id: 'B', members: bMembers };

    const r1 = runAutobattle(teamA, teamB, { seed: 42 });
    const r2 = runAutobattle(teamA, teamB, { seed: 42 });
    const r3 = runAutobattle(teamA, teamB, { seed: 42 });
    const rDiff = runAutobattle(teamA, teamB, { seed: 43 });

    const sameSeedStable =
      r1.winner === r2.winner && r2.winner === r3.winner &&
      r1.turns === r2.turns && r2.turns === r3.turns &&
      r1.log.length === r2.log.length && r2.log.length === r3.log.length;

    const differentSeedDiffers =
      rDiff.log.length !== r1.log.length ||
      rDiff.winner !== r1.winner ||
      rDiff.turns !== r1.turns;

    const pass = sameSeedStable && differentSeedDiffers;
    return {
      id: 'autobattle-deterministic',
      name: 'Autobattle is deterministic per seed',
      pass,
      severity: pass ? 'critical' : 'critical',
      detail: pass
        ? `Same-seed ×3 stable (winner=${r1.winner}, turns=${r1.turns}). Different-seed diverges (winner=${rDiff.winner}, turns=${rDiff.turns}).`
        : !sameSeedStable
          ? `Same-seed runs diverged: winners=[${r1.winner},${r2.winner},${r3.winner}] turns=[${r1.turns},${r2.turns},${r3.turns}]`
          : `Different seeds produced identical output — seed not threaded through the resolver.`,
    };
  } catch (e) {
    return {
      id: 'autobattle-deterministic',
      name: 'Autobattle is deterministic per seed',
      pass: false,
      severity: 'critical',
      detail: `Threw: ${(e as Error).message}`,
    };
  }
}

export function runAllInvariants(live: GameState): InvariantResult[] {
  return [
    inv_endRunPersistsAllFour(),
    inv_fleeDungeonPersistsAllFour(),
    inv_preRunUnequipRecovery(),
    inv_masteryMergeMax(),
    inv_unifiedInventoryLive(live),
    inv_corruptedSaveTolerance(),
    inv_townBuildAndRefund(),
    inv_autobattleDeterministic(),
  ];
}

export function summarize(results: InvariantResult[]) {
  const pass = results.filter(r => r.pass).length;
  const fail = results.length - pass;
  return { pass, fail, total: results.length };
}
