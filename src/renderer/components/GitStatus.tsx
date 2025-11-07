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

interface GitStatusProps {
  projectPath: string;
  projectId: string;
  currentBranch?: string;
}

export const GitStatus: React.FC<GitStatusProps> = ({
  projectPath,
  projectId,
  currentBranch
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const { toast } = useToast();

  const fetchGitStatus = async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      // Check if git status API is available
      if (typeof (window as any).electronAPI['git:get-remote-status'] !== 'function') {
        console.warn('Git status API not available');
        setGitStatus(null);
        return;
      }

      const result = await (window as any).electronAPI['git:get-remote-status']({
        workspacePath: projectPath
      });

      if (result?.success) {
        setGitStatus(result.status);
      } else {
        console.warn('Git status call failed:', result?.error);
        setGitStatus(null);
      }
    } catch (error) {
      console.error('Failed to fetch git status:', error);
      setGitStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePull = async () => {
    if (!projectPath || isPulling) return;

    setIsPulling(true);
    try {
      const result = await (window as any).electronAPI['git:pull']({
        workspacePath: projectPath
      });

      if (result?.success) {
        toast({
          title: "Git pull successful",
          description: result.message,
        });
        // Refresh status after pull
        await fetchGitStatus();
      } else {
        toast({
          title: "Git pull failed",
          description: result?.message || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Git pull failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
    }
  };

  // Set up git polling and event listeners
  useEffect(() => {
    if (!projectPath || !projectId) return;

    const initializeGitPolling = async () => {
      try {
        // Check if git polling API is available
        if (typeof (window as any).electronAPI['git-polling:add-project'] !== 'function') {
          console.warn('Git polling API not available, skipping git polling');
          // Still try to fetch initial status
          await fetchGitStatus().catch(() => {});
          return;
        }

        // Add to git polling
        await (window as any).electronAPI['git-polling:add-project']({
          projectId,
          projectPath,
          config: {
            enabled: true,
            intervalMinutes: 5,
            autoFetch: true
          }
        });

        // Initial fetch
        await fetchGitStatus();
      } catch (error) {
        console.error('Failed to initialize git polling:', error);
      }
    };

    initializeGitPolling();

    // Set up event listeners for git polling updates
    const handleGitUpdate = (event: any) => {
      if (event.projectId === projectId && event.status) {
        setGitStatus(event.status);
      }
    };

    const handleGitError = (event: any) => {
      if (event.projectId === projectId) {
        console.error('Git polling error:', event.error);
      }
    };

    const handleGitPull = (event: any) => {
      if (event.projectId === projectId) {
        // Refresh status after pull completes
        fetchGitStatus();
      }
    };

    // Add event listeners safely
    const cleanupUpdate = typeof (window as any).electronAPI.on === 'function'
      ? (window as any).electronAPI.on('git-polling:update', handleGitUpdate)
      : null;
    const cleanupError = typeof (window as any).electronAPI.on === 'function'
      ? (window as any).electronAPI.on('git-polling:error', handleGitError)
      : null;
    const cleanupPull = typeof (window as any).electronAPI.on === 'function'
      ? (window as any).electronAPI.on('git-polling:pull', handleGitPull)
      : null;

    return () => {
      // Cleanup polling and event listeners
      try {
        if (typeof (window as any).electronAPI['git-polling:remove-project'] === 'function') {
          (window as any).electronAPI['git-polling:remove-project']({ projectId });
        }
      } catch (error) {
        console.error('Failed to remove git polling project:', error);
      }
      cleanupUpdate?.();
      cleanupError?.();
      cleanupPull?.();
    };
  }, [projectPath, projectId]);

  if (!gitStatus) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="size-3" />
          Checking git status...
        </Badge>
      </div>
    );
  }

  const { ahead, behind, hasNewCommits, currentBranch: gitBranch, remoteBranch } = gitStatus;

  return (
    <div className="flex items-center gap-3">
      <Badge
        variant={hasNewCommits ? "outline" : "secondary"}
        className={`gap-1 ${hasNewCommits ? "border-red-200 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" : ""}`}
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
          variant="outline"
          onClick={handlePull}
          disabled={isPulling}
          className="gap-1"
        >
          {isPulling ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          {isPulling ? 'Pulling...' : 'Pull Changes'}
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={fetchGitStatus}
        disabled={isLoading}
        className="gap-1"
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