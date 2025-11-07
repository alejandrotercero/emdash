import React, { useState, useCallback } from 'react';
import { Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
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

interface SimpleGitStatusProps {
  projectPath: string;
  projectId: string;
  currentBranch?: string;
}

const SimpleGitStatus: React.FC<SimpleGitStatusProps> = ({
  projectPath,
  projectId,
  currentBranch = 'main',
}) => {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const { toast } = useToast();

  const checkForUpdates = useCallback(async () => {
    if (!projectPath) return;

    setIsChecking(true);
    try {
      console.log('SimpleGitStatus: Starting git fetch for path:', projectPath);

      // Use git:fetch to check for updates
      const fetchResult = await window.electronAPI.gitFetch?.({
        workspacePath: projectPath
      });

      console.log('SimpleGitStatus: Git fetch result:', fetchResult);

      if (fetchResult?.success) {
        // Parse the fetch result to get behind count
        const output = fetchResult.output || '';
        console.log('Git status output:', output);

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
          currentBranch,
          remoteBranch: `origin/${currentBranch}`
        };

        setGitStatus(status);
        console.log('Parsed git status:', status);
      } else {
        console.error('Git fetch failed:', fetchResult?.error);
        toast({
          title: "Git Check Failed",
          description: fetchResult?.message || "Could not check for remote updates",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('SimpleGitStatus: Failed to check for updates:', error);
      console.error('SimpleGitStatus: Error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        projectPath,
        electronAPIAvailable: !!window.electronAPI,
        gitFetchAvailable: !!window.electronAPI?.gitFetch
      });

      const errorMessage = error instanceof Error ? error.message : "Could not check for remote updates";
      const isGitNotInstalled = errorMessage.includes('Git is not installed');

      toast({
        title: isGitNotInstalled ? "Git Not Found" : "Git Check Failed",
        description: isGitNotInstalled
          ? "Git is not installed or not in PATH. Please install Git to use this feature."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  }, [projectPath, currentBranch, toast]);

  const handlePull = useCallback(async () => {
    if (!projectPath || isPulling) return;

    setIsPulling(true);
    try {
      console.log('SimpleGitStatus: Starting git pull for path:', projectPath);

      const result = await window.electronAPI.gitPull?.({
        workspacePath: projectPath
      });

      console.log('SimpleGitStatus: Git pull result:', result);

      if (result?.success) {
        toast({
          title: "Pull Successful",
          description: `Updated ${gitStatus?.behind || 0} commits`,
        });
        // Refresh status after pull
        setGitStatus(null);
        await checkForUpdates();
      } else {
        throw new Error(result?.error || 'Pull failed');
      }
    } catch (error) {
      console.error('SimpleGitStatus: Failed to pull:', error);
      console.error('SimpleGitStatus: Pull error details:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        projectPath,
        electronAPIAvailable: !!window.electronAPI,
        gitPullAvailable: !!window.electronAPI?.gitPull
      });

      const errorMessage = error instanceof Error ? error.message : "Could not pull updates";
      const isGitNotInstalled = errorMessage.includes('Git is not installed');

      toast({
        title: isGitNotInstalled ? "Git Not Found" : "Pull Failed",
        description: isGitNotInstalled
          ? "Git is not installed or not in PATH. Please install Git to use this feature."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPulling(false);
    }
  }, [projectPath, gitStatus, toast, checkForUpdates]);

  // Initial check
  React.useEffect(() => {
    if (projectPath) {
      checkForUpdates();
    }
  }, [projectPath, checkForUpdates]);

  if (!gitStatus) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={checkForUpdates}
          disabled={isChecking}
          className="gap-1"
        >
          {isChecking ? (
            <>
              <RefreshCw className="size-3 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="size-3" />
              Check Updates
            </>
          )}
        </Button>
      </div>
    );
  }

  const { ahead, behind, hasNewCommits, currentBranch: gitBranch, remoteBranch } = gitStatus;

  return (
    <div className="flex items-center gap-3">
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
          className="gap-1 border-green-200 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
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

export default SimpleGitStatus;