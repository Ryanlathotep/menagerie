import { useEffect, useState } from 'react';
import { useGame } from '@/game/state';
import { submitDiscoveryCount, submitExplorationCount } from '@/hooks/useUsername';
import { countExploredTiles } from '@/game/overworld';
import { createMonster } from '@/game/utils';
import { MonsterEquipment } from '@/game/equipment';
import { InventoryItem } from '@/game/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MonsterSprite } from '@/game/sprites';
import { MonsterStatsPreview } from '@/game/MonsterStatsPreview';
import { PreRunEquipment } from '@/game/PreRunEquipment';
import { PartyAnalyzer } from '@/game/PartyAnalyzer';
import { isCreativeMode } from '@/game/creativeMode';
import { toast } from 'sonner';

type SortOption = 'recent' | 'species' | 'element' | 'class' | 'level';

export function CharacterSelect() {
  const { state, dispatch } = useGame();
  const unlockedMonsters = state.saveData.unlockedMonsters || [];

  const currentWorldSeed = state.saveData?.overworldState?.worldSeed ?? null;
  useEffect(() => {
    void submitDiscoveryCount(unlockedMonsters.length, currentWorldSeed);
  }, [unlockedMonsters.length, currentWorldSeed]);

  const exploredTileCount = countExploredTiles(state.saveData?.overworldState);
  useEffect(() => {
    if (exploredTileCount > 0) {
      void submitExplorationCount(exploredTileCount, currentWorldSeed);
    }
  }, [exploredTileCount, currentWorldSeed]);

  const [selectedParty, setSelectedParty] = useState<typeof unlockedMonsters>(() => {
    try {
      const saved = localStorage.getItem('menagerie_last_party');
      if (saved) {
        const savedIds: string[] = JSON.parse(saved);
        return savedIds
          .map(id => unlockedMonsters.find(m => m.comboId === id))
          .filter(Boolean) as typeof unlockedMonsters;
      }
    } catch {}
    return [];
  });
  const [previewMonster, setPreviewMonster] = useState<typeof unlockedMonsters[0] | null>(
    unlockedMonsters.length > 0 ? unlockedMonsters[0] : null,
  );

  const [sortBy, setSortBy] = useState<SortOption>(() => {
    try {
      const saved = localStorage.getItem('menagerie_party_sort');
      if (saved && ['recent', 'species', 'element', 'class', 'level'].includes(saved)) {
        return saved as SortOption;
      }
    } catch {}
    return 'recent';
  });

  const [showEquipmentSelect, setShowEquipmentSelect] = useState(false);
  const [partyForRun, setPartyForRun] = useState<ReturnType<typeof createMonster>[]>([]);

  useEffect(() => {
    localStorage.setItem('menagerie_last_party', JSON.stringify(selectedParty.map(m => m.comboId)));
  }, [selectedParty]);

  useEffect(() => {
    localStorage.setItem('menagerie_party_sort', sortBy);
  }, [sortBy]);

  const MAX_PARTY_SIZE = 6;

  const sortedMonsters = [...unlockedMonsters].sort((a, b) => {
    switch (sortBy) {
      case 'species':
        return a.species.localeCompare(b.species);
      case 'element':
        return a.element.localeCompare(b.element);
      case 'class':
        return a.classType.localeCompare(b.classType);
      case 'level':
        return b.level - a.level;
      case 'recent':
      default:
        return unlockedMonsters.indexOf(b) - unlockedMonsters.indexOf(a);
    }
  });

  const togglePartyMember = (monster: typeof unlockedMonsters[0]) => {
    setPreviewMonster(monster);
    const isSelected = selectedParty.some(m => m.comboId === monster.comboId);
    if (isSelected) {
      setSelectedParty(prev => prev.filter(m => m.comboId !== monster.comboId));
    } else if (selectedParty.length < MAX_PARTY_SIZE) {
      setSelectedParty(prev => [...prev, monster]);
    }
  };

  const proceedToEquipment = () => {
    if (selectedParty.length === 0) return;
    const monsters = selectedParty.map(m => {
      const saved = state.saveData.unlockedMonsters.find(u => u.comboId === m.comboId);
      return createMonster(
        m.species,
        m.classType,
        m.element,
        saved?.level ?? m.level,
        saved?.equipment,
        saved?.experience,
        saved?.moveMastery,
      );
    });
    setPartyForRun(monsters);
    setShowEquipmentSelect(true);
  };

  const runDestination = (localStorage.getItem('menagerie_run_destination') || 'dungeon') as 'dungeon' | 'overworld';

  const startRun = (
    partyEquipment: MonsterEquipment[],
    withdrawnIds: string[],
    selectedItems: InventoryItem[],
    selectedStartFloor?: number,
  ) => {
    if (partyForRun.length === 0) return;
    if (typeof window !== 'undefined') {
      if (selectedStartFloor && selectedStartFloor > 0) {
        localStorage.setItem('menagerie_selected_start_floor', String(selectedStartFloor));
      } else {
        localStorage.removeItem('menagerie_selected_start_floor');
      }
    }
    dispatch({
      type: 'START_RUN',
      monster: partyForRun[0],
      party: partyForRun,
      partyPreEquipped: partyEquipment,
      withdrawnIds,
      preSelectedItems: selectedItems,
      destination: runDestination,
    });
  };

  const activeDungeonIdForPrep = typeof window !== 'undefined'
    ? localStorage.getItem('menagerie_active_dungeon_id')
    : null;
  const activeEntranceForPrep = activeDungeonIdForPrep
    ? state.saveData.dungeonEntrances?.[activeDungeonIdForPrep]
    : undefined;
  const entranceFloorForPrep = runDestination === 'dungeon'
    ? Math.max(1, activeEntranceForPrep?.difficulty ?? 1)
    : undefined;
  const highestMonsterLevelEver = state.saveData.unlockedMonsters.reduce(
    (max, m) => Math.max(max, m.level ?? 1),
    1,
  );
  const maxStartFloorForPrep = entranceFloorForPrep !== undefined
    ? entranceFloorForPrep + Math.floor(highestMonsterLevelEver / 2)
    : undefined;

  if (showEquipmentSelect && partyForRun.length > 0) {
    const isHomeTower = activeEntranceForPrep?.isHome === true;
    const ownedScrollCount = (state.saveData.storedItems || [])
      .filter(i => i.id === 'town_portal_scroll')
      .reduce((sum, i) => sum + (i.quantity || 1), 0);
    const TOWN_PORTAL_PRICE = 80;
    return (
      <PreRunEquipment
        party={partyForRun}
        storedEquipment={state.saveData.storedEquipment || []}
        storedItems={state.saveData.storedItems || []}
        entranceFloor={entranceFloorForPrep}
        maxStartFloor={maxStartFloorForPrep}
        isHomeTower={runDestination === 'dungeon' ? isHomeTower : undefined}
        townGold={state.saveData.gold || 0}
        townPortalScrollPrice={TOWN_PORTAL_PRICE}
        ownedScrollCount={ownedScrollCount}
        onBuyTownPortalScroll={() => {
          if (!isCreativeMode()) {
            dispatch({ type: 'SPEND_TOWN_GOLD', amount: TOWN_PORTAL_PRICE });
          }
          dispatch({
            type: 'STORE_ITEM',
            item: { id: 'town_portal_scroll', name: 'Town Portal Scroll', quantity: 1, type: 'potion', effect: 'town_portal', value: 0 },
          });
          toast.success('Bought Town Portal Scroll!');
        }}
        onStart={startRun}
        onBack={() => setShowEquipmentSelect(false)}
      />
    );
  }

  const partyOrder = selectedParty.map(m => m.comboId);

  return (
    <div className="min-h-screen w-full bg-background flex flex-col p-4">
      <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto space-y-4">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Build Your Party {runDestination === 'overworld' ? '🗺️' : '🗼'}
        </h2>

        <p className="text-center text-muted-foreground text-sm">
          Select up to {MAX_PARTY_SIZE} monsters for your party. Click to add/remove, right-click to preview.
        </p>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold">Party ({selectedParty.length}/{MAX_PARTY_SIZE})</h3>
            {selectedParty.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedParty([])}>
                Clear
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: MAX_PARTY_SIZE }).map((_, i) => {
              const member = selectedParty[i];
              return (
                <div
                  key={i}
                  className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                    member ? 'border-primary bg-primary/10 cursor-pointer' : 'border-muted-foreground/30'
                  }`}
                  onClick={() => member && togglePartyMember(member)}
                >
                  {member ? (
                    <div className="text-center">
                      <MonsterSprite species={member.species} element={member.element} classType={member.classType} size={36} animated={false} />
                      <p className="text-[8px] text-muted-foreground">Lv.{member.level}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-lg">+</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {previewMonster && (
          <Card className="p-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-2">
                <MonsterSprite
                  species={previewMonster.species}
                  element={previewMonster.element}
                  classType={previewMonster.classType}
                  size={100}
                />
                <h3 className="font-bold text-lg capitalize text-center">
                  {previewMonster.species}
                </h3>
                <div className="flex gap-1 flex-wrap justify-center">
                  <span className={`element-badge element-${previewMonster.element} text-xs`}>
                    {previewMonster.element}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    {previewMonster.classType}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Level {previewMonster.level}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <MonsterStatsPreview
                  species={previewMonster.species}
                  classType={previewMonster.classType}
                  element={previewMonster.element}
                  level={previewMonster.level}
                />

                <div className="mt-3 p-2 bg-muted/50 rounded text-[10px] space-y-1">
                  <div>
                    <span className="font-medium">Class: </span>
                    {previewMonster.classType === 'normal' && 'No strengths or weaknesses'}
                    {previewMonster.classType === 'kinetic' && (
                      <><span className="text-green-600">Strong vs Energy/Bio</span> · <span className="text-red-500">Weak vs Chem/Pol</span></>
                    )}
                    {previewMonster.classType === 'energy' && (
                      <><span className="text-green-600">Strong vs Bio/Chem</span> · <span className="text-red-500">Weak vs Pol/Kin</span></>
                    )}
                    {previewMonster.classType === 'biological' && (
                      <><span className="text-green-600">Strong vs Chem/Pol</span> · <span className="text-red-500">Weak vs Kin/Energy</span></>
                    )}
                    {previewMonster.classType === 'chemical' && (
                      <><span className="text-green-600">Strong vs Pol/Kin</span> · <span className="text-red-500">Weak vs Energy/Bio</span></>
                    )}
                    {previewMonster.classType === 'political' && (
                      <><span className="text-green-600">Strong vs Kin/Energy</span> · <span className="text-red-500">Weak vs Bio/Chem</span></>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Element: </span>
                    {previewMonster.element === 'normal' && 'No strengths or weaknesses'}
                    {previewMonster.element === 'fire' && (
                      <><span className="text-green-600">Strong vs Air/Earth</span> · <span className="text-red-500">Weak vs Water/Void</span></>
                    )}
                    {previewMonster.element === 'water' && (
                      <><span className="text-green-600">Strong vs Fire/Void</span> · <span className="text-red-500">Weak vs Earth/Air</span></>
                    )}
                    {previewMonster.element === 'earth' && (
                      <><span className="text-green-600">Strong vs Water/Air</span> · <span className="text-red-500">Weak vs Fire/Void</span></>
                    )}
                    {previewMonster.element === 'air' && (
                      <><span className="text-green-600">Strong vs Void/Water</span> · <span className="text-red-500">Weak vs Fire/Earth</span></>
                    )}
                    {previewMonster.element === 'void' && (
                      <><span className="text-green-600">Strong vs Fire/Earth</span> · <span className="text-red-500">Weak vs Water/Air</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-col min-h-0 max-h-[40vh] overflow-hidden">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Unlocked Monsters ({unlockedMonsters.length})
            </h3>

            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Sort:</span>
              {(['recent', 'species', 'element', 'class', 'level'] as SortOption[]).map(option => (
                <Button
                  key={option}
                  variant={sortBy === option ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs capitalize"
                  onClick={() => setSortBy(option)}
                >
                  {option === 'recent' ? '🕐' : option === 'species' ? '🐾' : option === 'element' ? '🔥' : option === 'class' ? '⚔️' : '📈'}
                  <span className="ml-1 hidden sm:inline">{option}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none">
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {sortedMonsters.map(monster => {
                const isInParty = selectedParty.some(m => m.comboId === monster.comboId);
                const partyIndex = partyOrder.indexOf(monster.comboId);
                return (
                  <Card
                    key={monster.comboId}
                    className={`p-2 cursor-pointer transition-all relative ${
                      isInParty
                        ? 'ring-2 ring-primary bg-primary/10'
                        : previewMonster?.comboId === monster.comboId
                          ? 'border-primary/50'
                          : 'hover:border-primary/50'
                    }`}
                    onClick={() => togglePartyMember(monster)}
                    onContextMenu={(e) => { e.preventDefault(); setPreviewMonster(monster); }}
                  >
                    {isInParty && (
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {partyIndex + 1}
                      </span>
                    )}
                    <div className="text-center">
                      <div className="flex justify-center mb-1">
                        <MonsterSprite species={monster.species} element={monster.element} classType={monster.classType} size={40} animated={false} />
                      </div>
                      <p className="text-[10px] font-medium capitalize truncate">{monster.species}</p>
                      <div className="flex gap-0.5 justify-center mt-0.5 flex-wrap">
                        <span className={`element-badge element-${monster.element} text-[8px] px-1 py-0`}>
                          {monster.element}
                        </span>
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-0.5">
                        Lv.{monster.level} • {monster.classType}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}>
            Back
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-primary to-secondary" disabled={selectedParty.length === 0} onClick={proceedToEquipment}>
            {selectedParty.length === 0
              ? 'Select at least 1 monster'
              : state.saveData.storedEquipment?.length > 0
                ? `Equip Party (${selectedParty.length}) →`
                : `Start with ${selectedParty.length} monster${selectedParty.length > 1 ? 's' : ''}! ✨`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
