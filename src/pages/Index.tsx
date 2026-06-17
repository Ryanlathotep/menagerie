import { GameProvider, useGame, buildProgressSnapshot } from '@/game/state';
import { DebugBridgeMount } from '@/dev/DebugBridgeMount';
import { useEffect, useCallback, useState, useRef } from 'react';
import { toast } from 'sonner';
import { SettingsProvider } from '@/game/Settings';
import { OverworldView } from '@/game/OverworldView';
import { LogMessage, createLogMessage, parseLogMessage } from '@/game/GameLog';

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

  // Route Sonner toasts: during gameplay (dungeon/battle/overworld/defeat/summary)
  // push to the in-game log ONLY (no popup). Outside gameplay (menus, auth) show normally.
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;
  useEffect(() => {
    const originalSuccess = toast.success;
    const originalError = toast.error;
    const originalInfo = (toast as any).info;

    const inGame = () => {
      const p = phaseRef.current;
      return p === 'dungeon' || p === 'battle' || p === 'overworld' || p === 'defeat' || p === 'run_summary';
    };

    toast.success = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      if (!inGame()) return originalSuccess(message, options);
      return '' as any;
    }) as any;

    toast.error = ((message: any, options?: any) => {
      const parsed = parseLogMessage(String(message));
      addLog(parsed.text, parsed.type);
      if (!inGame()) return originalError(message, options);
      return '' as any;
    }) as any;

    if (typeof originalInfo === 'function') {
      (toast as any).info = (message: any, options?: any) => {
        const parsed = parseLogMessage(String(message));
        addLog(parsed.text, parsed.type);
        if (!inGame()) return originalInfo(message, options);
        return '' as any;
      };
    }

    return () => {
      toast.success = originalSuccess;
      toast.error = originalError;
      if (typeof originalInfo === 'function') {
        (toast as any).info = originalInfo;
      }
    };
  }, [addLog]);

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
