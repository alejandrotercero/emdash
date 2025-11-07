import { ipcMain } from 'electron';
import { log } from '../lib/logger';
import { setupCommandsService } from '../services/SetupCommandsService';
import { databaseService } from '../services/DatabaseService';

export function registerSetupCommandsIpc() {
  // Setup Commands: Execute setup commands for a workspace
  ipcMain.handle('setup-commands:execute', async (_, args: {
    workspaceId: string;
    workspacePath: string;
    projectId?: string;
    environment?: Record<string, string>;
  }) => {
    try {
      log.info('Executing setup commands for workspace:', args.workspaceId);
      const result = await setupCommandsService.executeSetupCommands({
        workspaceId: args.workspaceId,
        workspacePath: args.workspacePath,
        projectId: args.projectId,
        environment: args.environment
      });

      log.info('Setup commands execution completed:', {
        workspaceId: args.workspaceId,
        success: result.success,
        commandCount: result.commands.length,
        duration: result.duration
      });

      return { success: true, result };
    } catch (error) {
      log.error('Failed to execute setup commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Save a setup command
  ipcMain.handle('setup-commands:save', async (_, args: {
    id: string;
    type: 'global' | 'project' | 'workspace';
    parentId: string;
    commands: string[];
    enabled?: boolean;
    name?: string;
    description?: string;
  }) => {
    try {
      // Validate commands before saving
      const validation = setupCommandsService.validateCommandGroup(args.commands);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid commands: ${validation.errors.join(', ')}`
        };
      }

      await databaseService.saveSetupCommand({
        id: args.id,
        type: args.type,
        parentId: args.parentId,
        commands: args.commands,
        enabled: args.enabled !== undefined ? args.enabled : true,
        name: args.name,
        description: args.description
      });

      log.info('Saved setup command:', {
        id: args.id,
        type: args.type,
        parentId: args.parentId,
        name: args.name,
        commandCount: args.commands.length
      });

      return { success: true };
    } catch (error) {
      log.error('Failed to save setup command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Get setup commands
  ipcMain.handle('setup-commands:get', async (_, args: {
    type?: 'global' | 'project' | 'workspace';
    parentId?: string;
  }) => {
    try {
      const commands = await databaseService.getSetupCommands(args.type, args.parentId);
      return { success: true, commands };
    } catch (error) {
      log.error('Failed to get setup commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Get effective setup commands for a workspace (with inheritance)
  ipcMain.handle('setup-commands:get-effective', async (_, args: {
    workspaceId: string;
    projectId?: string;
  }) => {
    try {
      const commands = await databaseService.getEffectiveSetupCommands(
        args.workspaceId,
        args.projectId
      );
      return { success: true, commands };
    } catch (error) {
      log.error('Failed to get effective setup commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Delete a setup command
  ipcMain.handle('setup-commands:delete', async (_, args: { id: string }) => {
    try {
      await databaseService.deleteSetupCommand(args.id);
      log.info('Deleted setup command:', args.id);
      return { success: true };
    } catch (error) {
      log.error('Failed to delete setup command:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Validate commands
  ipcMain.handle('setup-commands:validate', async (_, args: { commands: string[] }) => {
    try {
      const validation = setupCommandsService.validateCommandGroup(args.commands);
      return { success: true, validation };
    } catch (error) {
      log.error('Failed to validate setup commands:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Get setup summary for a workspace
  ipcMain.handle('setup-commands:get-summary', async (_, args: {
    workspaceId: string;
    projectId?: string;
  }) => {
    try {
      const summary = await setupCommandsService.getSetupSummary(
        args.workspaceId,
        args.projectId
      );
      return { success: true, summary };
    } catch (error) {
      log.error('Failed to get setup summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Stop executions for a workspace
  ipcMain.handle('setup-commands:stop-workspace', async (_, args: { workspaceId: string }) => {
    try {
      setupCommandsService.stopWorkspaceExecutions(args.workspaceId);
      log.info('Stopped setup command executions for workspace:', args.workspaceId);
      return { success: true };
    } catch (error) {
      log.error('Failed to stop workspace executions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Check if workspace has running executions
  ipcMain.handle('setup-commands:is-running', async (_, args: { workspaceId: string }) => {
    try {
      const isRunning = setupCommandsService.isWorkspaceRunning(args.workspaceId);
      return { success: true, isRunning };
    } catch (error) {
      log.error('Failed to check if workspace is running:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Get all running workspaces
  ipcMain.handle('setup-commands:get-running-workspaces', async () => {
    try {
      const runningWorkspaces = setupCommandsService.getRunningWorkspaces();
      return { success: true, runningWorkspaces };
    } catch (error) {
      log.error('Failed to get running workspaces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Setup Commands: Stop all executions
  ipcMain.handle('setup-commands:stop-all', async () => {
    try {
      setupCommandsService.stopAllExecutions();
      log.info('Stopped all setup command executions');
      return { success: true };
    } catch (error) {
      log.error('Failed to stop all executions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  log.info('Setup commands IPC handlers registered');
}