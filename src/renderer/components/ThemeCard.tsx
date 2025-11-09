import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useFont } from '../hooks/useFont';
import { Sun, Moon, Monitor, Type, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const ThemeCard: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { font, setFont } = useFont();
  const [fontInput, setFontInput] = useState(font);

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const applyFont = () => {
    if (fontInput.trim()) {
      setFont(fontInput.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyFont();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Appearance</div>
          <div className="text-xs text-muted-foreground">
            Choose how Emdash looks. System uses your operating system preference.
          </div>
        </div>
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                theme === value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/40'
              }`}
              aria-pressed={theme === value}
              aria-label={`Set theme to ${label}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Font Family</div>
          <div className="text-xs text-muted-foreground">
            Enter a system font name (e.g., "SF Pro", "Inter", "Roboto") or use "Rawest" for the default.
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={fontInput}
              onChange={(e) => setFontInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="system-ui"
              className="w-full"
            />
          </div>
          <Button onClick={applyFont} size="sm" className="gap-2">
            <Check className="h-4 w-4" />
            Apply
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Current: <span className="font-mono bg-muted px-1 py-0.5 rounded">{font || 'system-ui'}</span>
        </div>
      </div>
    </div>
  );
};

export default ThemeCard;
