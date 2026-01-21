import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SPECIES_DATA, SpeciesType, ClassType, ElementType, getComboId } from '@/game/types';
import { createMonster } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy } from '@/game/dungeon';
import { useEffect, useCallback, useState } from 'react';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';
import { GameSidebar } from '@/game/GameSidebar';
import { getMonsterMoves, Move } from '@/game/moves';

// Main Menu Component
function MainMenu() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Monster Roguelike
        </h1>
        <p className="text-muted-foreground text-lg">Play as the monsters. Unlock them all.</p>
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-64 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'character_select' })}
          >
            ✨ Start Run
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mt-8 space-y-1">
          <p>🔓 Unlocked: {state.saveData.unlockedCombos.length} / 500 monsters</p>
          <p>🏔️ Highest Floor: {state.saveData.highestFloor}</p>
          <p>🎮 Total Runs: {state.saveData.totalRuns}</p>
        </div>
      </div>
    </div>
  );
}

// Character Select Component
function CharacterSelect() {
  const { state, dispatch } = useGame();
  const classes: ClassType[] = ['kinetic', 'energy', 'biological', 'chemical', 'political'];
  const elements: ElementType[] = ['fire', 'water', 'earth', 'air', 'void'];
  
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesType | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType>('fire');
  const [selectedClass, setSelectedClass] = useState<ClassType>('kinetic');

  const startRun = () => {
    if (!selectedSpecies) return;
    const monster = createMonster(selectedSpecies, selectedClass, selectedElement, 1);
    dispatch({ type: 'START_RUN', monster });
  };

  return (
    <div className="game-container">
      <div className="space-y-6 max-w-4xl">
        <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Choose Your Monster
        </h2>
        
        {/* Species selection */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Species</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {state.saveData.unlockedSpecies.map((species) => (
              <Card 
                key={species}
                className={`p-3 cursor-pointer transition-all ${selectedSpecies === species ? 'ring-2 ring-primary bg-primary/10' : 'hover:border-primary/50'}`}
                onClick={() => setSelectedSpecies(species)}
              >
                <div className="text-center">
                  <div className="flex justify-center mb-1">
                    <MonsterSprite species={species} element={selectedElement} classType={selectedClass} size={40} animated={false} />
                  </div>
                  <p className="text-xs font-medium">{SPECIES_DATA[species].name}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
        
        {/* Element selection */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Element</h3>
          <div className="flex gap-2 flex-wrap">
            {elements.map((element) => (
              <button
                key={element}
                className={`element-badge element-${element} ${selectedElement === element ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => setSelectedElement(element)}
              >
                {element}
              </button>
            ))}
          </div>
        </div>
        
        {/* Class selection */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Class</h3>
          <div className="flex gap-2 flex-wrap">
            {classes.map((c) => (
              <button
                key={c}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedClass === c 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80'
                }`}
                onClick={() => setSelectedClass(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        
        {/* Preview */}
        {selectedSpecies && (
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <MonsterSprite species={selectedSpecies} element={selectedElement} classType={selectedClass} size={80} />
              <div>
                <h3 className="font-bold text-lg">{SPECIES_DATA[selectedSpecies].name}</h3>
                <p className="text-sm text-muted-foreground mb-2">{SPECIES_DATA[selectedSpecies].passiveDescription}</p>
                <div className="flex gap-2">
                  <span className={`element-badge element-${selectedElement} text-xs`}>{selectedElement}</span>
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{selectedClass}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}
          >
            Back
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-primary to-secondary"
            disabled={!selectedSpecies}
            onClick={startRun}
          >
            Start Adventure! ✨
          </Button>
        </div>
      </div>
    </div>
  );
}

// Dungeon View Component
function DungeonView() {
  const { state, dispatch } = useGame();
  const dungeon = state.run?.dungeon;
  const [experience, setExperience] = useState(0);
  const experienceToNext = 100 * (state.run?.currentMonster.level || 1);

  useEffect(() => {
    if (!dungeon) {
      const newDungeon = generateDungeon(1);
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
    }
  }, [dungeon, dispatch]);

  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!dungeon) return;
    
    const result = movePlayer(dungeon, direction);
    dispatch({ type: 'SET_DUNGEON', dungeon: result.dungeon });

    if (result.encounter) {
      dispatch({ type: 'START_BATTLE', enemy: result.encounter });
    } else if (result.treasure) {
      dispatch({ type: 'ADD_GOLD', amount: 10 + Math.floor(Math.random() * 20) });
    } else if (result.stairs) {
      const newDungeon = generateDungeon(dungeon.floor + 1);
      dispatch({ type: 'SET_DUNGEON', dungeon: newDungeon });
    }
  }, [dungeon, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') handleMove('up');
      if (e.key === 'ArrowDown' || e.key === 's') handleMove('down');
      if (e.key === 'ArrowLeft' || e.key === 'a') handleMove('left');
      if (e.key === 'ArrowRight' || e.key === 'd') handleMove('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  const handleFlee = () => {
    dispatch({ type: 'END_RUN', victory: false });
    dispatch({ type: 'SET_PHASE', phase: 'run_summary' });
  };

  if (!dungeon) return <div className="game-container">Loading...</div>;

  return (
    <>
      <GameSidebar 
        monster={state.run?.currentMonster || null}
        gold={state.run?.gold || 0}
        floor={dungeon.floor}
        onFlee={handleFlee}
        experience={experience}
        experienceToNext={experienceToNext}
      />
      
      <div className="game-container pl-20">
        <div className="flex flex-col items-center gap-4">
          <DungeonRenderer 
            dungeon={dungeon} 
            playerElement={state.run?.currentMonster.element || 'fire'}
            playerSpecies={state.run?.currentMonster.species}
          />

          {/* Mobile controls */}
          <div className="grid grid-cols-3 gap-2 w-32 sm:hidden">
            <div />
            <Button size="sm" onClick={() => handleMove('up')}>↑</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('left')}>←</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('right')}>→</Button>
            <div />
            <Button size="sm" onClick={() => handleMove('down')}>↓</Button>
            <div />
          </div>

          <p className="text-muted-foreground text-sm hidden sm:block">Use WASD or Arrow keys to move</p>
        </div>
      </div>
    </>
  );
}

// Battle View Component
function BattleView() {
  const { state, dispatch } = useGame();
  const battle = state.run?.battle;
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);

  if (!battle) return null;

  const playerMoves = getMonsterMoves(
    battle.playerMonster.species,
    battle.playerMonster.element,
    battle.playerMonster.class
  );

  const executeMove = (move: Move) => {
    // Calculate damage based on move type
    let damage = move.power;
    if (move.type === 'melee') {
      damage = Math.floor(move.power * (battle.playerMonster.stats.attack / 20));
    } else if (move.type === 'ranged') {
      damage = Math.floor(move.power * (battle.playerMonster.stats.special / 20));
    }
    
    // Apply accuracy check
    const hitRoll = Math.random() * 100;
    if (hitRoll > move.accuracy) {
      dispatch({ 
        type: 'UPDATE_BATTLE', 
        battle: { log: [...battle.log, `${move.name} missed!`] }
      });
      return;
    }
    
    const newEnemyHp = Math.max(0, battle.enemyMonster.stats.currentHp - damage);
    
    if (newEnemyHp <= 0) {
      // Victory - unlock this specific monster combo
      const comboId = getComboId({
        species: battle.enemyMonster.species,
        element: battle.enemyMonster.element,
        classType: battle.enemyMonster.class,
      });
      dispatch({ type: 'UNLOCK_COMBO', comboId });
      dispatch({ type: 'UNLOCK_SPECIES', species: battle.enemyMonster.species });
      
      if (state.run?.dungeon) {
        const updatedDungeon = removeEnemy(state.run.dungeon, battle.enemyMonster.id);
        dispatch({ type: 'SET_DUNGEON', dungeon: updatedDungeon });
      }
      dispatch({ type: 'END_BATTLE', victory: true });
      dispatch({ type: 'ADD_GOLD', amount: 5 + battle.enemyMonster.level * 3 });
    } else {
      // Enemy turn
      const enemyDamage = Math.floor(5 + Math.random() * 8);
      const newPlayerHp = Math.max(0, battle.playerMonster.stats.currentHp - enemyDamage);
      
      if (newPlayerHp <= 0) {
        dispatch({ type: 'END_BATTLE', victory: false });
        dispatch({ type: 'END_RUN', victory: false });
      } else {
        dispatch({ 
          type: 'UPDATE_BATTLE', 
          battle: {
            enemyMonster: { ...battle.enemyMonster, stats: { ...battle.enemyMonster.stats, currentHp: newEnemyHp }},
            playerMonster: { ...battle.playerMonster, stats: { ...battle.playerMonster.stats, currentHp: newPlayerHp }},
            log: [...battle.log, `${move.name} dealt ${damage} damage!`, `Enemy dealt ${enemyDamage} damage!`],
          }
        });
      }
    }
    setSelectedMove(null);
  };

  return (
    <>
      <GameSidebar 
        monster={state.run?.currentMonster || null}
        gold={state.run?.gold || 0}
        floor={state.run?.dungeon?.floor || 1}
        inBattle={true}
      />
      
      <div className="game-container pl-20">
        <div className="space-y-4 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
            ⚔️ Battle!
          </h2>
          
          {/* Enemy */}
          <Card className="p-4">
            <div className="flex items-center gap-4 mb-2">
              <MonsterSprite 
                species={battle.enemyMonster.species}
                element={battle.enemyMonster.element}
                classType={battle.enemyMonster.class}
                size={64}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{battle.enemyMonster.name}</span>
                  <span className={`element-badge element-${battle.enemyMonster.element} text-xs`}>
                    {battle.enemyMonster.element}
                  </span>
                </div>
                <div className="health-bar">
                  <div 
                    className="health-bar-fill" 
                    style={{ width: `${(battle.enemyMonster.stats.currentHp / battle.enemyMonster.stats.maxHp) * 100}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{battle.enemyMonster.stats.currentHp} / {battle.enemyMonster.stats.maxHp}</p>
              </div>
            </div>
          </Card>

          {/* Player */}
          <Card className="p-4 border-2 border-primary/50">
            <div className="flex items-center gap-4 mb-2">
              <MonsterSprite 
                species={battle.playerMonster.species}
                element={battle.playerMonster.element}
                classType={battle.playerMonster.class}
                size={64}
              />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">{battle.playerMonster.name}</span>
                  <span className={`element-badge element-${battle.playerMonster.element} text-xs`}>
                    {battle.playerMonster.element}
                  </span>
                </div>
                <div className="health-bar">
                  <div 
                    className="health-bar-fill" 
                    style={{ width: `${(battle.playerMonster.stats.currentHp / battle.playerMonster.stats.maxHp) * 100}%` }}
                  />
                </div>
                <p className="text-xs mt-1">{battle.playerMonster.stats.currentHp} / {battle.playerMonster.stats.maxHp}</p>
              </div>
            </div>
          </Card>

          {/* Move selection */}
          <div className="grid grid-cols-2 gap-2">
            {playerMoves.slice(0, 6).map((move) => (
              <Button 
                key={move.id}
                variant={selectedMove?.id === move.id ? 'default' : 'outline'}
                className="h-auto py-2 px-3 text-left justify-start"
                onClick={() => executeMove(move)}
              >
                <div>
                  <p className="font-semibold text-sm">{move.name}</p>
                  <p className="text-[10px] opacity-70">
                    {move.power > 0 ? `⚔️${move.power} ` : ''} 🎯{move.accuracy}%
                  </p>
                </div>
              </Button>
            ))}
          </div>

          {/* Battle log */}
          <div className="bg-muted rounded-lg p-3 text-xs max-h-24 overflow-y-auto">
            {battle.log.slice(-4).map((msg, i) => <p key={i}>{msg}</p>)}
          </div>
        </div>
      </div>
    </>
  );
}

// Run Summary Component
function RunSummary() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <Card className="p-8 text-center space-y-4 max-w-md">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
          Run Over
        </h2>
        <div className="space-y-2 text-muted-foreground">
          <p>⚔️ Enemies Defeated: {state.run?.enemiesDefeated}</p>
          <p>🏔️ Floor Reached: {state.run?.dungeon?.floor || 1}</p>
          <p>💰 Gold Collected: {state.run?.gold}</p>
          <p>🔓 Monsters Unlocked: {state.saveData.unlockedCombos.length}</p>
        </div>
        <Button 
          className="w-full bg-gradient-to-r from-primary to-secondary"
          onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}
        >
          Return to Menu
        </Button>
      </Card>
    </div>
  );
}

// Game Component
function Game() {
  const { state } = useGame();

  switch (state.phase) {
    case 'main_menu': return <MainMenu />;
    case 'character_select': return <CharacterSelect />;
    case 'dungeon': return <DungeonView />;
    case 'battle': return <BattleView />;
    case 'defeat':
    case 'run_summary': return <RunSummary />;
    default: return <MainMenu />;
  }
}

export default function Index() {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  );
}