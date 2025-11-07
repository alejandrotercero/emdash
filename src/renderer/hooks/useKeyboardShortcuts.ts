import { useEffect } from 'react';
import type { ShortcutConfig, GlobalShortcutHandlers, ShortcutMapping } from '../types/shortcuts';
import type { Provider } from '../types';

/**
 * ==============================================================================
 * SHORTCUTS CONFIGURATION (Single Source of Truth)
 * ==============================================================================
 */

export const APP_SHORTCUTS = {
  // Command Palette
  COMMAND_PALETTE: {
    key: 'k',
    modifier: 'cmd' as const,
    description: 'Open command palette',
    category: 'Navigation',
  },

  // Settings & Config
  SETTINGS: {
    key: ',',
    modifier: 'cmd' as const,
    description: 'Open settings',
    category: 'Navigation',
  },

  // Sidebar Controls
  TOGGLE_LEFT_SIDEBAR: {
    key: 'b',
    modifier: 'cmd' as const,
    description: 'Toggle left sidebar',
    category: 'View',
  },

  TOGGLE_RIGHT_SIDEBAR: {
    key: '.',
    modifier: 'cmd' as const,
    description: 'Toggle right sidebar',
    category: 'View',
  },

  // Theme
  TOGGLE_THEME: {
    key: 't',
    modifier: 'cmd' as const,
    description: 'Toggle theme',
    category: 'View',
  },

  // Modal Controls
  CLOSE_MODAL: {
    key: 'Escape',
    description: 'Close modal/dialog',
    category: 'Navigation',
  },

  // Workspace Switching (Cmd+1 through Cmd+9)
  SWITCH_WORKSPACE_1: {
    key: '1',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 1',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_2: {
    key: '2',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 2',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_3: {
    key: '3',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 3',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_4: {
    key: '4',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 4',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_5: {
    key: '5',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 5',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_6: {
    key: '6',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 6',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_7: {
    key: '7',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 7',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_8: {
    key: '8',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 8',
    category: 'Workspace',
  },
  SWITCH_WORKSPACE_9: {
    key: '9',
    modifier: 'cmd' as const,
    description: 'Switch to workspace 9',
    category: 'Workspace',
  },

  // Agent Switching (Cmd+Shift+1 through Cmd+Shift+9)
  SWITCH_AGENT_1: {
    key: '1',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 1 (Codex)',
    category: 'Agent',
  },
  SWITCH_AGENT_2: {
    key: '2',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 2 (Claude)',
    category: 'Agent',
  },
  SWITCH_AGENT_3: {
    key: '3',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 3 (Qwen)',
    category: 'Agent',
  },
  SWITCH_AGENT_4: {
    key: '4',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 4 (Droid)',
    category: 'Agent',
  },
  SWITCH_AGENT_5: {
    key: '5',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 5 (Gemini)',
    category: 'Agent',
  },
  SWITCH_AGENT_6: {
    key: '6',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 6 (Cursor)',
    category: 'Agent',
  },
  SWITCH_AGENT_7: {
    key: '7',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 7 (Copilot)',
    category: 'Agent',
  },
  SWITCH_AGENT_8: {
    key: '8',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 8 (Amp)',
    category: 'Agent',
  },
  SWITCH_AGENT_9: {
    key: '9',
    modifier: 'cmd+shift' as const,
    description: 'Switch to agent 9 (Charm)',
    category: 'Agent',
  },
} as const;

/**
 * Agent mapping for keyboard shortcuts
 * Maps shortcut numbers to actual provider names
 */
export const AGENT_MAPPING: Record<number, Provider> = {
  1: 'codex',    // OpenAI Codex
  2: 'claude',   // Claude Code
  3: 'qwen',     // Qwen Code
  4: 'droid',    // Droid
  5: 'gemini',   // Gemini
  6: 'cursor',   // Cursor
  7: 'copilot',  // GitHub Copilot
  8: 'amp',      // Amp
  9: 'charm',    // Charm
} as const;

/**
 * ==============================================================================
 * HELPER FUNCTIONS
 * ==============================================================================
 */

export function formatShortcut(shortcut: ShortcutConfig): string {
  const modifier = shortcut.modifier
    ? shortcut.modifier === 'cmd'
      ? '⌘'
      : shortcut.modifier === 'option'
        ? '⌥'
        : shortcut.modifier === 'shift'
          ? '⇧'
          : shortcut.modifier === 'cmd+shift'
            ? '⌘⇧'
          : shortcut.modifier === 'alt'
            ? 'Alt'
            : 'Ctrl'
    : '';

  const key = shortcut.key === 'Escape' ? 'Esc' : shortcut.key.toUpperCase();

  return modifier ? `${modifier}${key}` : key;
}

export function getShortcutsByCategory(): Record<string, ShortcutConfig[]> {
  const shortcuts = Object.values(APP_SHORTCUTS);
  const grouped: Record<string, ShortcutConfig[]> = {};

  shortcuts.forEach((shortcut) => {
    const category = shortcut.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(shortcut);
  });

  return grouped;
}

export function hasShortcutConflict(shortcut1: ShortcutConfig, shortcut2: ShortcutConfig): boolean {
  return (
    shortcut1.key.toLowerCase() === shortcut2.key.toLowerCase() &&
    shortcut1.modifier === shortcut2.modifier
  );
}

/**
 * ==============================================================================
 * GLOBAL SHORTCUT HOOK
 * ==============================================================================
 */

/**
 * Single global keyboard shortcuts hook
 * Call this once in your App component with all handlers
 */
export function useKeyboardShortcuts(handlers: GlobalShortcutHandlers) {
  useEffect(() => {
    // Build dynamic shortcut mappings from config
    const shortcuts: ShortcutMapping[] = [
      {
        config: APP_SHORTCUTS.COMMAND_PALETTE,
        handler: () => handlers.onToggleCommandPalette?.(),
        priority: 'global',
      },
      {
        config: APP_SHORTCUTS.SETTINGS,
        handler: () => handlers.onOpenSettings?.(),
        priority: 'global',
        requiresClosed: true, // Can be triggered from modal
      },
      {
        config: APP_SHORTCUTS.TOGGLE_LEFT_SIDEBAR,
        handler: () => handlers.onToggleLeftSidebar?.(),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.TOGGLE_RIGHT_SIDEBAR,
        handler: () => handlers.onToggleRightSidebar?.(),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.TOGGLE_THEME,
        handler: () => handlers.onToggleTheme?.(),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.CLOSE_MODAL,
        handler: () => handlers.onCloseModal?.(),
        priority: 'modal',
      },
      // Workspace switching shortcuts
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_1,
        handler: () => handlers.onSwitchWorkspace?.(1),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_2,
        handler: () => handlers.onSwitchWorkspace?.(2),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_3,
        handler: () => handlers.onSwitchWorkspace?.(3),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_4,
        handler: () => handlers.onSwitchWorkspace?.(4),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_5,
        handler: () => handlers.onSwitchWorkspace?.(5),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_6,
        handler: () => handlers.onSwitchWorkspace?.(6),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_7,
        handler: () => handlers.onSwitchWorkspace?.(7),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_8,
        handler: () => handlers.onSwitchWorkspace?.(8),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_WORKSPACE_9,
        handler: () => handlers.onSwitchWorkspace?.(9),
        priority: 'global',
        requiresClosed: true,
      },
      // Agent switching shortcuts
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_1,
        handler: () => handlers.onSwitchAgent?.(1),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_2,
        handler: () => handlers.onSwitchAgent?.(2),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_3,
        handler: () => handlers.onSwitchAgent?.(3),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_4,
        handler: () => handlers.onSwitchAgent?.(4),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_5,
        handler: () => handlers.onSwitchAgent?.(5),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_6,
        handler: () => handlers.onSwitchAgent?.(6),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_7,
        handler: () => handlers.onSwitchAgent?.(7),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_8,
        handler: () => handlers.onSwitchAgent?.(8),
        priority: 'global',
        requiresClosed: true,
      },
      {
        config: APP_SHORTCUTS.SWITCH_AGENT_9,
        handler: () => handlers.onSwitchAgent?.(9),
        priority: 'global',
        requiresClosed: true,
      },
    ];

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      for (const shortcut of shortcuts) {
        const shortcutKey = shortcut.config.key.toLowerCase();
        const keyMatches = key === shortcutKey;

        if (!keyMatches) continue;

        // Check modifier requirements
        let modifierRequired = false;
        let hasRequiredModifier = false;

        if (shortcut.config.modifier === 'cmd') {
          modifierRequired = true;
          hasRequiredModifier = event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;
        } else if (shortcut.config.modifier === 'cmd+shift') {
          modifierRequired = true;
          hasRequiredModifier = event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey;
        } else if (shortcut.config.modifier === 'option') {
          modifierRequired = true;
          hasRequiredModifier = event.altKey && !event.metaKey && !event.shiftKey && !event.ctrlKey;
        } else if (shortcut.config.modifier === 'ctrl') {
          modifierRequired = true;
          hasRequiredModifier = event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
        }

        if (modifierRequired && !hasRequiredModifier) continue;
        if (!modifierRequired && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) continue;

        // Handle priority and modal state
        const isModalOpen = handlers.isCommandPaletteOpen || handlers.isSettingsOpen;

        // Modal-priority shortcuts (like Escape) only work when modal is open
        if (shortcut.priority === 'modal' && !isModalOpen) continue;

        // Global shortcuts
        if (shortcut.priority === 'global') {
          // Command palette toggle always works
          if (shortcut.config.key === APP_SHORTCUTS.COMMAND_PALETTE.key) {
            event.preventDefault();
            shortcut.handler();
            return;
          }

          // Other shortcuts: if modal is open and they can close it
          if (isModalOpen && shortcut.requiresClosed) {
            event.preventDefault();
            handlers.onCloseModal?.();
            setTimeout(() => shortcut.handler(), 100);
            return;
          }

          // Normal execution when no modal is open
          if (!isModalOpen) {
            event.preventDefault();
            shortcut.handler();
            return;
          }
        }

        // Execute modal shortcuts
        if (shortcut.priority === 'modal') {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
