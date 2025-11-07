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
        className={`flex h-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 ${className}`}
      >
        <Bot className="mb-2 h-8 w-8 text-gray-400" />
        <h3 className="mb-1 text-sm text-gray-600 dark:text-gray-400">No Workspace Selected</h3>
        <p className="text-center text-xs text-gray-500 dark:text-gray-500">
          Select a workspace to view its terminal
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col bg-white dark:bg-gray-800 ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex min-w-0 items-center space-x-2">
          <h3
            className="max-w-[220px] truncate text-sm font-medium text-gray-900 dark:text-gray-100"
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
          variant={effectiveTheme === 'dark' ? 'dark' : 'light'}
          className="h-full w-full"
        />
      </div>
    </div>
  );
};
export const WorkspaceTerminalPanel = React.memo(WorkspaceTerminalPanelComponent);

export default WorkspaceTerminalPanel;
