import { SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES, Move } from '../src/game/moves';
const all: Move[] = [];
for (const g of [SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES] as any[]) for (const k of Object.keys(g)) all.push(...g[k]);
const AOE = /\b(all enemies|everyone|every enemy|around|aura|explos|explode|eruption|erupt|nova|storm|quake|wave|blast|burst|shockwave|cone|radius|area|sweep|swirl|whirl|vortex|spray|rain of|barrage|shower|cloud|field|meteor|avalanche|tremor|slam the ground|ground slam|splash)\b/i;
const PIERCE = /\b(pierc|through all|impal|skewer|line of enemies|penetrat)\b/i;
const isAoe = (m: Move) => m.customShape || ['aura','cone','area','piercing'].includes(m.targeting ?? '') || (m.aoeRadius ?? 0) > 0 || m.piercing;
let n=0;
for (const m of all) {
  const t = `${m.name} ${m.description}`;
  const issues: string[] = [];
  if (AOE.test(t) && !isAoe(m) && m.type!=='status' && m.type!=='heal' && m.type!=='movement') issues.push('AOE-untagged');
  if (PIERCE.test(t) && !m.piercing && m.targeting!=='piercing') issues.push('pierce-untagged');
  if (m.type==='ranged' && !m.targeting && !m.customShape) issues.push('ranged-no-targeting');
  if ((m.targeting==='area'||m.targeting==='aura') && !m.aoeRadius) issues.push('no-radius');
  if (m.type!=='movement' && m.movement) issues.push('movement-type-mismatch');
  if (m.effect?.startsWith('heal') && m.type==='status' && m.power===0) {}
  if (issues.length) { n++; console.log(m.id.padEnd(26), (m.type+'/'+(m.targeting??'-')).padEnd(18), issues.join(','), '|', m.description); }
}
console.log('total flagged', n, 'of', all.length);
