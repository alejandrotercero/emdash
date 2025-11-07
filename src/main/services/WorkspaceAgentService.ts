import { log } from '../lib/logger';
import { databaseService } from './DatabaseService';
import { worktreeService } from './WorktreeService';

export interface AgentSwitchInfo {
  workspaceId: string;
  oldAgentId?: string;
  newAgentId: string;
  provider: string;
  reason: string;
  timestamp: Date;
}

export interface WorkspaceAgentInfo {
  workspaceId: string;
  currentAgentId?: string;
  currentProvider?: string;
  availableProviders: string[];
  canSwitch: boolean;
  lastSwitch?: AgentSwitchInfo;
  switchHistory: AgentSwitchInfo[];
}

export class WorkspaceAgentService {
  private activeSwitches: Map<string, Promise<AgentSwitchInfo>> = new Map();

  /**
   * Switch the agent for a workspace within the same worktree
   */
  async switchWorkspaceAgent(
    workspaceId: string,
    newAgentId: string,
    provider: string,
    reason: string = 'User requested switch'
  ): Promise<{ success: boolean; message: string; switchInfo?: AgentSwitchInfo }> {
    try {
      // Prevent concurrent switches for the same workspace
      if (this.activeSwitches.has(workspaceId)) {
        return {
          success: false,
          message: 'Agent switch already in progress for this workspace'
        };
      }

      log.info(`Starting agent switch for workspace ${workspaceId}:`, {
        newAgentId,
        provider,
        reason
      });

      const switchPromise = this.performAgentSwitch(workspaceId, newAgentId, provider, reason);
      this.activeSwitches.set(workspaceId, switchPromise);

      try {
        const switchInfo = await switchPromise;
        return {
          success: true,
          message: `Successfully switched to ${provider}`,
          switchInfo
        };
      } finally {
        this.activeSwitches.delete(workspaceId);
      }
    } catch (error) {
      this.activeSwitches.delete(workspaceId);
      const errorMessage = `Failed to switch agent: ${error instanceof Error ? error.message : String(error)}`;
      log.error('Agent switch failed:', error);
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Perform the actual agent switch
   */
  private async performAgentSwitch(
    workspaceId: string,
    newAgentId: string,
    provider: string,
    reason: string
  ): Promise<AgentSwitchInfo> {
    // Get current workspace info
    const workspaces = await databaseService.getWorkspaces();
    const workspace = workspaces.find(w => w.id === workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const oldAgentId = workspace.agentId;
    const oldProvider = workspace.metadata?.provider;

    // Create switch info record
    const switchInfo: AgentSwitchInfo = {
      workspaceId,
      oldAgentId,
      newAgentId,
      provider,
      reason,
      timestamp: new Date()
    };

    log.info(`Switching agent for workspace ${workspaceId}:`, {
      oldAgentId,
      newAgentId,
      oldProvider,
      provider,
      worktreeType: workspace.worktreeType
    });

    // Update workspace with new agent
    const updatedWorkspace = {
      ...workspace,
      agentId: newAgentId,
      metadata: {
        ...workspace.metadata,
        provider,
        lastAgentSwitch: switchInfo.timestamp.toISOString(),
        agentSwitchHistory: [
          ...(workspace.metadata?.agentSwitchHistory || []),
          switchInfo
        ]
      }
    };

    await databaseService.saveWorkspace(updatedWorkspace);

    // If this is a worktree workspace, ensure the worktree is still valid
    if (workspace.worktreeType === 'worktree') {
      try {
        const worktrees = await worktreeService.listWorktrees(workspace.path);
        const existingWorktree = worktrees.find(wt => wt.id === workspaceId);

        if (!existingWorktree) {
          log.warn(`Worktree not found for workspace ${workspaceId}, but continuing with agent switch`);
        }
      } catch (error) {
        log.warn(`Failed to verify worktree for workspace ${workspaceId}:`, error);
        // Don't fail the switch if worktree verification fails
      }
    }

    log.info(`Agent switch completed for workspace ${workspaceId}:`, {
      oldAgentId,
      newAgentId,
      provider
    });

    return switchInfo;
  }

  /**
   * Get agent information for a workspace
   */
  async getWorkspaceAgentInfo(workspaceId: string): Promise<WorkspaceAgentInfo | null> {
    try {
      const workspaces = await databaseService.getWorkspaces();
      const workspace = workspaces.find(w => w.id === workspaceId);

      if (!workspace) {
        return null;
      }

      const currentAgentId = workspace.agentId;
      const currentProvider = workspace.metadata?.provider;
      const switchHistory = workspace.metadata?.agentSwitchHistory || [];

      // Get available providers (this would typically come from a provider registry)
      const availableProviders = [
        'codex',
        'claude',
        'droid',
        'gemini',
        'cursor',
        'amp',
        'copilot',
        'charm'
      ];

      const lastSwitch = switchHistory.length > 0 ?
        switchHistory[switchHistory.length - 1] : undefined;

      return {
        workspaceId,
        currentAgentId,
        currentProvider,
        availableProviders,
        canSwitch: workspace.worktreeType !== undefined, // Can switch if worktree type is known
        lastSwitch,
        switchHistory
      };
    } catch (error) {
      log.error('Failed to get workspace agent info:', error);
      return null;
    }
  }

  /**
   * Check if a workspace can switch agents
   */
  async canWorkspaceSwitchAgents(workspaceId: string): Promise<boolean> {
    const agentInfo = await this.getWorkspaceAgentInfo(workspaceId);
    return agentInfo?.canSwitch || false;
  }

  /**
   * Get all workspaces that can switch agents
   */
  async getSwitchableWorkspaces(): Promise<WorkspaceAgentInfo[]> {
    try {
      const workspaces = await databaseService.getWorkspaces();
      const agentInfos: WorkspaceAgentInfo[] = [];

      for (const workspace of workspaces) {
        const agentInfo = await this.getWorkspaceAgentInfo(workspace.id);
        if (agentInfo && agentInfo.canSwitch) {
          agentInfos.push(agentInfo);
        }
      }

      return agentInfos;
    } catch (error) {
      log.error('Failed to get switchable workspaces:', error);
      return [];
    }
  }

  /**
   * Get switch history for a workspace
   */
  async getWorkspaceSwitchHistory(workspaceId: string): Promise<AgentSwitchInfo[]> {
    try {
      const agentInfo = await this.getWorkspaceAgentInfo(workspaceId);
      return agentInfo?.switchHistory || [];
    } catch (error) {
      log.error('Failed to get workspace switch history:', error);
      return [];
    }
  }

  /**
   * Clear agent from a workspace (make it agent-less)
   */
  async clearWorkspaceAgent(workspaceId: string, reason: string = 'Agent cleared'): Promise<{ success: boolean; message: string }> {
    try {
      const workspaces = await databaseService.getWorkspaces();
      const workspace = workspaces.find(w => w.id === workspaceId);

      if (!workspace) {
        return {
          success: false,
          message: 'Workspace not found'
        };
      }

      const oldAgentId = workspace.agentId;
      const oldProvider = workspace.metadata?.provider;

      // Create switch info record
      const switchInfo: AgentSwitchInfo = {
        workspaceId,
        oldAgentId,
        newAgentId: '',
        provider: 'none',
        reason,
        timestamp: new Date()
      };

      // Update workspace to remove agent
      const updatedWorkspace = {
        ...workspace,
        agentId: undefined,
        metadata: {
          ...workspace.metadata,
          provider: undefined,
          lastAgentSwitch: switchInfo.timestamp.toISOString(),
          agentSwitchHistory: [
            ...(workspace.metadata?.agentSwitchHistory || []),
            switchInfo
          ]
        }
      };

      await databaseService.saveWorkspace(updatedWorkspace);

      log.info(`Cleared agent for workspace ${workspaceId}:`, {
        oldAgentId,
        oldProvider
      });

      return {
        success: true,
        message: 'Agent cleared successfully'
      };
    } catch (error) {
      log.error('Failed to clear workspace agent:', error);
      return {
        success: false,
        message: `Failed to clear agent: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if there's an active agent switch for a workspace
   */
  isWorkspaceSwitching(workspaceId: string): boolean {
    return this.activeSwitches.has(workspaceId);
  }

  /**
   * Get workspaces with active agent switches
   */
  getActiveSwitches(): string[] {
    return Array.from(this.activeSwitches.keys());
  }

  /**
   * Cancel an active agent switch for a workspace
   */
  async cancelWorkspaceSwitch(workspaceId: string): Promise<boolean> {
    const activeSwitch = this.activeSwitches.get(workspaceId);
    if (activeSwitch) {
      try {
        // Note: We can't actually cancel the Promise, but we can remove it from tracking
        this.activeSwitches.delete(workspaceId);
        log.info(`Cancelled agent switch tracking for workspace: ${workspaceId}`);
        return true;
      } catch (error) {
        log.error('Failed to cancel workspace switch:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get statistics about agent switching
   */
  async getSwitchStatistics(): Promise<{
    totalWorkspaces: number;
    switchableWorkspaces: number;
    activeSwitches: number;
    totalSwitches: number;
    mostUsedProvider: string;
    recentSwitches: AgentSwitchInfo[];
  }> {
    try {
      const allWorkspaces = await databaseService.getWorkspaces();
      const switchableWorkspaces = await this.getSwitchableWorkspaces();

      let totalSwitches = 0;
      const providerCounts: Record<string, number> = {};
      const recentSwitches: AgentSwitchInfo[] = [];

      for (const workspace of allWorkspaces) {
        const switchHistory = workspace.metadata?.agentSwitchHistory || [];
        totalSwitches += switchHistory.length;

        for (const switchInfo of switchHistory) {
          if (switchInfo.provider && switchInfo.provider !== 'none') {
            providerCounts[switchInfo.provider] = (providerCounts[switchInfo.provider] || 0) + 1;
          }
          recentSwitches.push(switchInfo);
        }
      }

      // Sort recent switches by timestamp (newest first)
      recentSwitches.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const recent = recentSwitches.slice(0, 10);

      // Find most used provider
      const mostUsedProvider = Object.entries(providerCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';

      return {
        totalWorkspaces: allWorkspaces.length,
        switchableWorkspaces: switchableWorkspaces.length,
        activeSwitches: this.activeSwitches.size,
        totalSwitches,
        mostUsedProvider,
        recentSwitches: recent
      };
    } catch (error) {
      log.error('Failed to get switch statistics:', error);
      return {
        totalWorkspaces: 0,
        switchableWorkspaces: 0,
        activeSwitches: 0,
        totalSwitches: 0,
        mostUsedProvider: 'none',
        recentSwitches: []
      };
    }
  }
}

// Singleton instance
export const workspaceAgentService = new WorkspaceAgentService();