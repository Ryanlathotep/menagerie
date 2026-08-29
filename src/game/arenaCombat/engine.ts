/**
 * 6x6 alternating-turn combat engine. Deterministic given a seed by patching
 * Math.random through mulberry32 (same trick as the autobattle resolver).
 *
 * Reuses existing combat.ts.executeCombat and enemyAI scoring so any balance
 * changes upstream apply here too.
 */
import { executeCombat } from '@/game/combat';
import { getAttackConfig } from '@/game/dungeonCombat';
import { mulberry32, withSeededRandom } from '@/game/autobattle/seeded';
import { buildTurnOrder, chebyshev } from './turnOrder';
import { autoStrategy } from './strategy';
import type {
  ArenaCombatOptions, ArenaCombatResult, ArenaCombatTeam, Combatant, Position,
} from './types';
import type { Monster } from '@/game/types';
import type { ReplayEvent } from '@/game/arena/types';

function cloneMonster(m: Monster): Monster {
  return {
    ...m,
    stats: { ...m.stats },
    equipment: m.equipment ? { ...m.equipment } : undefined,
    moveMastery: m.moveMastery ? JSON.parse(JSON.stringify(m.moveMastery)) : undefined,
  };
}

function initialPositions(
  count: number, side: 'A' | 'B', width: number, height: number, blocked: Set<string>,
): Position[] {
  // Team A on the left edge, Team B on the right edge. Slide inward past walls.
  const positions: Position[] = [];
  const usable = Math.min(count, height);
  const yStart = Math.floor((height - usable) / 2);
  for (let i = 0; i < usable; i++) {
    const y = yStart + i;
    let x = side === 'A' ? 0 : width - 1;
    let guard = 0;
    while (blocked.has(`${x},${y}`) && guard < width) {
      x += side === 'A' ? 1 : -1;
      guard++;
    }
    positions.push({ x: Math.max(0, Math.min(width - 1, x)), y });
  }
  return positions;
}

function occupied(pos: Position, all: Combatant[], self?: Combatant): boolean {
  return all.some(c => c !== self && c.monster.stats.currentHp > 0 && c.pos.x === pos.x && c.pos.y === pos.y);
}

export function runArenaCombat(
  teamA: ArenaCombatTeam, teamB: ArenaCombatTeam, opts: ArenaCombatOptions = {},
): ArenaCombatResult {
  const seed = opts.seed ?? 1;
  const width = opts.gridWidth ?? 24;
  const height = opts.gridHeight ?? 24;
  const maxActions = opts.maxTurns ?? 480;
  const rng = mulberry32(seed);
  const blocked = new Set((opts.blockedCells ?? []).map(c => `${c.x},${c.y}`));

  const membersA = teamA.members.slice(0, 6).map(cloneMonster);
  const membersB = teamB.members.slice(0, 6).map(cloneMonster);
  const posA = initialPositions(membersA.length, 'A', width, height, blocked);
  const posB = initialPositions(membersB.length, 'B', width, height, blocked);

  const combatants: Combatant[] = [
    ...membersA.map((m, i) => ({ monster: m, team: 'A' as const, pos: posA[i] ?? { x: 0, y: i } })),
    ...membersB.map((m, i) => ({ monster: m, team: 'B' as const, pos: posB[i] ?? { x: width - 1, y: i } })),
  ];

  const log: ReplayEvent[] = [];
  const perMonster: ArenaCombatResult['perMonster'] = {};
  for (const c of combatants) perMonster[c.monster.id] = { dmgDealt: 0, dmgTaken: 0, moveUses: {} };

  const strategyA = teamA.strategy ?? autoStrategy;
  const strategyB = teamB.strategy ?? autoStrategy;

  let actions = 0;
  let turnCounter = 0;

  const anyAlive = (team: 'A' | 'B') =>
    combatants.some(c => c.team === team && c.monster.stats.currentHp > 0);

  const snapshotHp = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of combatants) out[c.monster.id] = c.monster.stats.currentHp;
    return out;
  };

  withSeededRandom(rng, () => {
    while (actions < maxActions && anyAlive('A') && anyAlive('B')) {
      const order = buildTurnOrder(combatants);
      for (const actor of order) {
        if (actor.monster.stats.currentHp <= 0) continue;
        if (!anyAlive('A') || !anyAlive('B')) break;

        turnCounter++;
        actions++;

        const allies = combatants.filter(c => c.team === actor.team && c !== actor);
        const enemies = combatants.filter(c => c.team !== actor.team);
        const strategy = actor.team === 'A' ? strategyA : strategyB;
        const decision = strategy({
          self: actor, allies, enemies,
          distance: chebyshev, grid: { width, height }, turn: turnCounter,
          isBlocked: (p) => blocked.has(`${p.x},${p.y}`),
          isOccupied: (p) => occupied(p, combatants, actor),
        });

        const fromX = actor.pos.x, fromY = actor.pos.y;

        // Movement-skill branch: pay stamina and relocate with the named move.
        if (decision.relocate && decision.move && decision.moveTo) {
          const mv = decision.move;
          const dest = decision.moveTo;
          const legal =
            dest.x >= 0 && dest.y >= 0 && dest.x < width && dest.y < height &&
            !blocked.has(`${dest.x},${dest.y}`) && !occupied(dest, combatants, actor);
          if (legal) {
            actor.monster.stats.currentStamina = Math.max(
              0, actor.monster.stats.currentStamina - (mv.staminaCost ?? 0),
            );
            actor.pos = dest;
            const mu = (perMonster[actor.monster.id].moveUses[mv.id] ??= { uses: 0, damage: 0, crits: 0 });
            mu.uses += 1;

            // Combo moves (movement + damage) resolve the attack from the new tile.
            const comboTarget = (mv.power ?? 0) > 0
              ? combatants.find(c => c.monster.id === decision.targetId && c.monster.stats.currentHp > 0)
              : undefined;
            let dmg = 0; let crit = false; let dodged = false; let fainted = false;
            if (comboTarget && chebyshev(actor.pos, comboTarget.pos) <= Math.max(1, getAttackConfig(mv).range ?? 1)) {
              const res = executeCombat(mv, actor.monster, comboTarget.monster, true);
              dmg = res.hit ? res.damage : 0;
              crit = !!res.critical; dodged = !res.hit;
              if (dmg > 0) {
                comboTarget.monster.stats.currentHp = Math.max(0, comboTarget.monster.stats.currentHp - dmg);
                perMonster[actor.monster.id].dmgDealt += dmg;
                perMonster[comboTarget.monster.id].dmgTaken += dmg;
                mu.damage += dmg;
                if (crit) mu.crits += 1;
              }
              fainted = comboTarget.monster.stats.currentHp <= 0;
            }

            log.push({
              turn: turnCounter, actorId: actor.monster.id, actorTeam: actor.team,
              fromX, fromY, toX: actor.pos.x, toY: actor.pos.y,
              moveId: mv.id, moveName: mv.name,
              targetId: comboTarget?.monster.id,
              damage: dmg || undefined, crit, dodged, faint: fainted,
              message: comboTarget && dmg > 0
                ? `${actor.monster.name} dashes with ${mv.name} and hits ${comboTarget.monster.name} for ${dmg}.`
                : `${actor.monster.name} repositions with ${mv.name}.`,
              hpAfter: snapshotHp(),
            });
            if (!anyAlive('A') || !anyAlive('B')) break;
            continue;
          }
          // Illegal destination — fall through to a plain step.
          decision.moveTo = dest;
          decision.move = undefined;
        }

        // Movement branch
        if (!decision.move && decision.moveTo) {
          const target = decision.moveTo;
          const free = (p: Position) =>
            p.x >= 0 && p.y >= 0 && p.x < width && p.y < height &&
            !blocked.has(`${p.x},${p.y}`) && !occupied(p, combatants, actor);
          if (free(target)) {
            actor.pos = target;
          } else {
            // Wall or ally in the way — try sliding along one axis instead.
            const alts: Position[] = [
              { x: target.x, y: fromY },
              { x: fromX, y: target.y },
            ];
            const alt = alts.find(free);
            if (alt) actor.pos = alt;
          }

          log.push({
            turn: turnCounter, actorId: actor.monster.id, actorTeam: actor.team,
            fromX, fromY, toX: actor.pos.x, toY: actor.pos.y,
            message: `${actor.monster.name} moves.`,
            hpAfter: snapshotHp(),
          });
          continue;
        }

        // Rest branch — no move + no move-to
        if (!decision.move) {
          actor.monster.stats.currentStamina = Math.min(
            actor.monster.stats.stamina,
            actor.monster.stats.currentStamina + 8,
          );
          log.push({
            turn: turnCounter, actorId: actor.monster.id, actorTeam: actor.team,
            fromX, fromY, toX: fromX, toY: fromY,
            message: `${actor.monster.name} rests.`,
            hpAfter: snapshotHp(),
          });
          continue;
        }

        // Attack branch
        const move = decision.move;
        const target = combatants.find(c => c.monster.id === decision.targetId && c.monster.stats.currentHp > 0);
        if (!target) {
          log.push({
            turn: turnCounter, actorId: actor.monster.id, actorTeam: actor.team,
            fromX, fromY, toX: fromX, toY: fromY,
            moveId: move.id, moveName: move.name,
            message: `${actor.monster.name}'s ${move.name} finds no target.`,
            hpAfter: snapshotHp(),
          });
          continue;
        }

        // Pay stamina up-front (executeCombat expects the caller to handle it).
        actor.monster.stats.currentStamina = Math.max(0, actor.monster.stats.currentStamina - (move.staminaCost ?? 0));

        const result = executeCombat(move, actor.monster, target.monster, true);
        const dmg = result.hit ? result.damage : 0;
        if (dmg > 0) {
          target.monster.stats.currentHp = Math.max(0, target.monster.stats.currentHp - dmg);
          perMonster[actor.monster.id].dmgDealt += dmg;
          perMonster[target.monster.id].dmgTaken += dmg;
        }
        if (result.reflectDamage && result.reflectDamage > 0) {
          actor.monster.stats.currentHp = Math.max(0, actor.monster.stats.currentHp - result.reflectDamage);
          perMonster[actor.monster.id].dmgTaken += result.reflectDamage;
        }
        const mu = (perMonster[actor.monster.id].moveUses[move.id] ??= { uses: 0, damage: 0, crits: 0 });
        mu.uses += 1;
        mu.damage += dmg;
        if (result.critical) mu.crits += 1;

        const fainted = target.monster.stats.currentHp <= 0;
        log.push({
          turn: turnCounter,
          actorId: actor.monster.id, actorTeam: actor.team,
          fromX, fromY, toX: fromX, toY: fromY,
          moveId: move.id, moveName: move.name,
          targetId: target.monster.id,
          damage: dmg, crit: result.critical, dodged: !result.hit, faint: fainted,
          message: result.message,
          hpAfter: snapshotHp(),
        });

        if (!anyAlive('A') || !anyAlive('B')) break;
      }
    }
  });

  const aAlive = anyAlive('A');
  const bAlive = anyAlive('B');
  const winner: ArenaCombatResult['winner'] = aAlive && !bAlive ? 'A' : bAlive && !aAlive ? 'B' : 'draw';

  return {
    winner,
    turns: turnCounter,
    log, seed,
    survivorsA: combatants.filter(c => c.team === 'A' && c.monster.stats.currentHp > 0).map(c => c.monster.id),
    survivorsB: combatants.filter(c => c.team === 'B' && c.monster.stats.currentHp > 0).map(c => c.monster.id),
    finalHp: snapshotHp(),
    perMonster,
  };
}
