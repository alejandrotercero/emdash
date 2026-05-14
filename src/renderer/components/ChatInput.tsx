import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
// Provider selection handled by ProviderSelector component
import { useFileIndex } from '../hooks/useFileIndex';
import FileTypeIcon from './ui/file-type-icon';
import { ProviderSelector } from './ProviderSelector';
import { type Provider } from '../types';
import type { CliProviderStatus } from '../types/connections';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  isLoading: boolean;
  loadingSeconds: number;
  isCodexInstalled: boolean | null;
  agentCreated: boolean;
  disabled?: boolean;
  workspacePath?: string;
  provider?: Provider;
  onProviderChange?: (p: Provider) => void;
  selectDisabled?: boolean;
  // Image attachments (paths relative to workspace)
  imageAttachments?: string[];
  onAttachImages?: (filePaths: string[]) => void;
  onRemoveImage?: (relPath: string) => void;
  detectedProviders?: CliProviderStatus[];
}

const MAX_LOADING_SECONDS = 60 * 60; // 60 minutes

const formatLoadingTime = (seconds: number): string => {
  if (seconds <= 0) return '0s';

  const clamped = Math.min(seconds, MAX_LOADING_SECONDS);
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;

  if (minutes >= 60) {
    return '60m';
  }

  if (minutes === 0) {
    return `${clamped}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
};

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onCancel,
  isLoading,
  loadingSeconds,
  isCodexInstalled,
  agentCreated,
  disabled = false,
  workspacePath,
  provider = 'codex',
  onProviderChange,
  selectDisabled = false,
  imageAttachments = [],
  onAttachImages,
  onRemoveImage,
  detectedProviders,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTerminalProvider =
    provider === 'droid' ||
    provider === 'gemini' ||
    provider === 'cursor' ||
    provider === 'copilot' ||
    provider === 'amp' ||
    provider === 'opencode';

  // File index for @ mention
  const { search } = useFileIndex(workspacePath);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionResults, setMentionResults] = useState<
    Array<{ path: string; type: 'file' | 'dir' }>
  >([]);

  // Debounce mention search to avoid heavy sync work on every keystroke in large repos
  useEffect(() => {
    if (!mentionOpen) {
      setMentionResults([]);
      return;
    }
    const handle = setTimeout(() => {
      try {
        setMentionResults(search(mentionQuery, 12));
      } catch {
        setMentionResults([]);
      }
    }, 120);
    return () => clearTimeout(handle);
  }, [mentionOpen, mentionQuery, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (unless Shift) when mention is closed
    if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
      e.preventDefault();
      if (!isLoading) onSend();
      return;
    }

    // Mention navigation
    if (mentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, Math.max(mentionResults.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const pick = mentionResults[mentionIndex];
        if (pick) applyMention(pick.path);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMention();
        return;
      }
    }
  };

  function openMention(start: number, query: string) {
    setMentionStart(start);
    setMentionQuery(query);
    setMentionIndex(0);
    setMentionOpen(true);
  }

  function closeMention() {
    setMentionOpen(false);
    setMentionQuery('');
    setMentionStart(null);
    setMentionIndex(0);
  }

  function detectMention(nextValue: string, caret: number) {
    // Find the nearest '@' to the left of caret that starts a token
    // Token continues until whitespace or line break
    let i = caret - 1;
    while (i >= 0) {
      const ch = nextValue[i];
      if (ch === '@') break;
      if (/\s/.test(ch)) return closeMention();
      i--;
    }
    if (i < 0 || nextValue[i] !== '@') return closeMention();

    const start = i; // position of '@'
    const query = nextValue.slice(start + 1, caret);
    openMention(start, query);
  }

  function applyMention(pickPath: string) {
    if (mentionStart == null) return;
    const el = textareaRef.current;
    const caret = el ? el.selectionStart : value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    // Keep leading '@', insert selected relative path
    const next = `${before}@${pickPath}${after}`;
    onChange(next);
    closeMention();
    // Restore caret after inserted text
    requestAnimationFrame(() => {
      if (el) {
        const pos = before.length + 1 + pickPath.length;
        el.selectionStart = el.selectionEnd = pos;
        el.focus();
      }
    });
  }

  const linkButtonRef = useRef<HTMLButtonElement>(null);

  const getPlaceholder = () => {
    // Check if provider is a custom Claude config
    const isCustomClaude = provider?.startsWith('custom-claude-');

    if (provider === 'codex' && !isCodexInstalled) {
      return 'Codex CLI not installed...';
    }
    // Only show "Initializing..." for Codex (custom Claude doesn't need agentCreated)
    if (!agentCreated && (provider === 'codex' || provider === 'claude')) {
      return 'Initializing...';
    }
    if (provider === 'claude') return 'Tell Claude Code what to do...';
    if (isCustomClaude) return 'Tell Claude what to do...';
    if (provider === 'droid') return 'Factory Droid uses the terminal above.';
    if (provider === 'gemini') return 'Gemini CLI uses the terminal above.';
    if (provider === 'cursor') return 'Cursor CLI runs in the terminal above.';
    if (provider === 'copilot') return 'Copilot CLI runs in the terminal above.';
    if (provider === 'amp') return 'Amp CLI runs in the terminal above.';
    if (provider === 'opencode') return 'OpenCode CLI runs in the terminal above.';
    return 'Tell Codex what to do...';
  };

  const trimmedValue = value.trim();

  // Check if provider is a custom Claude config
  const isCustomClaude = provider?.startsWith('custom-claude-');

  const baseDisabled =
    disabled ||
    (provider === 'codex'
      ? !isCodexInstalled || !agentCreated
      : provider === 'claude'
        ? !agentCreated
        : isCustomClaude
          ? false // Custom Claude configs use stream directly, no agentCreated needed
          : true); // droid/gemini/cursor/copilot: input disabled, terminal-only

  const textareaDisabled = baseDisabled || isLoading;
  const sendDisabled = isTerminalProvider
    ? true
    : isLoading
      ? baseDisabled
      : baseDisabled || !trimmedValue;

  // Drag & drop images into the input area
  const handleDrop = (e: React.DragEvent) => {
    if (!workspacePath) return;
    if (!e.dataTransfer || !e.dataTransfer.files) return;
    e.preventDefault();
    const files: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i] as any;
      const name: string = f.name || '';
      const path: string | undefined = (f as any).path;
      const type: string = f.type || '';
      const isImage = type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
      if (isImage && path) files.push(path);
    }
    if (files.length > 0) onAttachImages?.(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!workspacePath) return;
    e.preventDefault();
  };

  return (
    <div className="px-6 pb-6 pt-4" onDrop={handleDrop} onDragOver={handleDragOver}>
      <div className="mx-auto max-w-4xl">
        <div
          className={`relative rounded-lg border bg-card transition-all duration-200 ${
            isFocused
              ? 'border-ring/40 shadow-lg ring-2 ring-ring/20'
              : 'border-border shadow-sm hover:border-border/80'
          }`}
        >
          <div className="p-4">
            {imageAttachments && imageAttachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {imageAttachments.map((rel) => (
                  <div
                    key={rel}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs"
                  >
                    <span className="max-w-[220px] truncate">{rel}</span>
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => onRemoveImage?.(rel)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="w-full resize-none border-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              value={value}
              onChange={(e) => {
                const next = e.target.value;
                onChange(next);
                const caret = e.target.selectionStart ?? next.length;
                detectMention(next, caret);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={getPlaceholder()}
              rows={2}
              disabled={textareaDisabled}
              style={{ minHeight: '56px' }}
            />
            {mentionOpen && mentionResults.length > 0 && (
              <div className="absolute bottom-40 left-4 z-20 w-[520px] max-w-[calc(100%-2rem)] overflow-hidden rounded-md border border-border bg-popover shadow-xl">
                <div className="max-h-64 overflow-y-auto">
                  {mentionResults.map((item, idx) => (
                    <button
                      key={`${item.type}:${item.path}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention(item.path);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-accent ${
                        idx === mentionIndex ? 'bg-accent' : ''
                      }`}
                    >
                      <span className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground">
                        <FileTypeIcon path={item.path} type={item.type} size={14} />
                      </span>
                      <span className="truncate text-popover-foreground">{item.path}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-border px-3 py-1 text-xs text-muted-foreground">
                  Type to filter files and folders • ↑/↓ to navigate • Enter to insert
                </div>
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-between rounded-b-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <ProviderSelector
                value={provider as Provider}
                onChange={(v) => {
                  if (!selectDisabled && onProviderChange) onProviderChange(v);
                }}
                disabled={selectDisabled}
                detectedProviders={detectedProviders}
              />
            </div>

            <div className="flex items-center gap-2">
              {isLoading && (
                <span className="w-16 text-right text-xs font-medium tabular-nums text-muted-foreground">
                  {formatLoadingTime(loadingSeconds)}
                </span>
              )}
              <Button
                type="button"
                onClick={isLoading ? onCancel : onSend}
                disabled={sendDisabled}
                aria-label={
                  isTerminalProvider
                    ? 'Terminal-only provider'
                    : isLoading
                      ? 'Stop agent'
                      : 'Send'
                }
                className={`group h-9 w-9 rounded-lg p-0 transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 ${
                  isTerminalProvider
                    ? 'bg-muted text-muted-foreground'
                    : isLoading
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isTerminalProvider ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-3 w-3 rounded-sm bg-current opacity-50" />
                  </div>
                ) : isLoading ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="h-3 w-3 rounded-sm bg-current" />
                  </div>
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
