import { EventEmitter } from 'events';
import { getRemoteStatus, fetchFromRemote } from './GitService';

export interface GitPollingConfig {
  enabled: boolean;
  intervalMinutes: number;
  autoFetch: boolean;
}

export interface GitUpdateEvent {
  projectId: string;
  projectPath: string;
  status: {
    ahead: number;
    behind: number;
    hasNewCommits: boolean;
    currentBranch: string;
    remoteBranch: string;
  } | null;
  timestamp: Date;
}

export class GitPollingService extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private projects: Map<string, { path: string; config: GitPollingConfig }> = new Map();
  private defaultConfig: GitPollingConfig = {
    enabled: true,
    intervalMinutes: 5,
    autoFetch: true
  };

  constructor() {
    super();
  }

  /**
   * Add a project to monitor
   */
  addProject(projectId: string, projectPath: string, config?: Partial<GitPollingConfig>): void {
    const fullConfig = { ...this.defaultConfig, ...config };
    this.projects.set(projectId, { path: projectPath, config: fullConfig });

    if (fullConfig.enabled) {
      this.startPolling(projectId);
    }
  }

  /**
   * Remove a project from monitoring
   */
  removeProject(projectId: string): void {
    this.stopPolling(projectId);
    this.projects.delete(projectId);
  }

  /**
   * Update project configuration
   */
  updateProjectConfig(projectId: string, config: Partial<GitPollingConfig>): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    // Stop existing polling
    this.stopPolling(projectId);

    // Update config
    const fullConfig = { ...this.defaultConfig, ...config };
    this.projects.set(projectId, { ...project, config: fullConfig });

    // Restart polling if enabled
    if (fullConfig.enabled) {
      this.startPolling(projectId);
    }
  }

  /**
   * Get all monitored projects
   */
  getMonitoredProjects(): Array<{ projectId: string; path: string; config: GitPollingConfig }> {
    return Array.from(this.projects.entries()).map(([projectId, { path, config }]) => ({
      projectId,
      path,
      config
    }));
  }

  /**
   * Manual check for updates
   */
  async checkForUpdates(projectId: string): Promise<GitUpdateEvent | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;

    try {
      const status = await getRemoteStatus(project.path);
      const event: GitUpdateEvent = {
        projectId,
        projectPath: project.path,
        status,
        timestamp: new Date()
      };

      this.emit('git-update', event);
      return event;
    } catch (error) {
      console.error(`Failed to check git updates for project ${projectId}:`, error);
      this.emit('git-error', { projectId, error });
      return null;
    }
  }

  /**
   * Pull updates for a project
   */
  async pullUpdates(projectId: string): Promise<{ success: boolean; message: string }> {
    const project = this.projects.get(projectId);
    if (!project) {
      return {
        success: false,
        message: 'Project not found'
      };
    }

    try {
      // Import here to avoid circular dependency
      const { pullFromRemote } = await import('./GitService');
      const result = await pullFromRemote(project.path);

      // Emit update event after pull
      if (result.success) {
        await this.checkForUpdates(projectId);
      }

      this.emit('git-pull', { projectId, result });
      return result;
    } catch (error: any) {
      const errorMessage = `Pull failed: ${error.message}`;
      this.emit('git-error', { projectId, error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Start polling for a specific project
   */
  private startPolling(projectId: string): void {
    this.stopPolling(projectId); // Ensure no duplicate intervals

    const project = this.projects.get(projectId);
    if (!project || !project.config.enabled) return;

    const intervalMs = project.config.intervalMinutes * 60 * 1000;

    // Check immediately on start
    this.checkForUpdates(projectId);

    // Set up recurring checks
    const interval = setInterval(() => {
      this.checkForUpdates(projectId);
    }, intervalMs);

    this.intervals.set(projectId, interval);
  }

  /**
   * Stop polling for a specific project
   */
  private stopPolling(projectId: string): void {
    const interval = this.intervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(projectId);
    }
  }

  /**
   * Stop all polling
   */
  stopAll(): void {
    for (const projectId of this.intervals.keys()) {
      this.stopPolling(projectId);
    }
  }

  /**
   * Get current status of all monitored projects
   */
  async getAllStatuses(): Promise<GitUpdateEvent[]> {
    const events: GitUpdateEvent[] = [];

    for (const [projectId, project] of this.projects) {
      try {
        const status = await getRemoteStatus(project.path);
        events.push({
          projectId,
          projectPath: project.path,
          status,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`Failed to get status for project ${projectId}:`, error);
        events.push({
          projectId,
          projectPath: project.path,
          status: null,
          timestamp: new Date()
        });
      }
    }

    return events;
  }

  /**
   * Enable/disable polling for all projects
   */
  setGlobalEnabled(enabled: boolean): void {
    for (const projectId of this.projects.keys()) {
      this.updateProjectConfig(projectId, { enabled });
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig(): GitPollingConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Update default configuration for new projects
   */
  updateDefaultConfig(config: Partial<GitPollingConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// Singleton instance
export const gitPollingService = new GitPollingService();