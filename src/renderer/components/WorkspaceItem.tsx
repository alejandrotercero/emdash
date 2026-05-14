import React from 'react';
import { GitBranch, Bot, Archive } from 'lucide-react';
import WorkspaceDeleteButton from './WorkspaceDeleteButton';
import { useWorkspaceChanges } from '../hooks/useWorkspaceChanges';
import { ChangesBadge } from './WorkspaceChanges';
import { Spinner } from './ui/spinner';
import { usePrStatus } from '../hooks/usePrStatus';
import { useWorkspaceBusy } from '../hooks/useWorkspaceBusy';

function PrStateBadge({
  pr,
}: {
  pr: { isDraft?: boolean; state: string; number: number; title?: string };
}) {
  const label = pr.isDraft ? 'draft' : pr.state.toLowerCase();
  const cls =
    pr.isDraft || pr.state === 'CLOSED'
      ? 'border-border bg-muted text-muted-foreground'
      : pr.state === 'MERGED'
        ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
        : 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300';
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-xs ${cls}`}
      title={`${pr.title || 'Pull Request'} (#${pr.number})`}
    >
      {label}
    </span>
  );
}

interface Workspace {
  id: string;
  name: string;
  branch: string;
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  worktreeType?: 'worktree' | 'main';
}

interface WorkspaceItemProps {
  workspace: Workspace;
  index?: number; // For keyboard shortcuts (1-9)
  onDelete?: () => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
}

export const WorkspaceItem: React.FC<WorkspaceItemProps> = ({
  workspace,
  index,
  onDelete,
  onRemove,
}) => {
  const { totalAdditions, totalDeletions, isLoading } = useWorkspaceChanges(
    workspace.path,
    workspace.id
  );
  const { pr } = usePrStatus(workspace.path);
  const isRunning = useWorkspaceBusy(workspace.id);

  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <div className="flex min-w-0 items-center justify-between">
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <div className="flex items-center gap-2">
          {isRunning || workspace.status === 'running' || workspace.agentId ? (
            <Spinner size="sm" className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <GitBranch className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="block truncate text-xs font-medium text-foreground">{workspace.name}</span>
          {workspace.agentId && <Bot className="h-3 w-3 flex-shrink-0 text-purple-500" />}
          {workspace.worktreeType === 'main' && (
            <span
              className="max-w-[60px] truncate rounded border border-green-300 bg-green-50 px-1 py-0.5 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
              title={workspace.branch}
            >
              {workspace.branch}
            </span>
          )}
        </div>
        {index && index <= 9 && (
          <div className="ml-5 mt-0.5 flex items-center gap-1.5 font-mono-custom">
            <span className="text-[10px] text-muted-foreground">⌘{index}</span>
            {!isLoading && totalAdditions > 0 && (
              <span className="text-[10px] text-green-600 dark:text-green-400">+{totalAdditions}</span>
            )}
            {!isLoading && totalDeletions > 0 && (
              <span className="text-[10px] text-red-600 dark:text-red-400">-{totalDeletions}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center space-x-2">
        {!isLoading && (totalAdditions > 0 || totalDeletions > 0) && !index ? (
          <ChangesBadge additions={totalAdditions} deletions={totalDeletions} />
        ) : pr && workspace.worktreeType !== 'main' ? (
          <div className="flex items-center gap-1">
            {(pr.state === 'MERGED' || pr.state === 'CLOSED') && onDelete ? (
              <WorkspaceDeleteButton
                workspaceName={workspace.name}
                onConfirm={async () => {
                  try {
                    setIsDeleting(true);
                    await onDelete();
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                isDeleting={isDeleting}
                aria-label={`Delete workspace ${workspace.name}`}
                className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              />
            ) : null}
            <PrStateBadge pr={pr} />
          </div>
        ) : null}

        {/* Show Archive button for main branch workspaces */}
        {workspace.worktreeType === 'main' && onRemove ? (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                setIsDeleting(true);
                await onRemove();
              } finally {
                setIsDeleting(false);
              }
            }}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Remove from app (files not deleted)"
            aria-label={`Remove workspace ${workspace.name}`}
          >
            <Archive className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
