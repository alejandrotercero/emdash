import { useCallback, useEffect, useState } from 'react';
import type { Provider } from '../types';
import { AGENT_MAPPING } from './useKeyboardShortcuts';

export interface AgentSwitchInfo {
  fromProvider?: string;
  toProvider: string;
  workspaceId: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface AgentStats {
  totalSwitches: number;
  successfulSwitches: number;
  failedSwitches: number;
  lastSwitchTime?: Date;
  currentProvider?: string;
}

/**
 * Hook for agent switching functionality
 */
export function useAgentSwitching(workspaceId?: string) {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchHistory, setSwitchHistory] = useState<AgentSwitchInfo[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);

  // Load available providers
  useEffect(() => {
    const loadAvailableProviders = async () => {
      try {
        const result = await (window as any).electronAPI?.['agent:get-available']?.();
        if (result?.success) {
          setAvailableProviders(result.providers);
        }
      } catch (error) {
        console.error('Failed to load available providers:', error);
      }
    };

    loadAvailableProviders();
  }, []);

  // Load current provider
  useEffect(() => {
    if (!workspaceId) return;

    const loadCurrentProvider = async () => {
      try {
        const result = await (window as any).electronAPI?.['agent:get-current']?.(workspaceId);
        if (result?.success) {
          setCurrentProvider(result.provider);
        }
      } catch (error) {
        console.error('Failed to load current provider:', error);
      }
    };

    loadCurrentProvider();
  }, [workspaceId]);

  // Listen for agent switching events
  useEffect(() => {
    const handleSwitched = (event: any, switchInfo: AgentSwitchInfo) => {
      if (switchInfo.workspaceId === workspaceId) {
        setCurrentProvider(switchInfo.toProvider);
        setIsSwitching(false);
        setSwitchHistory(prev => [switchInfo, ...prev.slice(0, 9)]);
      }
    };

    const handleSwitchFailed = (event: any, switchInfo: AgentSwitchInfo) => {
      if (switchInfo.workspaceId === workspaceId) {
        setIsSwitching(false);
        setSwitchHistory(prev => [switchInfo, ...prev.slice(0, 9)]);
      }
    };

    // Add event listeners
    const cleanupSwitched = typeof (window as any).electronAPI?.on === 'function'
      ? (window as any).electronAPI.on('agent:switched', handleSwitched)
      : null;
    const cleanupFailed = typeof (window as any).electronAPI?.on === 'function'
      ? (window as any).electronAPI.on('agent:switch-failed', handleSwitchFailed)
      : null;

    return () => {
      cleanupSwitched?.();
      cleanupFailed?.();
    };
  }, [workspaceId]);

  /**
   * Switch to a different agent
   */
  const switchAgent = useCallback(async (provider: Provider): Promise<boolean> => {
    if (!workspaceId) {
      console.error('No workspace ID provided');
      return false;
    }

    if (isSwitching) {
      console.log('Agent switch already in progress');
      return false;
    }

    setIsSwitching(true);

    try {
      const result = await (window as any).electronAPI?.['agent:switch']?.({
        workspaceId,
        provider,
      });

      if (result?.success) {
        console.log(`Successfully switched to ${provider}`);
        return true;
      } else {
        console.error('Failed to switch agent:', result?.error);
        setIsSwitching(false);
        return false;
      }
    } catch (error) {
      console.error('Failed to switch agent:', error);
      setIsSwitching(false);
      return false;
    }
  }, [workspaceId, isSwitching]);

  /**
   * Switch agent by index (1-9)
   */
  const switchAgentByIndex = useCallback(async (index: number): Promise<boolean> => {
    const provider = AGENT_MAPPING[index];
    if (!provider) {
      console.error(`Invalid agent index: ${index}`);
      return false;
    }

    return switchAgent(provider);
  }, [switchAgent]);

  /**
   * Get agent name for display
   */
  const getAgentName = useCallback((provider: string): string => {
    const agentNames: Record<string, string> = {
      codex: 'OpenAI Codex',
      claude: 'Claude Code',
      qwen: 'Qwen Code',
      droid: 'Droid',
      gemini: 'Gemini',
      cursor: 'Cursor',
      copilot: 'GitHub Copilot',
      amp: 'Amp',
      opencode: 'OpenCode',
      charm: 'Charm',
      auggie: 'Auggie',
    };

    return agentNames[provider] || provider;
  }, []);

  return {
    availableProviders,
    currentProvider,
    isSwitching,
    switchHistory,
    stats,
    switchAgent,
    switchAgentByIndex,
    getAgentName,
  };
}

/**
 * Global agent switching state manager
 */
export function useGlobalAgentSwitching() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  return {
    activeWorkspaceId,
    setActiveWorkspaceId,
  };
}