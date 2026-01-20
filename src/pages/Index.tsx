import { GameProvider, useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SPECIES_DATA, SpeciesType, ClassType, ElementType } from '@/game/types';
import { createMonster } from '@/game/utils';
import { generateDungeon, movePlayer, removeEnemy } from '@/game/dungeon';
import { useEffect, useCallback } from 'react';
import { MonsterSprite } from '@/game/sprites';
import { DungeonRenderer } from '@/game/DungeonRenderer';

// Main Menu Component
function MainMenu() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <div className="text-center space-y-8">
        <h1 className="text-5xl font-bold text-primary">Monster Roguelike</h1>
        <p className="text-muted-foreground text-lg">Play as the monsters. Unlock them all.</p>
        
        <div className="space-y-4">
          <Button 
            size="lg" 
            className="w-64"
            onClick={() => dispatch({ type: 'SET_PHASE', phase: 'character_select' })}
          >
            Start Run
          </Button>
        </div>

        <div className="text-sm text-muted-foreground mt-8">
          <p>Unlocked: {state.saveData.unlockedSpecies.length} / 20 species</p>
          <p>Highest Floor: {state.saveData.highestFloor}</p>
          <p>Total Runs: {state.saveData.totalRuns}</p>
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

  const startRun = (species: SpeciesType) => {
    const classType = classes[Math.floor(Math.random() * classes.length)];
    const element = elements[Math.floor(Math.random() * elements.length)];
    const monster = createMonster(species, classType, element, 1);
    dispatch({ type: 'START_RUN', monster });
  };

  return (
    <div className="game-container">
      <div className="space-y-6 max-w-4xl">
        <h2 className="text-3xl font-bold text-center text-primary">Choose Your Monster</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {state.saveData.unlockedSpecies.map((species) => (
            <Card 
              key={species}
              className="p-4 cursor-pointer hover:border-primary transition-colors"
              onClick={() => startRun(species)}
            >
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <MonsterSprite species={species} element="fire" classType="kinetic" size={48} animated={false} />
                </div>
                <h3 className="font-semibold">{SPECIES_DATA[species].name}</h3>
                <p className="text-xs text-muted-foreground">{SPECIES_DATA[species].passiveAbility}</p>
              </div>
            </Card>
          ))}
        </div>

        <Button 
          variant="outline" 
          onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}
        >
          Back
        </Button>
      </div>
    </div>
  );
}

// Dungeon View Component
function DungeonView() {
  const { state, dispatch } = useGame();
  const dungeon = state.run?.dungeon;

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

  if (!dungeon) return <div className="game-container">Loading...</div>;

  return (
    <div className="game-container">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Dungeon grid */}
        <DungeonRenderer 
          dungeon={dungeon} 
          playerElement={state.run?.currentMonster.element || 'fire'} 
        />
        
        {/* Side panel */}
        <div className="space-y-3 w-full lg:w-64">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <MonsterSprite 
                species={state.run?.currentMonster.species || 'slime'}
                element={state.run?.currentMonster.element || 'fire'}
                classType={state.run?.currentMonster.class || 'kinetic'}
                size={40}
                animated={false}
              />
              <div className="flex-1">
                <p className="text-sm font-semibold truncate">{state.run?.currentMonster.name}</p>
                <p className="text-xs text-muted-foreground">Lv.{state.run?.currentMonster.level}</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-primary font-mono">💰 {state.run?.gold}</div>
          </Card>
        </div>
      </div>

      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-2 w-32 mx-auto sm:hidden mt-4">
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

      <p className="text-muted-foreground text-sm hidden sm:block mt-4">Use WASD or Arrow keys to move</p>
    </div>
  );
}

// Battle View Component
function BattleView() {
  const { state, dispatch } = useGame();
  const battle = state.run?.battle;

  if (!battle) return null;

  const attack = () => {
    const damage = Math.floor(10 + Math.random() * 10);
    const newEnemyHp = Math.max(0, battle.enemyMonster.stats.currentHp - damage);
    
    if (newEnemyHp <= 0) {
      // Victory - unlock species
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
            log: [...battle.log, `You dealt ${damage} damage!`, `Enemy dealt ${enemyDamage} damage!`],
          }
        });
      }
    }
  };

  return (
    <div className="game-container">
      <div className="space-y-6 max-w-lg w-full">
        <h2 className="text-2xl font-bold text-center">Battle!</h2>
        
        {/* Enemy */}
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <MonsterSprite 
                species={battle.enemyMonster.species}
                element={battle.enemyMonster.element}
                classType={battle.enemyMonster.class}
                size={48}
              />
              <span className="font-semibold">{battle.enemyMonster.name}</span>
            </div>
            <span className={`element-badge element-${battle.enemyMonster.element}`}>
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
        </Card>

        {/* Player */}
        <Card className="p-4 border-primary">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <MonsterSprite 
                species={battle.playerMonster.species}
                element={battle.playerMonster.element}
                classType={battle.playerMonster.class}
                size={48}
              />
              <span className="font-semibold">{battle.playerMonster.name}</span>
            </div>
            <span className={`element-badge element-${battle.playerMonster.element}`}>
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
        </Card>

        <Button className="w-full" onClick={attack}>Attack</Button>

        <div className="bg-muted rounded p-2 text-xs max-h-24 overflow-y-auto">
          {battle.log.slice(-4).map((msg, i) => <p key={i}>{msg}</p>)}
        </div>
      </div>
    </div>
  );
}

// Run Summary Component
function RunSummary() {
  const { state, dispatch } = useGame();

  return (
    <div className="game-container">
      <Card className="p-8 text-center space-y-4">
        <h2 className="text-3xl font-bold text-destructive">Run Over</h2>
        <p>Enemies Defeated: {state.run?.enemiesDefeated}</p>
        <p>Floor Reached: {state.run?.dungeon?.floor || 1}</p>
        <p>Gold Collected: {state.run?.gold}</p>
        <Button onClick={() => dispatch({ type: 'SET_PHASE', phase: 'main_menu' })}>
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