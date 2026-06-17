import { GameProvider, useGame } from '@/game/state';
import { DebugBridgeMount } from '@/dev/DebugBridgeMount';
import { useCallback, useState } from 'react';
import { SettingsProvider } from '@/game/Settings';
import { OverworldView } from '@/game/OverworldView';
import { LogMessage, createLogMessage } from '@/game/GameLog';

import { MainMenu } from './MainMenu';
import { CharacterSelect } from './CharacterSelect';
import { RunSummary } from './RunSummary';
import { DungeonView } from './DungeonView';
import { BattleView } from './BattleView';

function Game() {
  const { state } = useGame();

  // Unified run log (dungeon + battle + notable UI events)
  const [gameLog, setGameLog] = useState<LogMessage[]>([]);
  const addLog = useCallback((text: string, type: LogMessage['type'] = 'info') => {
    setGameLog(prev => [...prev.slice(-199), createLogMessage(text, type)]);
  }, []);

  // NOTE: The previous Sonner monkey-patch (overwriting toast.success/error/info
  // on mount) was removed while we hunt down the preview-refresh bug. Toasts
  // will appear as normal popups everywhere for now; in-game log routing will
  // be reintroduced via a passive subscription once the refresh source is
  // confirmed.

  switch (state.phase) {
    case 'main_menu':
      return <MainMenu />;
    case 'character_select':
      return <CharacterSelect />;
    case 'dungeon':
      return <DungeonView gameLog={gameLog} addLog={addLog} />;
    case 'battle':
      return <BattleView gameLog={gameLog} addLog={addLog} />;
    case 'defeat':
    case 'run_summary':
      return <RunSummary />;
    case 'overworld':
      return <OverworldView gameLog={gameLog} addLog={addLog} />;
    default:
      return <MainMenu />;
  }
}

export default function Index() {
  return (
    <main>
      <SettingsProvider>
        <GameProvider>
          <DebugBridgeMount />
          <Game />
        </GameProvider>
      </SettingsProvider>
    </main>
  );
}
