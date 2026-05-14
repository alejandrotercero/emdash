import { useEffect, useState } from 'react';

export type FontOption = string;

interface FontSettings {
  font: FontOption;
  setFont: (font: FontOption) => void;
}

const FONT_STORAGE_KEY = 'nvcode-ui-font';

const DEFAULT_FONT: FontOption = 'system-ui';

export function useFont(): FontSettings {
  const [font, setFontState] = useState<FontOption>(DEFAULT_FONT);

  useEffect(() => {
    // Load saved font preference
    try {
      const saved = localStorage.getItem(FONT_STORAGE_KEY);
      if (saved) {
        setFontState(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setFont = (newFont: FontOption) => {
    try {
      setFontState(newFont);
      localStorage.setItem(FONT_STORAGE_KEY, newFont);

      // Apply to document
      if (typeof document !== 'undefined') {
        // Set CSS custom property for dynamic fonts
        document.documentElement.style.setProperty('--ui-font-family', newFont);

        // Force a reflow to apply the change
        document.body.style.fontFamily = `${newFont}, system-ui, -apple-system, sans-serif`;
      }
    } catch {
      // Ignore errors
    }
  };

  return { font, setFont };
}
