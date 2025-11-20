import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import FileChangesPanel from './FileChangesPanel';
import WorkspaceTerminalPanel from './WorkspaceTerminalPanel';
import { useRightSidebar } from './ui/right-sidebar';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { useFileChanges } from '../hooks/useFileChanges';
import { useCreatePR } from '../hooks/useCreatePR';
import { usePrStatus } from '../hooks/usePrStatus';
import { Spinner } from './ui/spinner';

export interface RightSidebarWorkspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  projectId?: string;
  projectGitInfo?: {
    isGitRepo: boolean;
  };
  worktreeType?: 'worktree' | 'main';
}

interface RightSidebarProps extends React.HTMLAttributes<HTMLElement> {
  workspace: RightSidebarWorkspace | null;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ workspace, className, ...rest }) => {
  const { collapsed } = useRightSidebar();
  const [changesCollapsed, setChangesCollapsed] = useState(false);

  // Get file changes data for the summary when collapsed
  const { fileChanges, refreshChanges } = useFileChanges(workspace?.path || '');
  const { isCreating: isCreatingPR, createPR } = useCreatePR();
  const { pr, refresh: refreshPr } = usePrStatus(workspace?.path || '');
  const totalChanges = fileChanges.reduce(
    (acc, change) => ({
      additions: acc.additions + change.additions,
      deletions: acc.deletions + change.deletions,
    }),
    { additions: 0, deletions: 0 }
  );
  const hasChanges = fileChanges.length > 0;

  return (
    <aside
      data-state={collapsed ? 'collapsed' : 'open'}
      className={cn(
        'group/right-sidebar relative z-[60] flex h-full w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-muted/10 transition-all duration-200 ease-linear',
        'data-[state=collapsed]:pointer-events-none data-[state=collapsed]:border-l-0',
        className
      )}
      aria-hidden={collapsed}
      {...rest}
    >
      <div className="flex h-full w-full min-w-0 flex-col">
        {workspace ? (
          <div className="flex h-full flex-col">
            {/* Collapsible File Changes Panel */}
            <div className={cn("flex flex-col", changesCollapsed ? "min-h-0" : "min-h-0 flex-none border-b border-border")}>
              <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChangesCollapsed(!changesCollapsed)}
                    className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title={changesCollapsed ? "Show changes" : "Hide changes"}
                  >
                    {changesCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  {hasChanges ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {fileChanges.length} files changed
                      </span>
                      <div className="flex items-center space-x-1 text-xs">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          +{totalChanges.additions}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          -{totalChanges.deletions}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">No changes</span>
                  )}
                </div>
                {pr ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 border-gray-200 px-1.5 text-[11px] text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    title="Open pull request in browser"
                    onClick={() => {
                      window.electronAPI.openExternal(pr.url);
                    }}
                  >
                    Open PR
                  </Button>
                ) : (
                  hasChanges && workspace?.worktreeType !== 'main' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-5 border-gray-200 px-1.5 text-[11px] text-gray-700 dark:border-gray-700 dark:text-gray-200"
                      disabled={isCreatingPR}
                      title="Commit all changes and create a pull request"
                      onClick={async () => {
                        await createPR({
                          workspacePath: workspace?.path || '',
                          onSuccess: async () => {
                            await refreshChanges();
                            await refreshPr();
                          },
                        });
                      }}
                    >
                      {isCreatingPR ? <Spinner size="sm" /> : 'Create PR'}
                    </Button>
                  )
                )}
              </div>
              {!changesCollapsed && (
                <FileChangesPanel
                  workspaceId={workspace.path}
                  className="min-h-0 flex-1"
                />
              )}
            </div>
            
            {/* Terminal Panel - expands to fill remaining space when changes are collapsed */}
            <WorkspaceTerminalPanel 
              workspace={workspace} 
              className={cn("min-h-0", changesCollapsed ? "flex-1" : "flex-1")} 
            />
          </div>
        ) : (
          <div className="flex h-full flex-col text-sm text-muted-foreground">
            {/* Empty state for changes */}
            <div className="flex flex-col border-b border-border">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 dark:bg-gray-900">
                <ChevronRight className="h-4 w-4" />
                <span className="text-sm font-medium text-foreground">Changes</span>
              </div>
              <div className="flex flex-1 items-center justify-center px-4 py-4 text-center">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  Select a workspace to review file changes.
                </span>
              </div>
            </div>
            {/* Empty state for terminal */}
            <div className="flex flex-1 flex-col bg-background">
              <div className="border-b border-border bg-gray-50 px-3 py-1.5 text-sm font-medium text-foreground dark:bg-gray-900">
                <span className="whitespace-nowrap">Terminal</span>
              </div>
              <div className="flex flex-1 items-center justify-center px-4 py-4 text-center">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm">
                  Select a workspace to open its terminal.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default RightSidebar;
