import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Vertical iOS-style wheel picker.
 *
 * Snap-scrolls through a list of options; centred item is rendered red and
 * bold like UIPickerView. Above/below items fade out with reduced opacity.
 *
 * Props:
 *   options    — array of values to choose from (numbers or strings)
 *   value      — currently selected value
 *   onChange   — called with the new value when the user lands on it
 *   itemHeight — px height of a row (default 56)
 *   visible    — number of rows visible at once (must be odd, default 5)
 *   testId     — root data-testid
 */
export const WheelPicker = ({ options, value, onChange, itemHeight = 56, visible = 5, testId }) => {
  const scrollRef = useRef(null);
  const settleTimer = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const containerHeight = itemHeight * visible;
  const padding = (containerHeight - itemHeight) / 2;

  // Scroll to the currently selected value (only on mount + value-changed-externally)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.max(0, options.indexOf(value));
    el.scrollTop = idx * itemHeight;
    setIsReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    if (!scrollRef.current || !isReady) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const top = scrollRef.current.scrollTop;
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(top / itemHeight)));
      const next = options[idx];
      if (next !== value) onChange(next);
      // Snap precisely to the rounded index
      scrollRef.current.scrollTo({ top: idx * itemHeight, behavior: 'smooth' });
    }, 110);
  }, [isReady, itemHeight, onChange, options, value]);

  return (
    <div data-testid={testId} style={{
      position: 'relative',
      height: containerHeight,
      width: '100%',
      maskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 70%, transparent 100%)',
    }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{
          height: '100%',
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          paddingTop: padding,
          paddingBottom: padding,
        }}
      >
        {options.map((opt) => (
          <div
            key={String(opt)}
            data-testid={testId ? `${testId}-${opt}` : undefined}
            style={{
              height: itemHeight,
              scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: opt === value ? 32 : 24,
              fontWeight: opt === value ? 700 : 500,
              color: opt === value ? '#FF3B30' : '#1D1D1F',
              fontFamily: 'Outfit, sans-serif',
              transition: 'font-size 0.15s ease, color 0.15s ease',
            }}
          >{opt}</div>
        ))}
      </div>
    </div>
  );
};

export default WheelPicker;
