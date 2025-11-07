import React, { useState, useCallback } from 'react';
import { Download, CheckCircle, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

interface GitStatus {
  ahead: number;
  behind: number;
  hasNewCommits: boolean;
  currentBranch: string;
  remoteBranch: string;
}

interface SimpleGitWorkspaceStatusProps {
  workspacePath: string;
  workspaceId: string;
  projectId: string;
  branch: string;
  compact?: boolean;
}

const SimpleGitWorkspaceStatus: React.FC<SimpleGitWorkspaceStatusProps> = ({
  workspacePath,
  workspaceId,
  projectId,
  branch,
  compact = false,
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const { toast } = useToast();

  const checkForUpdates = useCallback(async () => {
    if (!workspacePath) return;

    setIsChecking(true);
    try {
      console.log('SimpleGitWorkspaceStatus: Starting git fetch for workspace path:', workspacePath);

      // Use git:fetch to check for updates
      const fetchResult = await window.electronAPI.gitFetch?.({
        workspacePath
      });

      console.log('SimpleGitWorkspaceStatus: Git fetch result:', fetchResult);

      if (fetchResult?.success) {
        // Parse the fetch result to get behind count
        const output = fetchResult.output || '';
        console.log('Git status output for workspace:', output);

        // Look for various patterns of "behind" messages
        let behind = 0;
        let ahead = 0;

        // Common patterns for "behind" in git status
        const behindPatterns = [
          /Your branch is behind by (\d+) commits?/,
          /behind .*?(\d+) commits?/,
          /(\d+) commits? behind/,
          /Your branch and '.*' have diverged.*?by (\d+) commits?/i
        ];

        // Common patterns for "ahead" messages
        const aheadPatterns = [
          /Your branch is ahead by (\d+) commits?/,
          /ahead .*?(\d+) commits?/,
          /(\d+) commits? ahead/,
          /Your branch is ahead of .*? by (\d+) commits?/i
        ];

        for (const pattern of behindPatterns) {
          const match = output.match(pattern);
          if (match) {
            behind = parseInt(match[1]);
            break;
          }
        }

        for (const pattern of aheadPatterns) {
          const match = output.match(pattern);
          if (match) {
            ahead = parseInt(match[1]);
            break;
          }
        }

        const status: GitStatus = {
          ahead,
          behind,
          hasNewCommits: behind > 0,
          currentBranch: branch,
          remoteBranch: `origin/${branch}`
        };

        setGitStatus(status);
        console.log('Parsed workspace git status:', status);
      } else {
        console.error('Git fetch failed for workspace:', fetchResult?.error);
        if (!compact) {
          toast({
            title: "Git Check Failed",
            description: fetchResult?.message || "Could not check for remote updates",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('SimpleGitWorkspaceStatus: Failed to check workspace updates:', error);
      console.error('SimpleGitWorkspaceStatus: Error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        workspacePath,
        compact,
        electronAPIAvailable: !!window.electronAPI,
        gitFetchAvailable: !!window.electronAPI?.gitFetch
      });
      if (!compact) {
        toast({
          title: "Git Check Failed",
          description: error instanceof Error ? error.message : "Could not check for remote updates",
          variant: "destructive",
        });
      }
    } finally {
      setIsChecking(false);
    }
  }, [workspacePath, branch, compact, toast]);

  const handlePull = useCallback(async () => {
    if (!workspacePath || isPulling) return;

    setIsPulling(true);
    try {
      console.log('SimpleGitWorkspaceStatus: Starting git pull for workspace path:', workspacePath);

      const result = await window.electronAPI.gitPull?.({
        workspacePath
      });

      console.log('SimpleGitWorkspaceStatus: Git pull result:', result);

      if (result?.success) {
        if (!compact) {
          toast({
            title: "Pull Successful",
            description: `Updated ${gitStatus?.behind || 0} commits`,
          });
        }
        // Refresh status after pull
        setGitStatus(null);
        await checkForUpdates();
      } else {
        throw new Error(result?.error || 'Pull failed');
      }
    } catch (error) {
      console.error('SimpleGitWorkspaceStatus: Failed to pull:', error);
      console.error('SimpleGitWorkspaceStatus: Pull error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        workspacePath,
        compact,
        electronAPIAvailable: !!window.electronAPI,
        gitPullAvailable: !!window.electronAPI?.gitPull
      });
      if (!compact) {
        toast({
          title: "Pull Failed",
          description: error instanceof Error ? error.message : "Could not pull updates",
          variant: "destructive",
        });
      }
    } finally {
      setIsPulling(false);
    }
  }, [workspacePath, gitStatus, toast, checkForUpdates, compact]);

  // Initial check
  React.useEffect(() => {
    if (workspacePath) {
      checkForUpdates();
    }
  }, [workspacePath, checkForUpdates]);

  const hasNewCommits = gitStatus?.hasNewCommits || false;
  const behind = gitStatus?.behind || 0;

  if (compact && !gitStatus) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={checkForUpdates}
        disabled={isChecking}
        className="h-6 w-6 p-0"
        title="Check for git updates"
      >
        <RefreshCw className={`size-3 ${isChecking ? 'animate-spin' : ''}`} />
      </Button>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {hasNewCommits ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePull}
            disabled={isPulling}
            className="h-6 px-2 text-xs gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20"
            title={`${behind} commits behind - Click to pull`}
          >
            {isPulling ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            {behind}
          </Button>
        ) : (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400" title="Up to date">
            <CheckCircle className="size-3" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={checkForUpdates}
          disabled={isChecking}
          className="h-6 w-6 p-0"
          title="Check for updates"
        >
          <RefreshCw className={`size-3 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {hasNewCommits ? (
        <Button
          variant="default"
          size="sm"
          onClick={handlePull}
          disabled={isPulling}
          className="gap-1 h-8 px-3 text-xs border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-900/30"
          title={`Click to pull ${behind} commits`}
        >
          {isPulling ? (
            <>
              <RefreshCw className="size-3 animate-spin" />
              Pulling...
            </>
          ) : (
            <>
              <Download className="size-3" />
              Pull ({behind})
            </>
          )}
        </Button>
      ) : (
        <Badge
          variant="default"
          className="gap-1 text-xs border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
        >
          <CheckCircle className="size-3" />
          Up to date
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={checkForUpdates}
        disabled={isChecking}
        className="h-7 w-7 p-0"
        title="Check for updates"
      >
        <RefreshCw className={`size-3 ${isChecking ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
};

export default SimpleGitWorkspaceStatus;