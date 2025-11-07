import { ipcMain } from 'electron';
import { log } from '../lib/logger';
import { workspaceAgentService } from '../services/WorkspaceAgentService';

export function registerWorkspaceAgentIpc() {
  // Workspace Agent: Switch agent for a workspace
  ipcMain.handle('workspace-agent:switch', async (_, args: {
    workspaceId: string;
    newAgentId: string;
    provider: string;
    reason?: string;
  }) => {
    try {
      log.info('Switching workspace agent:', {
        workspaceId: args.workspaceId,
        newAgentId: args.newAgentId,
        provider: args.provider,
        reason: args.reason
      });

      const result = await workspaceAgentService.switchWorkspaceAgent(
        args.workspaceId,
        args.newAgentId,
        args.provider,
        args.reason
      );

      log.info('Workspace agent switch result:', {
        workspaceId: args.workspaceId,
        success: result.success,
        message: result.message
      });

      return result;
    } catch (error) {
      log.error('Failed to switch workspace agent:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Get agent information for a workspace
  ipcMain.handle('workspace-agent:get-info', async (_, args: { workspaceId: string }) => {
    try {
      const agentInfo = await workspaceAgentService.getWorkspaceAgentInfo(args.workspaceId);
      return { success: true, agentInfo };
    } catch (error) {
      log.error('Failed to get workspace agent info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Check if workspace can switch agents
  ipcMain.handle('workspace-agent:can-switch', async (_, args: { workspaceId: string }) => {
    try {
      const canSwitch = await workspaceAgentService.canWorkspaceSwitchAgents(args.workspaceId);
      return { success: true, canSwitch };
    } catch (error) {
      log.error('Failed to check if workspace can switch agents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Get all switchable workspaces
  ipcMain.handle('workspace-agent:get-switchable', async () => {
    try {
      const switchableWorkspaces = await workspaceAgentService.getSwitchableWorkspaces();
      return { success: true, workspaces: switchableWorkspaces };
    } catch (error) {
      log.error('Failed to get switchable workspaces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Get switch history for a workspace
  ipcMain.handle('workspace-agent:get-history', async (_, args: { workspaceId: string }) => {
    try {
      const switchHistory = await workspaceAgentService.getWorkspaceSwitchHistory(args.workspaceId);
      return { success: true, history: switchHistory };
    } catch (error) {
      log.error('Failed to get workspace switch history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Clear agent from workspace
  ipcMain.handle('workspace-agent:clear', async (_, args: {
    workspaceId: string;
    reason?: string;
  }) => {
    try {
      log.info('Clearing workspace agent:', {
        workspaceId: args.workspaceId,
        reason: args.reason
      });

      const result = await workspaceAgentService.clearWorkspaceAgent(
        args.workspaceId,
        args.reason
      );

      log.info('Workspace agent clear result:', {
        workspaceId: args.workspaceId,
        success: result.success,
        message: result.message
      });

      return result;
    } catch (error) {
      log.error('Failed to clear workspace agent:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Check if workspace is currently switching
  ipcMain.handle('workspace-agent:is-switching', async (_, args: { workspaceId: string }) => {
    try {
      const isSwitching = workspaceAgentService.isWorkspaceSwitching(args.workspaceId);
      return { success: true, isSwitching };
    } catch (error) {
      log.error('Failed to check if workspace is switching:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Get workspaces with active switches
  ipcMain.handle('workspace-agent:get-active-switches', async () => {
    try {
      const activeSwitches = workspaceAgentService.getActiveSwitches();
      return { success: true, activeSwitches };
    } catch (error) {
      log.error('Failed to get active switches:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Cancel an active switch
  ipcMain.handle('workspace-agent:cancel-switch', async (_, args: { workspaceId: string }) => {
    try {
      log.info('Cancelling workspace agent switch:', args.workspaceId);
      const cancelled = await workspaceAgentService.cancelWorkspaceSwitch(args.workspaceId);
      return { success: true, cancelled };
    } catch (error) {
      log.error('Failed to cancel workspace switch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Workspace Agent: Get switch statistics
  ipcMain.handle('workspace-agent:get-statistics', async () => {
    try {
      const statistics = await workspaceAgentService.getSwitchStatistics();
      return { success: true, statistics };
    } catch (error) {
      log.error('Failed to get switch statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  log.info('Workspace agent IPC handlers registered');
}