// Compact transport bar for the automation loops: mode picker, play/pause and
// 1x / 2x / 4x / 8x speed. Purely presentational — the host view maps
// play/pause onto its own automation loops.

import { Play, Pause, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AUTOMATION_MODE_ICONS, AUTOMATION_MODE_LABELS, AUTOMATION_SPEEDS,
  AutomationMode, AutomationSpeed,
} from './controls';

interface AutomationBarProps {
  modes: AutomationMode[];
  mode: AutomationMode;
  onModeChange: (mode: AutomationMode) => void;
  speed: AutomationSpeed;
  onSpeedChange: (speed: AutomationSpeed) => void;
  running: boolean;
  onPlay: () => void;
  onPause: () => void;
  uninterrupted: boolean;
  onUninterruptedChange: (v: boolean) => void;
  /** Opens the Autoplay rule scripting panel. */
  onOpenScripts?: () => void;
  className?: string;
}

export function AutomationBar({
  modes, mode, onModeChange, speed, onSpeedChange, running, onPlay, onPause,
  uninterrupted, onUninterruptedChange, onOpenScripts, className,
}: AutomationBarProps) {
  const activeMode = modes.includes(mode) ? mode : modes[0];

  return (
    <div className={`flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-card/80 px-1.5 py-1 ${className ?? ''}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={running ? 'destructive' : 'default'}
            className="h-8 w-8 shrink-0"
            onClick={() => (running ? onPause() : onPlay())}
            aria-label={running ? 'Pause automation' : 'Start automation'}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {running ? 'Pause automation' : `Start ${AUTOMATION_MODE_LABELS[activeMode]}`}
        </TooltipContent>
      </Tooltip>

      <Select value={activeMode} onValueChange={(v) => onModeChange(v as AutomationMode)}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[10050]">
          {modes.map(m => (
            <SelectItem key={m} value={m} className="text-xs">
              <span className="mr-1">{AUTOMATION_MODE_ICONS[m]}</span>{AUTOMATION_MODE_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-0.5">
        {AUTOMATION_SPEEDS.map(s => (
          <Button
            key={s}
            size="sm"
            variant={speed === s ? 'default' : 'outline'}
            className="h-8 min-w-[34px] px-1.5 text-xs font-bold"
            onClick={() => onSpeedChange(s as AutomationSpeed)}
            aria-label={`${s}x speed`}
          >
            {s}x
          </Button>
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={uninterrupted ? 'default' : 'outline'}
            className="h-8 px-2 text-xs"
            onClick={() => onUninterruptedChange(!uninterrupted)}
            aria-label="Run uninterrupted"
          >
            ♾️
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          Run uninterrupted: keeps going through stair prompts and cleared fights
        </TooltipContent>
      </Tooltip>

      {onOpenScripts && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              onClick={onOpenScripts}
              aria-label="Script automation behaviour"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Script your own automation behaviour</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
