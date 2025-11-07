import { spawn, ChildProcess } from 'child_process';
import { log } from '../lib/logger';
import { databaseService, SetupCommand } from './DatabaseService';

export interface SetupExecutionResult {
  success: boolean;
  commands: string[];
  output: string[];
  errors: string[];
  duration: number;
}

export interface SetupExecutionContext {
  workspaceId: string;
  workspacePath: string;
  projectId?: string;
  environment?: Record<string, string>;
}

export class SetupCommandsService {
  private executions: Map<string, ChildProcess[]> = new Map();

  /**
   * Execute setup commands for a workspace (global -> project -> workspace cascade)
   */
  async executeSetupCommands(context: SetupExecutionContext): Promise<SetupExecutionResult> {
    const startTime = Date.now();
    const results: SetupExecutionResult = {
      success: true,
      commands: [],
      output: [],
      errors: [],
      duration: 0
    };

    try {
      log.info('Starting setup commands execution for workspace:', context.workspaceId);

      // Get all effective setup commands (global -> project -> workspace)
      const commands = await databaseService.getEffectiveSetupCommands(
        context.workspaceId,
        context.projectId
      );

      if (commands.length === 0) {
        log.info('No setup commands configured for workspace:', context.workspaceId);
        results.duration = Date.now() - startTime;
        return results;
      }

      log.info(`Executing ${commands.length} setup command groups for workspace:`, context.workspaceId);

      // Execute commands in order (global first, then project, then workspace)
      for (const commandGroup of commands) {
        try {
          const groupResult = await this.executeCommandGroup(
            commandGroup,
            context
          );

          results.commands.push(...groupResult.commands);
          results.output.push(...groupResult.output);
          results.errors.push(...groupResult.errors);

          if (!groupResult.success) {
            results.success = false;
            log.warn(`Setup command group failed for workspace ${context.workspaceId}:`, commandGroup.name);
            // Continue with remaining commands even if one group fails
          }
        } catch (error) {
          results.success = false;
          const errorMsg = `Failed to execute command group "${commandGroup.name || 'unnamed'}": ${error}`;
          results.errors.push(errorMsg);
          log.error(errorMsg);
        }
      }

      results.duration = Date.now() - startTime;

      log.info(`Setup commands execution completed for workspace ${context.workspaceId}:`, {
        success: results.success,
        totalCommands: results.commands.length,
        errors: results.errors.length,
        duration: results.duration
      });

      return results;
    } catch (error) {
      results.success = false;
      results.errors.push(`Setup execution failed: ${error}`);
      results.duration = Date.now() - startTime;
      log.error('Setup commands execution failed:', error);
      return results;
    }
  }

  /**
   * Execute a single command group
   */
  private async executeCommandGroup(
    commandGroup: SetupCommand,
    context: SetupExecutionContext
  ): Promise<SetupExecutionResult> {
    const result: SetupExecutionResult = {
      success: true,
      commands: [],
      output: [],
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    for (const command of commandGroup.commands) {
      try {
        const commandResult = await this.executeSingleCommand(command, context);
        result.commands.push(command);
        result.output.push(...commandResult.output);
        result.errors.push(...commandResult.errors);

        if (!commandResult.success) {
          result.success = false;
          // Continue with remaining commands in the group
        }
      } catch (error) {
        result.success = false;
        result.errors.push(`Command failed: "${command}" - ${error}`);
        result.commands.push(command);
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Execute a single command
   */
  private async executeSingleCommand(
    command: string,
    context: SetupExecutionContext
  ): Promise<{ success: boolean; output: string[]; errors: string[] }> {
    return new Promise((resolve) => {
      const result = { success: true, output: [] as string[], errors: [] as string[] };

      log.info(`Executing setup command: "${command}" in workspace: ${context.workspaceId}`);

      // Choose shell based on platform
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      const child = spawn(command, [], {
        cwd: context.workspacePath,
        shell: true,
        env: { ...process.env, ...context.environment },
        stdio: 'pipe'
      });

      // Track this process for potential cleanup
      if (!this.executions.has(context.workspaceId)) {
        this.executions.set(context.workspaceId, []);
      }
      this.executions.get(context.workspaceId)!.push(child);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        result.output.push(chunk.trim());
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        result.errors.push(chunk.trim());
      });

      child.on('close', (code) => {
        // Remove this process from tracking
        const processes = this.executions.get(context.workspaceId);
        if (processes) {
          const index = processes.indexOf(child);
          if (index > -1) {
            processes.splice(index, 1);
          }
        }

        result.success = code === 0;

        if (code !== 0) {
          result.errors.push(`Command exited with code ${code}`);
          log.warn(`Setup command failed: "${command}" in workspace ${context.workspaceId}, exit code: ${code}`);
          if (stderr) {
            log.warn('Command stderr:', stderr);
          }
        } else {
          log.info(`Setup command completed successfully: "${command}" in workspace ${context.workspaceId}`);
        }

        resolve(result);
      });

      child.on('error', (error) => {
        // Remove this process from tracking
        const processes = this.executions.get(context.workspaceId);
        if (processes) {
          const index = processes.indexOf(child);
          if (index > -1) {
            processes.splice(index, 1);
          }
        }

        result.success = false;
        result.errors.push(`Command error: ${error.message}`);
        log.error(`Setup command error: "${command}" in workspace ${context.workspaceId}:`, error);
        resolve(result);
      });

      // Set a timeout (default 30 seconds)
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          result.success = false;
          result.errors.push('Command timed out after 30 seconds');
          log.error(`Setup command timed out: "${command}" in workspace ${context.workspaceId}`);
          resolve(result);
        }
      }, 30000);

      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Stop all running setup commands for a workspace
   */
  stopWorkspaceExecutions(workspaceId: string): void {
    const processes = this.executions.get(workspaceId);
    if (processes) {
      log.info(`Stopping ${processes.length} setup command processes for workspace: ${workspaceId}`);
      processes.forEach(child => {
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      });
      this.executions.delete(workspaceId);
    }
  }

  /**
   * Stop all running setup commands
   */
  stopAllExecutions(): void {
    log.info('Stopping all setup command executions');
    for (const [workspaceId] of this.executions) {
      this.stopWorkspaceExecutions(workspaceId);
    }
  }

  /**
   * Check if any setup commands are running for a workspace
   */
  isWorkspaceRunning(workspaceId: string): boolean {
    const processes = this.executions.get(workspaceId);
    return processes ? processes.length > 0 : false;
  }

  /**
   * Get running workspace IDs
   */
  getRunningWorkspaces(): string[] {
    return Array.from(this.executions.keys()).filter(id => this.isWorkspaceRunning(id));
  }

  /**
   * Validate setup command syntax
   */
  validateCommand(command: string): { valid: boolean; error?: string } {
    if (!command || command.trim().length === 0) {
      return { valid: false, error: 'Command cannot be empty' };
    }

    // Basic security checks
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,  // rm -rf /
      /sudo\s+rm/,     // sudo rm
      />\s*\/dev\/sd/,  // writing to disk devices
      /mkfs/,          // filesystem formatting
      /dd\s+if=/,      // disk imaging
      /shutdown/,      // system shutdown
      /reboot/,        // system reboot
      /halt/,          // system halt
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          error: 'Command contains potentially dangerous operations'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate a command group
   */
  validateCommandGroup(commands: string[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(commands) || commands.length === 0) {
      errors.push('Commands must be a non-empty array');
      return { valid: false, errors };
    }

    for (let i = 0; i < commands.length; i++) {
      const validation = this.validateCommand(commands[i]);
      if (!validation.valid) {
        errors.push(`Command ${i + 1}: ${validation.error}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get a summary of recent setup command activity
   */
  async getSetupSummary(workspaceId: string, projectId?: string): Promise<{
    totalCommands: number;
    enabledCommands: number;
    commandGroups: Array<{
      id: string;
      name?: string;
      type: 'global' | 'project' | 'workspace';
      commandCount: number;
      enabled: boolean;
    }>;
  }> {
    const commands = await databaseService.getSetupCommands("global");
    const projectCommands = projectId ? await databaseService.getSetupCommands("project", projectId) : [];
    const workspaceCommands = await databaseService.getSetupCommands("workspace", workspaceId);

    const allCommands = [...commands, ...projectCommands, ...workspaceCommands];

    return {
      totalCommands: allCommands.reduce((sum, cmd) => sum + cmd.commands.length, 0),
      enabledCommands: allCommands.filter(cmd => cmd.enabled).reduce((sum, cmd) => sum + cmd.commands.length, 0),
      commandGroups: allCommands.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        type: cmd.type,
        commandCount: cmd.commands.length,
        enabled: cmd.enabled
      }))
    };
  }
}

// Singleton instance
export const setupCommandsService = new SetupCommandsService();