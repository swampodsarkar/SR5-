import { useEffect, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export function useGamepad(onDirection: (dir: Direction) => void, onSelect: () => void, onPSButton?: () => void) {
  const requestRef = useRef<number>(0);
  const lastPressTime = useRef<Record<string, number>>({ UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0, SELECT: 0, PS: 0 });
  const COOLDOWN = 200; // ms

  useEffect(() => {
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;

      for (const gp of gamepads) {
        if (!gp) continue;

        const now = Date.now();
        const checkButton = (index: number, action: Direction | 'SELECT' | 'PS') => {
          if (gp.buttons[index]?.pressed || 
              (action === 'UP' && gp.axes[1] < -0.5) || 
              (action === 'DOWN' && gp.axes[1] > 0.5) || 
              (action === 'LEFT' && gp.axes[0] < -0.5) || 
              (action === 'RIGHT' && gp.axes[0] > 0.5)) {
            
            if (now - lastPressTime.current[action] > COOLDOWN) {
              lastPressTime.current[action] = now;
              if (action === 'SELECT') {
                onSelect();
              } else if (action === 'PS') {
                onPSButton?.();
              } else {
                onDirection(action);
              }
            }
          }
        };

        checkButton(12, 'UP');
        checkButton(13, 'DOWN');
        checkButton(14, 'LEFT');
        checkButton(15, 'RIGHT');
        checkButton(0, 'SELECT');
        checkButton(16, 'PS'); // Xbox / PS home button usually 16
      }

      requestRef.current = requestAnimationFrame(checkGamepad);
    };

    requestRef.current = requestAnimationFrame(checkGamepad);

    return () => cancelAnimationFrame(requestRef.current);
  }, [onDirection, onSelect, onPSButton]);
}
