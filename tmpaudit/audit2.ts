import { SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES, Move } from '../src/game/moves';
const all: [string,string,Move][] = [];
for (const [label,g] of [['species',SPECIES_MOVES],['element',ELEMENT_MOVES],['class',CLASS_MOVES]] as any[])
  for (const k of Object.keys(g)) for (const m of g[k]) all.push([label,k,m]);
for (const [label,k,m] of all) {
  const t=`${m.name} ${m.description} ${m.effect??''}`;
  const iss:string[]=[];
  if (m.aspects[0]!==label) iss.push(`aspect!=${label}`);
  if (label==='element' && m.element!==k) iss.push('element-mismatch');
  if (label==='class' && m.classBonus!==k) iss.push('class-mismatch');
  if (m.type==='movement' && !m.movement) iss.push('movement-no-pattern');
  if (/\b(heal|restore|regenerat|mend|recover)\b/i.test(m.name+' '+m.description) && m.type!=='heal' && !/heal_self|drain|absorb/.test(m.effect??'')) iss.push('should-be-heal');
  if (m.type==='heal' && m.power>0) iss.push('heal-with-power');
  if ((m.type==='status') && m.power>0) iss.push('status-with-power');
  if ((m.type==='melee'||m.type==='ranged') && m.power===0) iss.push('attack-zero-power');
  if (/\b(teleport|blink|dash|leap|charge at|reposition|step|jump)\b/i.test(m.name) && m.type!=='movement') iss.push('should-be-movement');
  if (/\b(ghost|phase|through walls|psychic|spirit)\b/i.test(t) && !m.wallPenetrate && m.targeting!=='arc') iss.push('maybe-wallPenetrate');
  if (m.aoeRadius && !['aura','cone','area'].includes(m.targeting??'')) iss.push('radius-without-pattern');
  if (iss.length) console.log(`${label}/${k}`.padEnd(20), m.id.padEnd(24), (m.type+'/'+(m.targeting??'-')).padEnd(16), iss.join(','));
}
