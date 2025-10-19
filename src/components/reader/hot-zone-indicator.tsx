import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import type { HotZone } from '@/hooks/use-reader-controls';

interface HotZoneIndicatorProps {
  zone: HotZone;
}

export function HotZoneIndicator({ zone }: HotZoneIndicatorProps) {
  if (!zone || zone === 'center') return null;

  const getIndicatorConfig = () => {
    switch (zone) {
      case 'left':
        return {
          icon: ChevronLeft,
          position: 'left-0 top-0 bottom-0',
          gradient: 'bg-gradient-to-r from-black/30 via-black/10 to-transparent',
          iconPosition: 'left-12',
        };
      case 'right':
        return {
          icon: ChevronRight,
          position: 'right-0 top-0 bottom-0',
          gradient: 'bg-gradient-to-l from-black/30 via-black/10 to-transparent',
          iconPosition: 'right-12',
        };
      case 'top':
        return {
          icon: ChevronUp,
          position: 'top-0 left-0 right-0',
          gradient: 'bg-gradient-to-b from-black/30 via-black/10 to-transparent',
          iconPosition: 'top-12',
        };
      case 'bottom':
        return {
          icon: ChevronDown,
          position: 'bottom-0 left-0 right-0',
          gradient: 'bg-gradient-to-t from-black/30 via-black/10 to-transparent',
          iconPosition: 'bottom-12',
        };
      default:
        return null;
    }
  };

  const config = getIndicatorConfig();
  if (!config) return null;

  const Icon = config.icon;
  const isHorizontal = zone === 'left' || zone === 'right';

  return (
    <div
      className={`fixed ${config.position} ${config.gradient} pointer-events-none z-[100] transition-all duration-200 ease-out`}
      style={{
        width: isHorizontal ? '25%' : '100%',
        height: isHorizontal ? '100%' : '25%',
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)', // Safari support
      }}
    >
      {/* Animated arrow indicator */}
      <div className={`absolute ${config.iconPosition} ${isHorizontal ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2'}
        animate-in fade-in slide-in-from-${zone === 'left' ? 'left' : zone === 'right' ? 'right' : zone === 'top' ? 'top' : 'bottom'}-2
        duration-200`}>
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-white/20 blur-lg" />

          {/* Arrow container */}
          <div className="relative bg-gradient-to-br from-white/95 to-white/85 backdrop-blur-sm rounded-xl p-2.5 shadow-lg border border-white/30">
            <Icon className="w-7 h-7 text-gray-900" strokeWidth={2.5} />
          </div>
        </div>

        {/* Helper text */}
        <div className={`absolute ${isHorizontal ? 'top-full mt-2' : 'left-full ml-2'} whitespace-nowrap`}>
          <div className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-white text-xs font-medium shadow-xl border border-white/10">
            Click to {zone === 'left' || zone === 'top' ? 'go back' : 'go forward'}
          </div>
        </div>
      </div>
    </div>
  );
}
