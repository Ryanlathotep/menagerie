// Move Mastery Display component - shows mastery progress for moves

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  MoveTier, 
  getMasteryProgress, 
  TIER_COLORS, 
  TIER_BG_COLORS, 
  getTierDisplayName,
  MoveMastery,
  TIER_ORDER,
} from './moveMastery';

interface MasteryDisplayProps {
  mastery: MoveMastery | undefined;
  compact?: boolean;
}

export function MasteryDisplay({ mastery, compact = false }: MasteryDisplayProps) {
  const progress = getMasteryProgress(mastery);
  
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Badge 
          variant="outline" 
          className={`text-[10px] px-1 py-0 ${TIER_COLORS[progress.tier]} ${TIER_BG_COLORS[progress.tier]} border-0`}
        >
          {getTierDisplayName(progress.tier)}
        </Badge>
        {progress.hasAoE && (
          <span className="text-[10px] text-amber-500" title="Mass variant unlocked">⚔️</span>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-2 p-2 bg-muted/30 rounded">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Mastery</span>
        <Badge 
          variant="outline" 
          className={`${TIER_COLORS[progress.tier]} ${TIER_BG_COLORS[progress.tier]} border-0`}
        >
          {getTierDisplayName(progress.tier)}
        </Badge>
      </div>
      
      <div className="text-xs text-muted-foreground">
        Uses: {progress.uses}
      </div>
      
      {progress.nextTier && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Next: {getTierDisplayName(progress.nextTier)}</span>
            <span>{progress.usesToNextTier} uses left</span>
          </div>
          <Progress value={progress.percentToNextTier} className="h-1" />
        </div>
      )}
      
      {!progress.hasAoE && (
        <div className="text-[10px] text-muted-foreground">
          🎯 Mass variant in {progress.usesToAoE} uses
        </div>
      )}
      
      {progress.hasAoE && (
        <div className="text-[10px] text-amber-500">
          ⚔️ Mass variant unlocked!
        </div>
      )}
    </div>
  );
}

// Tier badge for use in move lists
export function TierBadge({ tier, size = 'sm' }: { tier: MoveTier; size?: 'sm' | 'xs' }) {
  const sizeClass = size === 'xs' ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5';
  
  return (
    <Badge 
      variant="outline" 
      className={`${sizeClass} ${TIER_COLORS[tier]} ${TIER_BG_COLORS[tier]} border-0`}
    >
      {getTierDisplayName(tier)}
    </Badge>
  );
}

// Shows all unlocked tiers for a move
export function TierUnlockDisplay({ 
  mastery, 
  monsterLevel 
}: { 
  mastery: MoveMastery | undefined; 
  monsterLevel: number 
}) {
  const progress = getMasteryProgress(mastery);
  
  const TIER_LEVEL_REQUIREMENTS: Record<MoveTier, number> = {
    lesser: 1,
    minor: 3,
    base: 6,
    greater: 10,
    omega: 15,
  };
  
  return (
    <div className="flex gap-1 flex-wrap">
      {TIER_ORDER.map((tier) => {
        const masteryUnlocked = progress.uses >= ({
          lesser: 0,
          minor: 10,
          base: 25,
          greater: 50,
          omega: 100,
        }[tier]);
        const levelUnlocked = monsterLevel >= TIER_LEVEL_REQUIREMENTS[tier];
        const isUnlocked = masteryUnlocked && levelUnlocked;
        const isCurrent = tier === progress.tier;
        
        return (
          <Badge 
            key={tier}
            variant="outline" 
            className={`text-[9px] px-1 py-0 ${
              isUnlocked 
                ? `${TIER_COLORS[tier]} ${TIER_BG_COLORS[tier]}` 
                : 'text-muted-foreground/50 bg-muted/20'
            } ${isCurrent ? 'ring-1 ring-primary' : ''} border-0`}
            title={
              !masteryUnlocked 
                ? `Need more uses` 
                : !levelUnlocked 
                  ? `Need level ${TIER_LEVEL_REQUIREMENTS[tier]}` 
                  : 'Unlocked!'
            }
          >
            {getTierDisplayName(tier)}
          </Badge>
        );
      })}
    </div>
  );
}
