/**
 * Autobattle resolver — plays two teams of Monsters against each other with
 * no UI, seeded RNG, and a compact result payload.
 *
 * Consumers:
 *   - QA invariants (`autobattle-deterministic`) — proves seed + reducer
 *     integration stays stable.
 *   - Admin QA panel — an auto-battle sandbox for manual verification.
 *   - Future Arena feature — daily/weekly/monthly PvP tournaments will call
 *     into this same resolver so results are consistent with map combat.
 *
 * Design constraints:
 *   - Never mutates the input Monsters. Every member is deep-cloned.
 *   - Deterministic given the same seed. All rng flows through
 *     `withSeededRandom` which patches Math.random for the duration of the
 *     match so existing combat.ts / enemyAI.ts helpers stay unmodified.
 *   - Hard 200-turn cap prevents infinite ping-pong (draw on cap).
 */
import type { Monster } from '@/game/types';
import { executeCombat } from '@/game/combat';
import { chooseEnemyMove, getEnemyArchetype, getEnemyIQ, type TacticContext } from '@/game/enemyAI';
import { mulberry32, withSeededRandom } from './seeded';
import type {
  AutobattleTeam,
  AutobattleResult,
  AutobattleLogEntry,
  AutobattleOptions,
} from './types';

const DEFAULT_MAX_TURNS = 200;

function cloneMonster(m: Monster): Monster {
  return {
    ...m,
    stats: { ...m.stats },
    equipment: m.equipment ? { ...m.equipment } : undefined,
    moveMastery: m.moveMastery ? JSON.parse(JSON.stringify(m.moveMastery)) : undefined,
  };
}

function cloneTeam(t: AutobattleTeam): AutobattleTeam {
  return { ...t, members: t.members.map(cloneMonster) };
}

function alive(m: Monster): boolean {
  return (m.stats.currentHp ?? 0) > 0;
}

function anyAlive(members: Monster[]): boolean {
  return members.some(alive);
}

/**
 * Pick the target with the LOWEST currentHp (focus-fire the weakest link).
 * Deterministic tie-break on member id keeps results reproducible.
 */
function pickTarget(enemies: Monster[]): Monster | null {
  const living = enemies.filter(alive);
  if (living.length === 0) return null;
  living.sort((a, b) => (a.stats.currentHp - b.stats.currentHp) || a.id.localeCompare(b.id));
  return living[0];
}

/** Turn order = descending speed, deterministic tie-break on id. */
function turnOrder(all: Monster[]): Monster[] {
  return [...all].filter(alive).sort((a, b) => {
    const sa = a.stats.speed ?? 0;
    const sb = b.stats.speed ?? 0;
    if (sb !== sa) return sb - sa;
    return a.id.localeCompare(b.id);
  });
}

export function runAutobattle(
  teamAInput: AutobattleTeam,
  teamBInput: AutobattleTeam,
  opts: AutobattleOptions = {},
): AutobattleResult {
  const seed = opts.seed ?? 1;
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  const verbose = opts.verbose ?? false;
  const rng = mulberry32(seed);

  const teamA = cloneTeam(teamAInput);
  const teamB = cloneTeam(teamBInput);

  const log: AutobattleLogEntry[] = [];
  const casualties: string[] = [];
  const dmgByMonster = new Map<string, number>();

  const sideOf = (m: Monster): 'A' | 'B' =>
    teamA.members.some(x => x.id === m.id) ? 'A' : 'B';

  let turn = 0;
  const finalResult = withSeededRandom(rng, () => {
    while (turn < maxTurns && anyAlive(teamA.members) && anyAlive(teamB.members)) {
      turn++;
      const order = turnOrder([...teamA.members, ...teamB.members]);
      for (const actor of order) {
        if (!alive(actor)) continue;
        const side = sideOf(actor);
        const allies = (side === 'A' ? teamA : teamB).members;
        const enemies = (side === 'A' ? teamB : teamA).members;
        if (!anyAlive(enemies)) break;

        const target = pickTarget(enemies);
        if (!target) break;

        const ctx: TacticContext = {
          distance: 1, // autobattle abstracts away positioning — treat all as melee-range
          iq: getEnemyIQ(actor.level),
          archetype: getEnemyArchetype(actor),
          enemyHpRatio: (actor.stats.currentHp ?? 0) / Math.max(1, actor.stats.maxHp ?? 1),
          enemyStaminaRatio: (actor.stats.currentStamina ?? 0) / Math.max(1, actor.stats.stamina ?? 1),
          playerHpRatio: (target.stats.currentHp ?? 0) / Math.max(1, target.stats.maxHp ?? 1),
          playerElement: target.element,
        };

        const decision = chooseEnemyMove(actor, ctx);
        if (!decision.move) {
          // Rest — recover a chunk of stamina.
          actor.stats.currentStamina = Math.min(
            actor.stats.stamina ?? 0,
            (actor.stats.currentStamina ?? 0) + 8,
          );
          if (verbose) {
            log.push({
              turn, actor: actor.id, actorTeam: side,
              message: `${actor.name} rests to recover stamina.`,
            });
          }
          continue;
        }

        // Pay stamina up-front (executeCombat doesn't).
        actor.stats.currentStamina = Math.max(
          0,
          (actor.stats.currentStamina ?? 0) - (decision.move.staminaCost ?? 0),
        );

        const result = executeCombat(decision.move, actor, target, true);
        const dmg = result.hit ? result.damage : 0;
        if (dmg > 0) {
          target.stats.currentHp = Math.max(0, target.stats.currentHp - dmg);
          dmgByMonster.set(actor.id, (dmgByMonster.get(actor.id) ?? 0) + dmg);
        }
        // Reflect damage (Jellyfish sting etc.)
        if (result.reflectDamage && result.reflectDamage > 0) {
          actor.stats.currentHp = Math.max(0, actor.stats.currentHp - result.reflectDamage);
        }

        const fainted = target.stats.currentHp <= 0;
        if (fainted && !casualties.includes(target.id)) {
          casualties.push(target.id);
        }

        if (verbose || dmg > 0 || fainted) {
          log.push({
            turn,
            actor: actor.id,
            actorTeam: side,
            message: result.message,
            target: target.id,
            damage: dmg,
            crit: result.critical,
            faint: fainted,
          });
        }

        if (!anyAlive(teamB.members) || !anyAlive(teamA.members)) break;
      }
    }

    const aAlive = anyAlive(teamA.members);
    const bAlive = anyAlive(teamB.members);
    const winner: AutobattleResult['winner'] =
      aAlive && !bAlive ? 'A' :
      bAlive && !aAlive ? 'B' :
      'draw';

    let mvpId: string | null = null;
    let mvpDamage = 0;
    for (const [id, total] of dmgByMonster.entries()) {
      if (total > mvpDamage) { mvpDamage = total; mvpId = id; }
    }

    return { winner, mvpId, mvpDamage };
  });

  return {
    winner: finalResult.winner,
    turns: turn,
    seed,
    casualties,
    mvpId: finalResult.mvpId,
    mvpDamage: finalResult.mvpDamage,
    log,
  };
}
