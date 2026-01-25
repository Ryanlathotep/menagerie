// Unified Game Log - Works for both dungeon exploration and combat
// Single message system that combines all game events

import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface LogMessage {
  id: string;
  text: string;
  type: 'info' | 'combat' | 'loot' | 'damage' | 'heal' | 'status' | 'system';
  timestamp: number;
}

interface GameLogProps {
  messages: LogMessage[];
  maxHeight?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const TYPE_STYLES: Record<LogMessage['type'], string> = {
  info: 'text-muted-foreground',
  combat: 'text-foreground',
  loot: 'text-amber-400',
  damage: 'text-red-400',
  heal: 'text-green-400',
  status: 'text-purple-400',
  system: 'text-primary',
};

export function GameLog({ messages, maxHeight = '160px', expanded = true, onToggleExpand }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isAtBottom]);
  
  if (!expanded) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-full h-8 text-xs text-muted-foreground"
        onClick={onToggleExpand}
      >
        <ChevronUp className="w-3 h-3 mr-1" />
        Show Log ({messages.length} messages)
      </Button>
    );
  }
  
  return (
    <div className="flex flex-col">
      {onToggleExpand && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full h-6 text-xs text-muted-foreground py-0"
          onClick={onToggleExpand}
        >
          <ChevronDown className="w-3 h-3 mr-1" />
          Hide Log
        </Button>
      )}
      <ScrollArea className="pr-2" style={{ maxHeight }} ref={scrollRef}>
        <div className="space-y-0.5 py-1">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No events yet</p>
          ) : (
            messages.map((msg) => (
              <p 
                key={msg.id} 
                className={`text-xs py-0.5 ${TYPE_STYLES[msg.type]}`}
              >
                {msg.text}
              </p>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Helper to create a log message
let messageCounter = 0;
export function createLogMessage(
  text: string, 
  type: LogMessage['type'] = 'info'
): LogMessage {
  return {
    id: `log_${Date.now()}_${messageCounter++}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

// Parse existing battle log strings into typed messages
export function parseLogMessage(text: string): LogMessage {
  let type: LogMessage['type'] = 'info';
  
  // Detect message type from content
  if (text.includes('damage') || text.includes('hit') || text.includes('attack')) {
    type = 'combat';
  }
  if (text.includes('💀') || text.includes('was defeated')) {
    type = 'damage';
  }
  if (text.includes('Healed') || text.includes('Restored') || text.includes('❤️')) {
    type = 'heal';
  }
  if (text.includes('Found') || text.includes('gold') || text.includes('💰')) {
    type = 'loot';
  }
  if (text.includes('poison') || text.includes('burn') || text.includes('freeze') || 
      text.includes('🟣') || text.includes('🔥') || text.includes('❄️')) {
    type = 'status';
  }
  if (text.includes('appeared') || text.includes('Floor') || text.includes('Descended')) {
    type = 'system';
  }
  
  return createLogMessage(text, type);
}
