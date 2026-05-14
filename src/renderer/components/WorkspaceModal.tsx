import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Spinner } from './ui/spinner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { X, GitBranch } from 'lucide-react';
import { ProviderSelector } from './ProviderSelector';
import type { CliProviderStatus } from "../types/connections";
import { type Provider } from '../types';
import { Separator } from './ui/separator';
import { type LinearIssueSummary } from '../types/linear';
import { LinearIssueSelector } from './LinearIssueSelector';
import SimpleGitStatus from './SimpleGitStatus';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (
    name: string,
    initialPrompt?: string,
    selectedProvider?: Provider,
    linkedIssue?: LinearIssueSummary | null,
    worktreeType?: 'worktree' | 'main'
  ) => void;
  projectName: string;
  projectPath: string;
  defaultBranch: string;
  projectId: string;
  existingNames?: string[];
  detectedProviders?: CliProviderStatus[];
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace,
  projectName,
  projectPath,
  defaultBranch,
  projectId,
  existingNames = [],
  detectedProviders,
}) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<Provider>('codex');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<LinearIssueSummary | null>(null);
  const [linearConnected, setLinearConnected] = useState(false);
  const [worktreeType, setWorktreeType] = useState<'worktree' | 'main'>('worktree');
  const shouldReduceMotion = useReducedMotion();

  const normalizedExisting = existingNames.map((n) => n.toLowerCase());

  // Convert input to valid workspace name format
  const convertToWorkspaceName = (input: string): string => {
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove invalid characters
      .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  const validate = (value: string): string | null => {
    // No validation needed for main branch workspaces
    if (worktreeType === 'main') {
      return null;
    }

    const name = value.trim();
    if (!name) return 'Please enter a workspace name.';

    const convertedName = convertToWorkspaceName(name);
    if (!convertedName) return 'Please enter a valid workspace name.';

    if (normalizedExisting.includes(convertedName)) {
      return 'A workspace with this name already exists.';
    }
    if (convertedName.length > 64) {
      return 'Name is too long (max 64 characters).';
    }
    return null;
  };

  const onChange = (val: string) => {
    if (!touched) setTouched(true);
    setWorkspaceName(val);
    setError(validate(val));
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedIssue(null);
    }
  }, [isOpen]);

  // Check Linear connection status
  useEffect(() => {
    const checkLinearConnection = async () => {
      try {
        const status = await window.electronAPI?.linearCheckConnection?.();
        setLinearConnected(!!status?.connected);
      } catch (error) {
        console.error('Failed to check Linear connection:', error);
        setLinearConnected(false);
      }
    };

    checkLinearConnection();
  }, []);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.1, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 6, scale: 0.995 }
            }
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
            }
            className="mx-4 w-full max-w-lg transform-gpu will-change-transform"
          >
            <Card className="relative w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute right-2 top-2 z-10 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <CardHeader className="space-y-1 pb-2 pr-12">
                <CardTitle className="text-lg">New Workspace</CardTitle>
                <div className="flex items-center justify-between gap-3">
                  <CardDescription className="text-xs text-muted-foreground">
                    {projectName} • from origin/{defaultBranch}
                  </CardDescription>
                  <SimpleGitStatus
                    projectPath={projectPath}
                    projectId={projectId}
                    currentBranch={defaultBranch}
                  />
                </div>
              </CardHeader>

              <CardContent>
                <Separator className="mb-2" />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTouched(true);
                    const err = validate(workspaceName);
                    if (err) {
                      setError(err);
                      return;
                    }
                    setIsCreating(true);
                    (async () => {
                      try {
                        const workspaceNameToUse = worktreeType === 'main'
                          ? `${projectName}-${defaultBranch}`
                          : convertToWorkspaceName(workspaceName);

                        await onCreateWorkspace(
                          workspaceNameToUse,
                          showAdvanced ? initialPrompt.trim() || undefined : undefined,
                          selectedProvider,
                          selectedIssue,
                          worktreeType
                        );
                        setWorkspaceName('');
                        setInitialPrompt('');
                        setSelectedProvider('codex');
                        setSelectedIssue(null);
                        setShowAdvanced(false);
                        setError(null);
                        onClose();
                      } catch (error) {
                        console.error('Failed to create workspace:', error);
                      } finally {
                        setIsCreating(false);
                      }
                    })();
                  }}
                  className="space-y-4"
                >
                  {worktreeType === 'worktree' && (
                    <>
                      <div>
                        <label
                          htmlFor="workspace-name"
                          className="block text-sm font-medium text-foreground"
                        >
                          Task name
                        </label>
                        <Input
                          id="workspace-name"
                          value={workspaceName}
                          onChange={(e) => onChange(e.target.value)}
                          onBlur={() => setTouched(true)}
                          placeholder="e.g. refactorApiRoutes"
                          className="w-full"
                          aria-invalid={touched && !!error}
                          aria-describedby="workspace-name-error"
                          autoFocus={worktreeType === 'worktree'}
                        />
                        {touched && error && (
                          <p id="workspace-name-error" className="mt-2 text-sm text-destructive">
                            {error}
                          </p>
                        )}
                      </div>

                      {workspaceName && (
                        <div className="flex items-center space-x-2 rounded-lg bg-muted p-3">
                          <GitBranch className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span className="overflow-hidden break-all font-mono-custom text-sm text-muted-foreground">
                            {convertToWorkspaceName(workspaceName)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {worktreeType === 'main' && (
                    <div className="flex items-center space-x-2 rounded-lg bg-green-50 p-3 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <GitBranch className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-300">
                        Working directly on <strong>{defaultBranch}</strong>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <label
                      htmlFor="worktree-type"
                      className="w-32 shrink-0 text-sm font-medium text-foreground"
                    >
                      Workspace type
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWorktreeType('worktree')}
                          className={`rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            worktreeType === 'worktree'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Worktree
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorktreeType('main')}
                          className={`rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            worktreeType === 'main'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4" />
                            Main
                          </div>
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {worktreeType === 'worktree'
                          ? 'Create an isolated Git worktree for this workspace'
                          : 'Work directly on the main branch (no isolation)'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label
                      htmlFor="provider-selector"
                      className="w-32 shrink-0 text-sm font-medium text-foreground"
                    >
                      AI provider
                    </label>
                    <div className="min-w-0 flex-1">
                      <ProviderSelector
                        value={selectedProvider}
                        onChange={setSelectedProvider}
                        className="w-full"
                        detectedProviders={detectedProviders}
                      />
                    </div>
                  </div>

                  <Accordion
                    type="single"
                    collapsible
                    value={showAdvanced ? 'advanced' : undefined}
                    onValueChange={(val) => setShowAdvanced(val === 'advanced')}
                    className="space-y-2"
                  >
                    <AccordionItem value="advanced" className="border-none">
                      <AccordionTrigger className="px-0 py-1 text-sm font-medium text-muted-foreground hover:no-underline">
                        Advanced options
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 px-0 pt-2" id="workspace-advanced">
                        <div className="flex flex-col gap-4">
                          {linearConnected && (
                            <div className="flex items-start gap-4">
                              <label
                                htmlFor="linear-issue"
                                className="w-32 shrink-0 pt-2 text-sm font-medium text-foreground"
                              >
                                Linear issue
                              </label>
                              <div className="min-w-0 flex-1">
                                <LinearIssueSelector
                                  selectedIssue={selectedIssue}
                                  onIssueChange={setSelectedIssue}
                                  isOpen={isOpen && showAdvanced}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-start gap-4">
                          <label
                            htmlFor="initial-prompt"
                            className="w-32 shrink-0 text-sm font-medium text-foreground"
                          >
                            Initial prompt
                          </label>
                          <div className="min-w-0 flex-1">
                            <textarea
                              id="initial-prompt"
                              value={initialPrompt}
                              onChange={(e) => setInitialPrompt(e.target.value)}
                              placeholder={
                                selectedIssue
                                  ? `e.g. Fix the attached Linear ticket ${selectedIssue.identifier} — describe any constraints.`
                                  : `e.g. Summarize the key problems and propose a plan.`
                              }
                              className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              rows={3}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={!!validate(workspaceName) || isCreating}>
                      {isCreating ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default WorkspaceModal;
