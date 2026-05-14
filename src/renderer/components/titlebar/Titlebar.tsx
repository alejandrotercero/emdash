import React from 'react';
import { Cable, Moon, Sun } from 'lucide-react';
import SidebarLeftToggleButton from './SidebarLeftToggleButton';
import SidebarRightToggleButton from './SidebarRightToggleButton';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import OpenInMenu from './OpenInMenu';
import { useTheme } from '../../hooks/useTheme';

interface TitlebarProps {
  onShowConnections: () => void;
  currentPath?: string | null;
}

const Titlebar: React.FC<TitlebarProps> = ({
  onShowConnections,
  currentPath,
}) => {
  const { effectiveTheme, toggleTheme } = useTheme();

  return (
    <header className="fixed inset-x-0 top-0 z-[80] flex h-[var(--tb,36px)] items-center justify-end bg-neutral-50 pr-2 shadow-[inset_0_-1px_0_hsl(var(--border))] [-webkit-app-region:drag] dark:bg-neutral-900">
      <div className="pointer-events-auto flex items-center gap-1 [-webkit-app-region:no-drag]">
        {currentPath ? <OpenInMenu path={currentPath} align="right" /> : null}
        <SidebarLeftToggleButton />
        <SidebarRightToggleButton />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Connections"
                onClick={onShowConnections}
                className="h-8 w-8 text-muted-foreground hover:bg-background/80"
              >
                <Cable className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium">
              Connections
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Toggle theme"
                onClick={toggleTheme}
                className="h-8 w-8 text-muted-foreground hover:bg-background/80"
              >
                {effectiveTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-medium">
              {effectiveTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
};

export default Titlebar;
