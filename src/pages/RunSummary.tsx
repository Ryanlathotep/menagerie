import { useGame } from '@/game/state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function RunSummary() {
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
