/**
 * Five hand-authored NPC team templates. Combos are resolved into live
 * Monsters at match time by npcTeamToMonsters(), which scales the level
 * to whatever the player roster average is (min 5, so early game still works).
 */
import type { ArenaTeam } from './types';
import type { Monster, SpeciesType, ClassType, ElementType } from '@/game/types';
import { createMonster } from '@/game/utils';

interface NpcMemberSpec {
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
}

interface NpcTeamSpec extends Omit<ArenaTeam, 'memberCombos'> {
  members: NpcMemberSpec[];
}

const NPC_SPECS: NpcTeamSpec[] = [
  {
    id: 'npc_fire_bruisers',
    name: 'Ember Legion',
    ownerId: 'npc_fire_bruisers',
    level: 20,
    banner: '🔥',
    members: [
      { species: 'dragon', element: 'fire', classType: 'kinetic' },
      { species: 'imp', element: 'fire', classType: 'chemical' },
      { species: 'golem', element: 'fire', classType: 'kinetic' },
      { species: 'goblin', element: 'fire', classType: 'kinetic' },
    ],
  },
  {
    id: 'npc_void_mages',
    name: 'Voidbound Choir',
    ownerId: 'npc_void_mages',
    level: 20,
    banner: '🌌',
    members: [
      { species: 'wisp', element: 'void', classType: 'energy' },
      { species: 'ghost', element: 'void', classType: 'energy' },
      { species: 'jellyfish', element: 'void', classType: 'chemical' },
      { species: 'bat', element: 'void', classType: 'biological' },
    ],
  },
  {
    id: 'npc_balanced',
    name: "Wanderer's Coalition",
    ownerId: 'npc_balanced',
    level: 20,
    banner: '⚖️',
    members: [
      { species: 'chimera', element: 'normal', classType: 'political' },
      { species: 'wolf', element: 'earth', classType: 'kinetic' },
      { species: 'crow', element: 'air', classType: 'energy' },
      { species: 'mushroom', element: 'water', classType: 'biological' },
    ],
  },
  {
    id: 'npc_water_tanks',
    name: 'Tidewall Guard',
    ownerId: 'npc_water_tanks',
    level: 20,
    banner: '🌊',
    members: [
      { species: 'shark', element: 'water', classType: 'kinetic' },
      { species: 'slime', element: 'water', classType: 'biological' },
      { species: 'frog', element: 'water', classType: 'chemical' },
      { species: 'golem', element: 'water', classType: 'kinetic' },
    ],
  },
  {
    id: 'npc_assassin_swarm',
    name: 'Whisper Swarm',
    ownerId: 'npc_assassin_swarm',
    level: 20,
    banner: '🗡️',
    members: [
      { species: 'spider', element: 'void', classType: 'chemical' },
      { species: 'rat', element: 'air', classType: 'biological' },
      { species: 'snake', element: 'earth', classType: 'chemical' },
      { species: 'beetle', element: 'earth', classType: 'kinetic' },
    ],
  },
];

export function getNpcTeams(): ArenaTeam[] {
  return NPC_SPECS.map(t => ({
    id: t.id, name: t.name, ownerId: t.ownerId,
    level: t.level, banner: t.banner,
    memberCombos: t.members.map(m => `${m.species}_${m.element}_${m.classType}`),
  }));
}

/** Materialize an NPC team into live Monsters scaled to the target level. */
export function hydrateNpcTeam(team: ArenaTeam, level: number): Monster[] {
  const spec = NPC_SPECS.find(s => s.id === team.id);
  if (!spec) return [];
  return spec.members.map(m => createMonster(m.species, m.classType, m.element, Math.max(5, level)));
}

/** True when a team id refers to a hand-authored NPC roster. */
export function isNpcTeam(teamId: string): boolean {
  return NPC_SPECS.some(s => s.id === teamId);
}
