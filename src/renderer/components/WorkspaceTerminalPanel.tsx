import React from 'react';
import { TerminalPane } from './TerminalPane';
import { Bot, Terminal } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import SimpleGitWorkspaceStatus from './SimpleGitWorkspaceStatus';

interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  projectId?: string;
  projectGitInfo?: {
    isGitRepo: boolean;
  };
}

interface Props {
  workspace: Workspace | null;
  className?: string;
}

const WorkspaceTerminalPanelComponent: React.FC<Props> = ({ workspace, className }) => {
  const { effectiveTheme } = useTheme();

  if (!workspace) {
    return (
      <div
        className={`flex h-full flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 ${className}`}
      >
        <Bot className="mb-2 h-8 w-8 text-neutral-400" />
        <h3 className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">No Workspace Selected</h3>
        <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          Select a workspace to view its terminal
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-neutral-800 ${className}`}>
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex min-w-0 items-center space-x-2">
          <h3
            className="max-w-[220px] truncate text-sm font-medium text-neutral-900 dark:text-neutral-100"
            title={workspace.name}
          >
            Terminal
          </h3>
        </div>
        {workspace?.projectGitInfo?.isGitRepo && workspace?.projectId && (
          <SimpleGitWorkspaceStatus
            workspacePath={workspace.path}
            workspaceId={workspace.id}
            projectId={workspace.projectId}
            branch={workspace.branch}
            compact={true}
          />
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <TerminalPane
          id={`workspace-${workspace.id}`}
          cwd={workspace.path}
          keepAlive={true}
          variant={effectiveTheme === 'dark' ? 'dark' : 'light'}
          className="h-full w-full"
        />
      </div>
    </div>
  );
};
export const WorkspaceTerminalPanel = React.memo(WorkspaceTerminalPanelComponent);

export default WorkspaceTerminalPanel;
