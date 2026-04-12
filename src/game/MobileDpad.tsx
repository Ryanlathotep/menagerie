// Mobile D-pad component for touch-based movement

import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileDpadProps {
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function MobileDpad({ onMove }: MobileDpadProps) {
  return (
    <div className="grid grid-cols-3 gap-1 w-36 sm:hidden flex-shrink-0">
      <div />
      <Button 
        size="sm" 
        className="h-11 w-full text-lg font-bold active:scale-95 transition-transform"
        onClick={() => onMove('up')}
      >
        <ChevronUp className="w-6 h-6" />
      </Button>
      <div />
      <Button 
        size="sm" 
        className="h-11 w-full text-lg font-bold active:scale-95 transition-transform"
        onClick={() => onMove('left')}
      >
        <ChevronLeft className="w-6 h-6" />
      </Button>
      <div />
      <Button 
        size="sm" 
        className="h-11 w-full text-lg font-bold active:scale-95 transition-transform"
        onClick={() => onMove('right')}
      >
        <ChevronRight className="w-6 h-6" />
      </Button>
      <div />
      <Button 
        size="sm" 
        className="h-11 w-full text-lg font-bold active:scale-95 transition-transform"
        onClick={() => onMove('down')}
      >
        <ChevronDown className="w-6 h-6" />
      </Button>
      <div />
    </div>
  );
}
