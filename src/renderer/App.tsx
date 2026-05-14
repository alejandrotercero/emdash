import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './components/ui/button';

import { FolderOpen } from 'lucide-react';
import LeftSidebar from './components/LeftSidebar';
import ProjectMainView from './components/ProjectMainView';
import WorkspaceModal from './components/WorkspaceModal';
import ChatInterface from './components/ChatInterface';
import { Toaster } from './components/ui/toaster';
import useUpdateNotifier from './hooks/useUpdateNotifier';
import RequirementsNotice from './components/RequirementsNotice';
import { useToast } from './hooks/use-toast';
import { useGithubAuth } from './hooks/useGithubAuth';
import { useTheme } from './hooks/useTheme';
import { useFont } from './hooks/useFont';
import { ThemeProvider } from './components/ThemeProvider';
import emdashLogo from '../assets/images/emdash/emdash_logo.svg';
import emdashLogoWhite from '../assets/images/emdash/emdash_logo_white.svg';
import Titlebar from './components/titlebar/Titlebar';
import { SidebarProvider, useSidebar } from './components/ui/sidebar';
import { RightSidebarProvider, useRightSidebar } from './components/ui/right-sidebar';
import RightSidebar from './components/RightSidebar';
import { type Provider } from './types';
import { type LinearIssueSummary } from './types/linear';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { loadPanelSizes, savePanelSizes } from './lib/persisted-layout';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import SettingsModal from './components/SettingsModal';
import CommandPalette from './components/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAgentSwitching } from './hooks/useAgentSwitching';

interface AppKeyboardShortcutsProps {
  showCommandPalette: boolean;
  showSettings: boolean;
  handleToggleCommandPalette: () => void;
  handleOpenSettings: () => void;
  handleCloseCommandPalette: () => void;
  handleCloseSettings: () => void;
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (workspaceIndex: number) => void;
}

const AppKeyboardShortcuts: React.FC<AppKeyboardShortcutsProps> = ({
  showCommandPalette,
  showSettings,
  handleToggleCommandPalette,
  handleOpenSettings,
  handleCloseCommandPalette,
  handleCloseSettings,
  activeWorkspaceId,
  onSwitchWorkspace,
}) => {
  const { toggle: toggleLeftSidebar } = useSidebar();
  const { toggle: toggleRightSidebar } = useRightSidebar();
  const { toggleTheme } = useTheme();
  const { switchAgentByIndex } = useAgentSwitching(activeWorkspaceId || undefined);

  // Single global keyboard shortcuts handler
  useKeyboardShortcuts({
    onToggleCommandPalette: handleToggleCommandPalette,
    onOpenSettings: handleOpenSettings,
    onToggleLeftSidebar: toggleLeftSidebar,
    onToggleRightSidebar: toggleRightSidebar,
    onToggleTheme: toggleTheme,
    onSwitchWorkspace: onSwitchWorkspace,
    onSwitchAgent: activeWorkspaceId ? switchAgentByIndex : undefined,
    onCloseModal: showCommandPalette
      ? handleCloseCommandPalette
      : showSettings
        ? handleCloseSettings
        : undefined,
    isCommandPaletteOpen: showCommandPalette,
    isSettingsOpen: showSettings,
  });

  return null;
};

interface CommandPaletteWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  handleSelectProject: (project: Project) => void;
  handleSelectWorkspace: (workspace: Workspace) => void;
  handleGoHome: () => void;
  handleOpenProject: () => void;
  handleOpenSettings: () => void;
  activeWorkspaceId?: string | null;
}

const CommandPaletteWrapper: React.FC<CommandPaletteWrapperProps> = ({
  isOpen,
  onClose,
  projects,
  handleSelectProject,
  handleSelectWorkspace,
  handleGoHome,
  handleOpenProject,
  handleOpenSettings,
  activeWorkspaceId,
}) => {
  const { toggle: toggleLeftSidebar } = useSidebar();
  const { toggle: toggleRightSidebar } = useRightSidebar();
  const { toggleTheme } = useTheme();
  const { switchAgent } = useAgentSwitching(activeWorkspaceId || undefined);

  const handleSwitchAgent = useCallback(async (provider: string) => {
    await switchAgent(provider as Provider);
  }, [switchAgent]);

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={onClose}
      projects={projects}
      onSelectProject={(projectId) => {
        const project = projects.find((p) => p.id === projectId);
        if (project) handleSelectProject(project);
      }}
      onSelectWorkspace={(projectId, workspaceId) => {
        const project = projects.find((p) => p.id === projectId);
        const workspace = project?.workspaces?.find((w) => w.id === workspaceId);
        if (project && workspace) {
          handleSelectProject(project);
          handleSelectWorkspace(workspace);
        }
      }}
      onOpenSettings={handleOpenSettings}
      onToggleLeftSidebar={toggleLeftSidebar}
      onToggleRightSidebar={toggleRightSidebar}
      onToggleTheme={toggleTheme}
      onGoHome={handleGoHome}
      onOpenProject={handleOpenProject}
      onSwitchAgent={activeWorkspaceId ? handleSwitchAgent : undefined}
    />
  );
};

const RightSidebarBridge: React.FC<{
  onCollapsedChange: (collapsed: boolean) => void;
  setCollapsedRef: React.MutableRefObject<((next: boolean) => void) | null>;
}> = ({ onCollapsedChange, setCollapsedRef }) => {
  const { collapsed, setCollapsed } = useRightSidebar();

  useEffect(() => {
    onCollapsedChange(collapsed);
  }, [collapsed, onCollapsedChange]);

  useEffect(() => {
    setCollapsedRef.current = setCollapsed;
    return () => {
      setCollapsedRef.current = null;
    };
  }, [setCollapsed, setCollapsedRef]);

  return null;
};

interface Project {
  id: string;
  name: string;
  path: string;
  gitInfo: {
    isGitRepo: boolean;
    remote?: string;
    branch?: string;
  };
  githubInfo?: {
    repository: string;
    connected: boolean;
  };
  workspaces?: Workspace[];
}

interface WorkspaceMetadata {
  linearIssue?: LinearIssueSummary | null;
  initialPrompt?: string | null;
  pullRequest?: {
    number: number;
    title: string;
    url?: string;
    author?: string | null;
    branch?: string;
  } | null;
}

interface Workspace {
  id: string;
  name: string;
  branch: string;
  baseBranch?: string; // Branch this workspace was created from (for PR targeting)
  path: string;
  status: 'active' | 'idle' | 'running';
  agentId?: string;
  metadata?: WorkspaceMetadata | null;
  worktreeType?: 'worktree' | 'main';
}

const TITLEBAR_HEIGHT = '36px';
const PANEL_LAYOUT_STORAGE_KEY = 'emdash.layout.left-main-right.v2';
const DEFAULT_PANEL_LAYOUT: [number, number, number] = [20, 60, 20];
const LEFT_SIDEBAR_MIN_SIZE = 16;
const LEFT_SIDEBAR_MAX_SIZE = 30;
const RIGHT_SIDEBAR_MIN_SIZE = 16;
const RIGHT_SIDEBAR_MAX_SIZE = 30;
const clampLeftSidebarSize = (value: number) =>
  Math.min(
    Math.max(Number.isFinite(value) ? value : DEFAULT_PANEL_LAYOUT[0], LEFT_SIDEBAR_MIN_SIZE),
    LEFT_SIDEBAR_MAX_SIZE
  );
const clampRightSidebarSize = (value: number) =>
  Math.min(
    Math.max(Number.isFinite(value) ? value : DEFAULT_PANEL_LAYOUT[2], RIGHT_SIDEBAR_MIN_SIZE),
    RIGHT_SIDEBAR_MAX_SIZE
  );
const MAIN_PANEL_MIN_SIZE = 30;

const AppContent: React.FC = () => {
  // Initialize theme and font on app startup
  const { effectiveTheme } = useTheme();
  const { font } = useFont();

  const { toast } = useToast();
  const [_, setVersion] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const {
    installed: ghInstalled,
    authenticated: isAuthenticated,
    user,
    checkStatus,
  } = useGithubAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [showHomeView, setShowHomeView] = useState<boolean>(true);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState<boolean>(false);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeWorkspaceProvider, setActiveWorkspaceProvider] = useState<Provider | null>(null);
  const [isCodexInstalled, setIsCodexInstalled] = useState<boolean | null>(null);
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const showGithubRequirement = !ghInstalled || !isAuthenticated;
  // Show agent requirements block if none of the supported CLIs are detected locally.
  // We only actively detect Codex and Claude Code; Factory (Droid) docs are shown as an alternative.
  const showAgentRequirement = isCodexInstalled === false && isClaudeInstalled === false;

  // Show toast on update availability and kick off a background check
  useUpdateNotifier({ checkOnMount: true, onOpenSettings: () => setShowSettings(true) });

  // Initialize font on app startup
  useEffect(() => {
    // This will load the saved font from localStorage and apply it
    // The useFont hook's useEffect will handle loading from storage
    // We just need to ensure it's called by referencing the font variable
    void font;
  }, [font]);

  const defaultPanelLayout = React.useMemo(() => {
    const stored = loadPanelSizes(PANEL_LAYOUT_STORAGE_KEY, DEFAULT_PANEL_LAYOUT);
    const [storedLeft = DEFAULT_PANEL_LAYOUT[0], , storedRight = DEFAULT_PANEL_LAYOUT[2]] =
      Array.isArray(stored) && stored.length === 3
        ? (stored as [number, number, number])
        : DEFAULT_PANEL_LAYOUT;
    const left = clampLeftSidebarSize(storedLeft);
    const right = clampRightSidebarSize(storedRight);
    const middle = Math.max(0, 100 - left - right);
    return [left, middle, right] as [number, number, number];
  }, []);

  const rightSidebarDefaultWidth = React.useMemo(
    () => clampRightSidebarSize(defaultPanelLayout[2]),
    [defaultPanelLayout]
  );
  const leftSidebarPanelRef = useRef<ImperativePanelHandle | null>(null);
  const rightSidebarPanelRef = useRef<ImperativePanelHandle | null>(null);
  const lastLeftSidebarSizeRef = useRef<number>(defaultPanelLayout[0]);
  const lastRightSidebarSizeRef = useRef<number>(rightSidebarDefaultWidth);
  const leftSidebarSetOpenRef = useRef<((next: boolean) => void) | null>(null);
  const leftSidebarIsMobileRef = useRef<boolean>(false);
  const leftSidebarOpenRef = useRef<boolean>(true);
  const rightSidebarSetCollapsedRef = useRef<((next: boolean) => void) | null>(null);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(true);

  const handlePanelLayout = useCallback((sizes: number[]) => {
    if (!Array.isArray(sizes) || sizes.length < 3) {
      return;
    }

    if (leftSidebarIsMobileRef.current) {
      return;
    }

    const [leftSize, , rightSize] = sizes;
    const rightCollapsed = typeof rightSize === 'number' && rightSize <= 0.5;

    let storedLeft = lastLeftSidebarSizeRef.current;
    if (typeof leftSize === 'number') {
      if (leftSize <= 0.5) {
        leftSidebarSetOpenRef.current?.(false);
        leftSidebarOpenRef.current = false;
      } else {
        leftSidebarSetOpenRef.current?.(true);
        leftSidebarOpenRef.current = true;
        if (!rightCollapsed) {
          storedLeft = clampLeftSidebarSize(leftSize);
          lastLeftSidebarSizeRef.current = storedLeft;
        }
      }
    }

    let storedRight = lastRightSidebarSizeRef.current;
    if (typeof rightSize === 'number') {
      if (rightSize <= 0.5) {
        rightSidebarSetCollapsedRef.current?.(true);
      } else {
        storedRight = clampRightSidebarSize(rightSize);
        lastRightSidebarSizeRef.current = storedRight;
        rightSidebarSetCollapsedRef.current?.(false);
      }
    }

    const middle = Math.max(0, 100 - storedLeft - storedRight);
    savePanelSizes(PANEL_LAYOUT_STORAGE_KEY, [storedLeft, middle, storedRight]);
  }, []);

  const handleSidebarContextChange = useCallback(
    ({
      open,
      isMobile,
      setOpen,
    }: {
      open: boolean;
      isMobile: boolean;
      setOpen: (next: boolean) => void;
    }) => {
      leftSidebarSetOpenRef.current = setOpen;
      leftSidebarIsMobileRef.current = isMobile;
      leftSidebarOpenRef.current = open;
      const panel = leftSidebarPanelRef.current;
      if (!panel) {
        return;
      }

      if (isMobile) {
        const currentSize = panel.getSize();
        if (typeof currentSize === 'number' && currentSize > 0) {
          lastLeftSidebarSizeRef.current = clampLeftSidebarSize(currentSize);
        }
        panel.collapse();
        return;
      }

      if (open) {
        const target = clampLeftSidebarSize(
          lastLeftSidebarSizeRef.current || DEFAULT_PANEL_LAYOUT[0]
        );
        panel.expand();
        panel.resize(target);
      } else {
        const currentSize = panel.getSize();
        if (typeof currentSize === 'number' && currentSize > 0) {
          lastLeftSidebarSizeRef.current = clampLeftSidebarSize(currentSize);
        }
        panel.collapse();
      }
    },
    []
  );

  const handleRightSidebarCollapsedChange = useCallback((collapsed: boolean) => {
    setRightSidebarCollapsed(collapsed);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setShowSettings((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const handleToggleCommandPalette = useCallback(() => {
    setShowCommandPalette((prev) => !prev);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
  }, []);

  useEffect(() => {
    const rightPanel = rightSidebarPanelRef.current;
    if (rightPanel) {
      if (rightSidebarCollapsed) {
        rightPanel.collapse();
      } else {
        const targetRight = clampRightSidebarSize(
          lastRightSidebarSizeRef.current || DEFAULT_PANEL_LAYOUT[2]
        );
        lastRightSidebarSizeRef.current = targetRight;
        rightPanel.expand();
        rightPanel.resize(targetRight);
      }
    }

    if (leftSidebarIsMobileRef.current || !leftSidebarOpenRef.current) {
      return;
    }

    const leftPanel = leftSidebarPanelRef.current;
    if (!leftPanel) {
      return;
    }

    const targetLeft = clampLeftSidebarSize(
      lastLeftSidebarSizeRef.current || DEFAULT_PANEL_LAYOUT[0]
    );
    lastLeftSidebarSizeRef.current = targetLeft;
    leftPanel.expand();
    leftPanel.resize(targetLeft);
  }, [rightSidebarCollapsed]);

  // Persist and apply custom project order (by id)
  const ORDER_KEY = 'sidebarProjectOrder';
  const applyProjectOrder = (list: Project[]) => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (!raw) return list;
      const order: string[] = JSON.parse(raw);
      const indexOf = (id: string) => {
        const idx = order.indexOf(id);
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      };
      return [...list].sort((a, b) => indexOf(a.id) - indexOf(b.id));
    } catch {
      return list;
    }
  };
  const saveProjectOrder = (list: Project[]) => {
    try {
      const ids = list.map((p) => p.id);
      localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {}
  };

  useEffect(() => {
    const loadAppData = async () => {
      try {
        const [appVersion, appPlatform, projects] = await Promise.all([
          window.electronAPI.getAppVersion(),
          window.electronAPI.getPlatform(),
          window.electronAPI.getProjects(),
        ]);

        setVersion(appVersion);
        setPlatform(appPlatform);
        setProjects(applyProjectOrder(projects));

        // Non-blocking: refresh GH status via hook
        checkStatus();

        const projectsWithWorkspaces = await Promise.all(
          projects.map(async (project) => {
            const workspaces = await window.electronAPI.getWorkspaces(project.id);
            return { ...project, workspaces };
          })
        );
        const ordered = applyProjectOrder(projectsWithWorkspaces);
        setProjects(ordered);

        const codexStatus = await window.electronAPI.codexCheckInstallation();
        if (codexStatus.success) {
          setIsCodexInstalled(codexStatus.isInstalled ?? false);
        } else {
          setIsCodexInstalled(false);
          console.error('Failed to check Codex CLI installation:', codexStatus.error);
        }

        // Best-effort: detect Claude Code CLI presence
        try {
          const claude = await (window as any).electronAPI.agentCheckInstallation?.('claude');
          setIsClaudeInstalled(!!claude?.isInstalled);
        } catch {
          setIsClaudeInstalled(false);
        }
      } catch (error) {
        const { log } = await import('./lib/logger');
        log.error('Failed to load app data:', error as any);
      }
    };

    loadAppData();
  }, []);

  // handleGitHubAuth, handleLogout come from hook; toasts handled by callers as needed

  const handleOpenProject = async () => {
    try {
      const result = await window.electronAPI.openProject();
      if (result.success && result.path) {
        try {
          const gitInfo = await window.electronAPI.getGitInfo(result.path);
          if (gitInfo.isGitRepo) {
            const remoteUrl = gitInfo.remote || '';
            const isGithubRemote = /github\.com[:/]/i.test(remoteUrl);

            if (isAuthenticated && isGithubRemote) {
              const githubInfo = await window.electronAPI.connectToGitHub(result.path);
              if (githubInfo.success) {
                const projectName = result.path.split('/').pop() || 'Unknown Project';
                const newProject: Project = {
                  id: Date.now().toString(),
                  name: projectName,
                  path: result.path,
                  gitInfo: {
                    isGitRepo: true,
                    remote: gitInfo.remote || undefined,
                    branch: gitInfo.branch || undefined,
                  },
                  githubInfo: {
                    repository: githubInfo.repository || '',
                    connected: true,
                  },
                  workspaces: [],
                };

                // Save to database
                const saveResult = await window.electronAPI.saveProject(newProject);
                if (saveResult.success) {
                  setProjects((prev) => [...prev, newProject]);
                  setSelectedProject(newProject);
                } else {
                  const { log } = await import('./lib/logger');
                  log.error('Failed to save project:', saveResult.error);
                }
                // alert(`✅ Project connected to GitHub!\n\nRepository: ${githubInfo.repository}\nBranch: ${githubInfo.branch}\nPath: ${result.path}`);
              } else {
                const updateHint =
                  platform === 'darwin'
                    ? 'Tip: Update GitHub CLI with: brew upgrade gh — then restart emdash.'
                    : platform === 'win32'
                      ? 'Tip: Update GitHub CLI with: winget upgrade GitHub.cli — then restart emdash.'
                      : 'Tip: Update GitHub CLI via your package manager (e.g., apt/dnf) and restart emdash.';
                toast({
                  title: 'GitHub Connection Failed',
                  description: `Git repository detected but couldn't connect to GitHub: ${githubInfo.error}\n\n${updateHint}`,
                  variant: 'destructive',
                });
              }
            } else {
              // User not authenticated - still save the project
              const projectName = result.path.split('/').pop() || 'Unknown Project';
              const newProject: Project = {
                id: Date.now().toString(),
                name: projectName,
                path: result.path,
                gitInfo: {
                  isGitRepo: true,
                  remote: gitInfo.remote || undefined,
                  branch: gitInfo.branch || undefined,
                },
                githubInfo: {
                  repository: isGithubRemote ? '' : '',
                  connected: false,
                },
                workspaces: [],
              };

              // Save to database
              const saveResult = await window.electronAPI.saveProject(newProject);
              if (saveResult.success) {
                setProjects((prev) => [...prev, newProject]);
                setSelectedProject(newProject);
              } else {
                const { log } = await import('./lib/logger');
                log.error('Failed to save project:', saveResult.error);
              }

              // If the remote is not a GitHub URL, do not show a failure toast.
              // Only warn when the repo is GitHub-hosted but connection fails.
              if (isAuthenticated && !isGithubRemote && remoteUrl) {
                // Optional: non-destructive info toast to clarify no GitHub features
                // toast({
                //   title: 'Non‑GitHub repository',
                //   description: 'Connected project without GitHub features (remote is not github.com).',
                //   variant: 'default',
                // });
              }
            }
          } else {
            // Not a Git repository
            toast({
              title: 'Project Opened',
              description: `This directory is not a Git repository. Path: ${result.path}`,
              variant: 'destructive',
            });
          }
        } catch (error) {
          const { log } = await import('./lib/logger');
          log.error('Git detection error:', error as any);
          toast({
            title: 'Project Opened',
            description: `Could not detect Git information. Path: ${result.path}`,
            variant: 'destructive',
          });
        }
      } else if (result.error) {
        toast({
          title: 'Failed to Open Project',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const { log } = await import('./lib/logger');
      log.error('Open project error:', error as any);
      toast({
        title: 'Failed to Open Project',
        description: 'Please check the console for details.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateWorkspace = async (
    workspaceName: string,
    initialPrompt?: string,
    selectedProvider?: Provider,
    linkedLinearIssue: LinearIssueSummary | null = null,
    worktreeType: 'worktree' | 'main' = 'worktree'
  ) => {
    if (!selectedProject) return;

    setIsCreatingWorkspace(true);
    try {
      let preparedPrompt: string | undefined = undefined;
      if (initialPrompt && initialPrompt.trim()) {
        const parts: string[] = [];
        if (linkedLinearIssue) {
          // Enrich linked issue with description from Linear, if available
          let issue = linkedLinearIssue;
          try {
            const api: any = (window as any).electronAPI;
            let description: string | undefined;
            // Try bulk first
            try {
              const res = await api?.linearGetIssues?.([linkedLinearIssue.identifier]);
              const arr = res?.issues || res || [];
              const node = Array.isArray(arr)
                ? arr.find(
                    (n: any) => String(n?.identifier) === String(linkedLinearIssue.identifier)
                  )
                : null;
              if (node?.description) description = String(node.description);
            } catch {}
            // Fallback to single issue endpoint
            if (!description) {
              const single = await api?.linearGetIssue?.(linkedLinearIssue.identifier);
              if (single?.success && single.issue?.description) {
                description = String(single.issue.description);
              } else if (single?.description) {
                description = String(single.description);
              }
            }
            if (description) {
              issue = { ...linkedLinearIssue, description } as any;
            }
          } catch {}
          const detailParts: string[] = [];
          const stateName = issue.state?.name?.trim();
          const assigneeName = issue.assignee?.displayName?.trim() || issue.assignee?.name?.trim();
          const teamKey = issue.team?.key?.trim();
          const projectName = issue.project?.name?.trim();
          if (stateName) detailParts.push(`State: ${stateName}`);
          if (assigneeName) detailParts.push(`Assignee: ${assigneeName}`);
          if (teamKey) detailParts.push(`Team: ${teamKey}`);
          if (projectName) detailParts.push(`Project: ${projectName}`);
          parts.push(`Linear: ${issue.identifier} — ${issue.title}`);
          if (detailParts.length) parts.push(`Details: ${detailParts.join(' • ')}`);
          if (issue.url) parts.push(`URL: ${issue.url}`);
          if ((issue as any).description) {
            parts.push('');
            parts.push('Issue Description:');
            parts.push(String((issue as any).description).trim());
          }
          parts.push('');
        }
        parts.push(initialPrompt.trim());
        preparedPrompt = parts.join('\n');
      }

      const workspaceMetadata: WorkspaceMetadata | null =
        linkedLinearIssue || preparedPrompt
          ? { linearIssue: linkedLinearIssue ?? null, initialPrompt: preparedPrompt ?? null }
          : null;

      // Create Git worktree or main branch workspace
      let worktreeResult;
      if (worktreeType === 'main') {
        worktreeResult = await window.electronAPI.worktreeCreateMainBranch?.({
          projectPath: selectedProject.path,
          workspaceName,
          projectId: selectedProject.id,
        });
      } else {
        worktreeResult = await window.electronAPI.worktreeCreate({
          projectPath: selectedProject.path,
          workspaceName,
          projectId: selectedProject.id,
        });
      }

      if (!worktreeResult?.success) {
        throw new Error(worktreeResult?.error || 'Failed to create workspace');
      }

      const worktree = worktreeResult.worktree;

      const newWorkspace: Workspace = {
        id: worktree.id,
        name: workspaceName,
        branch: worktree.branch,
        baseBranch: worktree.baseBranch,
        path: worktree.path,
        status: 'idle',
        metadata: workspaceMetadata,
        worktreeType: worktreeType,
      };

      // Save workspace to database
      const saveResult = await window.electronAPI.saveWorkspace({
        ...newWorkspace,
        projectId: selectedProject.id,
        metadata: workspaceMetadata,
      });

      if (saveResult.success) {
        if (workspaceMetadata?.linearIssue) {
          try {
            const convoResult = await window.electronAPI.getOrCreateDefaultConversation(
              newWorkspace.id
            );

            if (convoResult?.success && convoResult.conversation?.id) {
              const issue = workspaceMetadata.linearIssue;
              const detailParts: string[] = [];
              const stateName = issue.state?.name?.trim();
              const assigneeName =
                issue.assignee?.displayName?.trim() || issue.assignee?.name?.trim();
              const teamKey = issue.team?.key?.trim();
              const projectName = issue.project?.name?.trim();

              if (stateName) detailParts.push(`State: ${stateName}`);
              if (assigneeName) detailParts.push(`Assignee: ${assigneeName}`);
              if (teamKey) detailParts.push(`Team: ${teamKey}`);
              if (projectName) detailParts.push(`Project: ${projectName}`);

              const lines = [`Linked Linear issue: ${issue.identifier} — ${issue.title}`];

              if (detailParts.length) {
                lines.push(`Details: ${detailParts.join(' • ')}`);
              }

              if (issue.url) {
                lines.push(`URL: ${issue.url}`);
              }

              if ((issue as any)?.description) {
                lines.push('');
                lines.push('Issue Description:');
                lines.push(String((issue as any).description).trim());
              }

              await window.electronAPI.saveMessage({
                id: `linear-context-${newWorkspace.id}`,
                conversationId: convoResult.conversation.id,
                content: lines.join('\n'),
                sender: 'agent',
                metadata: JSON.stringify({
                  isLinearContext: true,
                  linearIssue: issue,
                }),
              });
            }
          } catch (seedError) {
            const { log } = await import('./lib/logger');
            log.error('Failed to seed workspace with Linear issue context:', seedError as any);
          }
        }

        setProjects((prev) =>
          prev.map((project) =>
            project.id === selectedProject.id
              ? {
                  ...project,
                  workspaces: [...(project.workspaces || []), newWorkspace],
                }
              : project
          )
        );

        setSelectedProject((prev) =>
          prev
            ? {
                ...prev,
                workspaces: [...(prev.workspaces || []), newWorkspace],
              }
            : null
        );

        // Set the active workspace and its provider
        setActiveWorkspace(newWorkspace);
        setActiveWorkspaceProvider(selectedProvider || 'codex');

        toast({
          title: 'Workspace Created',
          description: `"${workspaceName}" workspace created successfully!`,
        });
      } else {
        const { log } = await import('./lib/logger');
        log.error('Failed to save workspace:', saveResult.error);
        toast({
          title: 'Error',
          description: 'Failed to create workspace. Please check the console for details.',
        });
      }
    } catch (error) {
      const { log } = await import('./lib/logger');
      log.error('Failed to create workspace:', error as any);
      toast({
        title: 'Error',
        description:
          (error as Error)?.message ||
          'Failed to create workspace. Please check the console for details.',
      });
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  // PR checkout via PR list is disabled; handler removed

  const handleGoHome = () => {
    setSelectedProject(null);
    setShowHomeView(true);
    setActiveWorkspace(null);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setShowHomeView(false);
    setActiveWorkspace(null);
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setActiveWorkspaceProvider(null); // Clear provider when switching workspaces
  };

  const handleSwitchWorkspaceByIndex = (workspaceIndex: number) => {
    let currentIndex = 1;
    for (const project of projects) {
      for (const workspace of project.workspaces || []) {
        if (currentIndex === workspaceIndex) {
          // Select the project first, then the workspace
          handleSelectProject(project);
          handleSelectWorkspace(workspace);
          return;
        }
        currentIndex++;
        if (currentIndex > 9) return; // Only support up to 9 workspaces
      }
    }
  };

  const handleStartCreateWorkspaceFromSidebar = useCallback(
    (project: Project) => {
      const targetProject = projects.find((p) => p.id === project.id) || project;
      setSelectedProject(targetProject);
      setShowHomeView(false);
      setActiveWorkspace(null);
      setShowWorkspaceModal(true);
    },
    [projects]
  );

  const handleDeleteWorkspace = async (targetProject: Project, workspace: Workspace) => {
    try {
      // Safety check: don't try to delete main branch worktrees (they can't be removed via git worktree remove)
      // Check both worktreeType and path to be extra safe
      if (workspace.worktreeType === 'main' || !workspace.path.includes('/worktrees/')) {
        throw new Error('Cannot delete a main branch workspace. Use "Remove" instead.');
      }

      try {
        // Clear initial prompt sent flags (legacy and per-provider) if present
        const { initialPromptSentKey } = await import('./lib/keys');
        try {
          // Legacy key (no provider)
          const legacy = initialPromptSentKey(workspace.id);
          localStorage.removeItem(legacy);
        } catch {}
        try {
          // Provider-scoped keys
          const providers = [
            'qwen',
            'codex',
            'claude',
            'droid',
            'gemini',
            'cursor',
            'copilot',
            'amp',
            'opencode',
            'charm',
            'auggie',
          ];
          for (const p of providers) {
            const k = initialPromptSentKey(workspace.id, p);
            localStorage.removeItem(k);
          }
        } catch {}
      } catch {}
      try {
        if (workspace.agentId) {
          const agentRemoval = await window.electronAPI.codexRemoveAgent(workspace.id);
          if (!agentRemoval.success) {
            const { log } = await import('./lib/logger');
            log.warn('codexRemoveAgent reported failure:', agentRemoval.error);
          }
        }
      } catch (agentError) {
        const { log } = await import('./lib/logger');
        log.warn('Failed to remove agent before deleting workspace:', agentError as any);
      }

      const removeResult = await window.electronAPI.worktreeRemove({
        projectPath: targetProject.path,
        worktreeId: workspace.id,
        worktreePath: workspace.path,
        branch: workspace.branch,
      });
      if (!removeResult.success) {
        throw new Error(removeResult.error || 'Failed to remove worktree');
      }

      const result = await window.electronAPI.deleteWorkspace(workspace.id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete workspace');
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === targetProject.id
            ? {
                ...project,
                workspaces: (project.workspaces || []).filter((w) => w.id !== workspace.id),
              }
            : project
        )
      );

      setSelectedProject((prev) =>
        prev && prev.id === targetProject.id
          ? {
              ...prev,
              workspaces: (prev.workspaces || []).filter((w) => w.id !== workspace.id),
            }
          : prev
      );

      if (activeWorkspace?.id === workspace.id) {
        setActiveWorkspace(null);
      }

      toast({
        title: 'Workspace deleted',
        description: `"${workspace.name}" was removed.`,
      });
    } catch (error) {
      const { log } = await import('./lib/logger');
      log.error('Failed to delete workspace:', error as any);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Could not delete workspace. Check the console for details.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveWorkspace = async (
    targetProject: Project,
    workspace: Workspace
  ): Promise<void> => {
    try {
      // For main branch workspaces, only remove from database/UI, don't delete from disk
      const result = await window.electronAPI.deleteWorkspace(workspace.id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove workspace');
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === targetProject.id
            ? {
                ...project,
                workspaces: (project.workspaces || []).filter((w) => w.id !== workspace.id),
              }
            : project
        )
      );

      setSelectedProject((prev) =>
        prev && prev.id === targetProject.id
          ? {
              ...prev,
              workspaces: (prev.workspaces || []).filter((w) => w.id !== workspace.id),
            }
          : prev
      );

      if (activeWorkspace?.id === workspace.id) {
        setActiveWorkspace(null);
      }

      toast({
        title: 'Workspace removed',
        description: `"${workspace.name}" was removed from the app. Files on disk were not changed.`,
      });
    } catch (error) {
      const { log } = await import('./lib/logger');
      log.error('Failed to remove workspace:', error as any);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Could not remove workspace. Check the console for details.',
        variant: 'destructive',
      });
    }
  };

  const handleReorderProjects = (sourceId: string, targetId: string) => {
    setProjects((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((p) => p.id === sourceId);
      const toIdx = list.findIndex((p) => p.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      saveProjectOrder(list);
      return list;
    });
  };

  const needsGhInstall = !ghInstalled;
  const needsGhAuth = ghInstalled && !isAuthenticated;

  const handleReorderProjectsFull = (newOrder: Project[]) => {
    setProjects(() => {
      const list = [...newOrder];
      saveProjectOrder(list);
      return list;
    });
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      const res = await window.electronAPI.deleteProject(project.id);
      if (!res?.success) throw new Error(res?.error || 'Failed to delete project');

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (selectedProject?.id === project.id) {
        setSelectedProject(null);
        setActiveWorkspace(null);
        setShowHomeView(true);
      }
      toast({ title: 'Project deleted', description: `"${project.name}" was removed.` });
    } catch (err) {
      const { log } = await import('./lib/logger');
      log.error('Delete project failed:', err as any);
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Could not delete project. See console for details.',
        variant: 'destructive',
      });
    }
  };

  const renderMainContent = () => {
    if (showHomeView) {
      const hasProjects = projects.length > 0;
      return (
        <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground">
          <div className="container mx-auto flex min-h-full max-w-2xl flex-1 flex-col justify-center px-6 py-12">
            {/* Logo */}
            <div className="mb-10 text-center">
              <div className="mb-3 flex items-center justify-center">
                <div className="logo-shimmer-container">
                  <img
                    key={effectiveTheme}
                    src={effectiveTheme === 'dark' ? emdashLogoWhite : emdashLogo}
                    alt="emdash"
                    className="logo-shimmer-image"
                  />
                  <span
                    className="logo-shimmer-overlay"
                    aria-hidden="true"
                    style={{
                      WebkitMaskImage: `url(${effectiveTheme === 'dark' ? emdashLogoWhite : emdashLogo})`,
                      maskImage: `url(${effectiveTheme === 'dark' ? emdashLogoWhite : emdashLogo})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                    }}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Run multiple coding agents in parallel
              </p>
            </div>

            {/* Recent projects */}
            {hasProjects && (
              <div className="mb-6 space-y-2">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Recent Projects
                </p>
                <div className="flex flex-col gap-1.5">
                  {projects.slice(0, 6).map((project) => {
                    const workspaceCount = project.workspaces?.length ?? 0;
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleSelectProject(project)}
                        className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {project.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {project.path}
                          </div>
                        </div>
                        <div className="ml-4 flex shrink-0 items-center gap-2">
                          {project.gitInfo.branch && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                              {project.gitInfo.branch}
                            </span>
                          )}
                          {workspaceCount > 0 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {workspaceCount}
                              {' '}
                              {workspaceCount === 1 ? 'workspace' : 'workspaces'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex justify-center">
              <Button
                onClick={handleOpenProject}
                variant={hasProjects ? 'outline' : 'default'}
                size="lg"
                className="min-w-[180px]"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Project
              </Button>
            </div>

            {/* Requirements — only when needed */}
            {(showGithubRequirement || showAgentRequirement) && (
              <div className="mt-10">
                <RequirementsNotice
                  showGithubRequirement={showGithubRequirement}
                  needsGhInstall={needsGhInstall}
                  needsGhAuth={needsGhAuth}
                  showAgentRequirement={showAgentRequirement}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedProject) {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeWorkspace ? (
            <ChatInterface
              workspace={activeWorkspace}
              projectName={selectedProject.name}
              className="min-h-0 flex-1"
              initialProvider={activeWorkspaceProvider || undefined}
            />
          ) : (
            <ProjectMainView
              project={selectedProject}
              onCreateWorkspace={() => setShowWorkspaceModal(true)}
              activeWorkspace={activeWorkspace}
              onSelectWorkspace={handleSelectWorkspace}
              onDeleteWorkspace={handleDeleteWorkspace}
              onRemoveWorkspace={handleRemoveWorkspace}
              isCreatingWorkspace={isCreatingWorkspace}
              onDeleteProject={handleDeleteProject}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="flex h-[100dvh] w-full flex-col bg-background text-foreground"
      style={{ '--tb': TITLEBAR_HEIGHT } as React.CSSProperties}
    >
      <SidebarProvider>
        <RightSidebarProvider defaultCollapsed>
          <AppKeyboardShortcuts
            showCommandPalette={showCommandPalette}
            showSettings={showSettings}
            handleToggleCommandPalette={handleToggleCommandPalette}
            handleOpenSettings={handleOpenSettings}
            handleCloseCommandPalette={handleCloseCommandPalette}
            handleCloseSettings={handleCloseSettings}
            activeWorkspaceId={activeWorkspace?.id || null}
            onSwitchWorkspace={handleSwitchWorkspaceByIndex}
          />
          <RightSidebarBridge
            onCollapsedChange={handleRightSidebarCollapsedChange}
            setCollapsedRef={rightSidebarSetCollapsedRef}
          />
          <Titlebar
            onToggleSettings={handleToggleSettings}
            isSettingsOpen={showSettings}
            currentPath={activeWorkspace?.path || selectedProject?.path || null}
          />
          <div className="flex flex-1 overflow-hidden pt-[var(--tb)]">
            <ResizablePanelGroup
              direction="horizontal"
              className="flex-1 overflow-hidden"
              onLayout={handlePanelLayout}
            >
              <ResizablePanel
                ref={leftSidebarPanelRef}
                className="sidebar-panel sidebar-panel--left"
                defaultSize={defaultPanelLayout[0]}
                minSize={LEFT_SIDEBAR_MIN_SIZE}
                maxSize={LEFT_SIDEBAR_MAX_SIZE}
                collapsedSize={0}
                collapsible
                order={1}
              >
                <LeftSidebar
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={handleSelectProject}
                  onGoHome={handleGoHome}
                  onSelectWorkspace={handleSelectWorkspace}
                  activeWorkspace={activeWorkspace || undefined}
                  onReorderProjects={handleReorderProjects}
                  onReorderProjectsFull={handleReorderProjectsFull}
                  githubInstalled={ghInstalled}
                  githubAuthenticated={isAuthenticated}
                  githubUser={user}
                  onSidebarContextChange={handleSidebarContextChange}
                  onCreateWorkspaceForProject={handleStartCreateWorkspaceFromSidebar}
                  isCreatingWorkspace={isCreatingWorkspace}
                  onDeleteWorkspace={handleDeleteWorkspace}
                  onRemoveWorkspace={handleRemoveWorkspace}
                />
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="hidden cursor-col-resize items-center justify-center transition-colors hover:bg-border/80 lg:flex"
              />
              <ResizablePanel
                className="sidebar-panel sidebar-panel--main"
                defaultSize={defaultPanelLayout[1]}
                minSize={MAIN_PANEL_MIN_SIZE}
                order={2}
              >
                <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
                  {renderMainContent()}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="hidden cursor-col-resize items-center justify-center transition-colors hover:bg-border/80 lg:flex"
              />
              <ResizablePanel
                ref={rightSidebarPanelRef}
                className="sidebar-panel sidebar-panel--right"
                defaultSize={0}
                minSize={RIGHT_SIDEBAR_MIN_SIZE}
                maxSize={RIGHT_SIDEBAR_MAX_SIZE}
                collapsedSize={0}
                collapsible
                order={3}
              >
                <RightSidebar workspace={activeWorkspace} className="lg:border-l-0" />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          <SettingsModal isOpen={showSettings} onClose={handleCloseSettings} />
          <CommandPaletteWrapper
            isOpen={showCommandPalette}
            onClose={handleCloseCommandPalette}
            projects={projects}
            handleSelectProject={handleSelectProject}
            handleSelectWorkspace={handleSelectWorkspace}
            handleGoHome={handleGoHome}
            handleOpenProject={handleOpenProject}
            handleOpenSettings={handleOpenSettings}
            activeWorkspaceId={activeWorkspace?.id || null}
          />
          <WorkspaceModal
            isOpen={showWorkspaceModal}
            onClose={() => setShowWorkspaceModal(false)}
            onCreateWorkspace={handleCreateWorkspace}
            projectName={selectedProject?.name || ''}
            projectPath={selectedProject?.path || ''}
            defaultBranch={selectedProject?.gitInfo.branch || 'main'}
            projectId={selectedProject?.id || ''}
            existingNames={(selectedProject?.workspaces || []).map((w) => w.name)}
          />
          <Toaster />
        </RightSidebarProvider>
      </SidebarProvider>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
