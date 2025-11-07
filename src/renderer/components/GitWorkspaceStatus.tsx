import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface GitStatus {
  ahead: number;
  behind: number;
  hasNewCommits: boolean;
  currentBranch: string;
  remoteBranch: string;
}

interface GitWorkspaceStatusProps {
  workspacePath: string;
  workspaceId: string;
  projectId: string;
  branch: string;
  compact?: boolean;
}

export const GitWorkspaceStatus: React.FC<GitWorkspaceStatusProps> = ({
  workspacePath,
  workspaceId,
  projectId,
  branch,
  compact = false
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const { toast } = useToast();

  const fetchGitStatus = async () => {
    if (!workspacePath) return;

    setIsLoading(true);
    try {
      const result = await (window as any).electronAPI['git:get-remote-status']({
        workspacePath
      });

      if (result?.success) {
        setGitStatus(result.status);
      }
    } catch (error) {
      console.error('Failed to fetch workspace git status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePull = async () => {
    if (!workspacePath || isPulling) return;

    setIsPulling(true);
    try {
      const result = await (window as any).electronAPI['git:pull']({
        workspacePath
      });

      if (result?.success) {
        toast({
          title: "Workspace git pull successful",
          description: result.message,
        });
        // Refresh status after pull
        await fetchGitStatus();
      } else {
        toast({
          title: "Workspace git pull failed",
          description: result?.message || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Workspace git pull failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
    }
  };

  // Set up git polling for this workspace
  useEffect(() => {
    if (!workspacePath || !workspaceId || !projectId) return;

    const initializeWorkspacePolling = async () => {
      try {
        // Check if git polling API is available
        if (typeof (window as any).electronAPI['git-polling:add-project'] !== 'function') {
          console.warn('Git polling API not available, skipping workspace git polling');
          return;
        }

        // Add to git polling for workspace
        await (window as any).electronAPI['git-polling:add-project']({
          projectId: `${projectId}-${workspaceId}`, // Unique ID for workspace
          projectPath: workspacePath,
          config: {
            enabled: true,
            intervalMinutes: 3, // More frequent for workspaces
            autoFetch: true
          }
        });

        // Initial fetch
        await fetchGitStatus();
      } catch (error) {
        console.error('Failed to initialize workspace git polling:', error);
      }
    };

    initializeWorkspacePolling();

    // Set up event listeners for git polling updates
    const handleGitUpdate = (event: any) => {
      if (event.projectPath === workspacePath && event.status) {
        setGitStatus(event.status);
      }
    };

    const handleGitError = (event: any) => {
      if (event.projectPath === workspacePath) {
        console.error('Workspace git polling error:', event.error);
      }
    };

    // Add event listeners safely
    const cleanupUpdate = typeof (window as any).electronAPI.on === 'function'
      ? (window as any).electronAPI.on('git-polling:update', handleGitUpdate)
      : null;
    const cleanupError = typeof (window as any).electronAPI.on === 'function'
      ? (window as any).electronAPI.on('git-polling:error', handleGitError)
      : null;

    return () => {
      // Cleanup polling and event listeners
      try {
        (window as any).electronAPI['git-polling:remove-project']({
          projectId: `${projectId}-${workspaceId}`
        });
      } catch (error) {
        console.error('Failed to remove git polling project:', error);
      }
      cleanupUpdate?.();
      cleanupError?.();
    };
  }, [workspacePath, workspaceId, projectId]);

  if (compact && !gitStatus) {
    return (
      <div className="flex items-center gap-1">
        {isLoading ? (
          <RefreshCw className="size-3 animate-spin text-muted-foreground" />
        ) : (
          <AlertCircle className="size-3 text-muted-foreground" />
        )}
      </div>
    );
  }

  if (!gitStatus) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 text-xs">
          {isLoading ? (
            <>
              <RefreshCw className="size-3 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <AlertCircle className="size-3" />
              Git
            </>
          )}
        </Badge>
      </div>
    );
  }

  const { ahead, behind, hasNewCommits, currentBranch: gitBranch, remoteBranch } = gitStatus;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {hasNewCommits ? (
          <Download className="size-3 text-orange-500" />
        ) : (
          <CheckCircle className="size-3 text-green-500" />
        )}
        {isPulling && <RefreshCw className="size-3 animate-spin" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={hasNewCommits ? "outline" : "secondary"}
        className={`gap-1 text-xs ${hasNewCommits ? "border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" : ""}`}
      >
        {hasNewCommits ? (
          <Download className="size-3" />
        ) : (
          <CheckCircle className="size-3" />
        )}
        {gitBranch}
        {behind > 0 && (
          <span className="text-xs">
            {behind} behind
          </span>
        )}
      </Badge>

      {hasNewCommits && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handlePull}
          disabled={isPulling}
          className="gap-1 h-6 px-2"
          title={`Pull ${behind} commits`}
        >
          {isPulling ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={fetchGitStatus}
        disabled={isLoading}
        className="gap-1 h-6 px-2"
        title="Refresh git status"
      >
        {isLoading ? (
          <RefreshCw className="size-3 animate-spin" />
        ) : (
          <RefreshCw className="size-3" />
        )}
      </Button>
    </div>
  );
};