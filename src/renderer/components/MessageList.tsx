import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types/chat';
import { parseCodexOutput, parseCodexStream } from '../lib/codexParse';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Response } from '@/components/ai-elements/response';
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block';
import StreamingAction from './StreamingAction';
import { Badge } from '@/components/ui/badge';
import FileTypeIcon from '@/components/ui/file-type-icon';
import ThinkingDots from '@/components/ai-elements/thinking-dots';
import { ArrowDown } from 'lucide-react';

function basename(p: string): string {
  const b = p.split('/').pop() || p;
  return b;
}
function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  if (i <= 0) return '';
  return b.slice(i + 1).toUpperCase();
}

interface MessageListProps {
  messages: Message[];
  streamingOutput: string | null;
  isStreaming?: boolean;
  awaitingThinking?: boolean;
  providerId?: 'codex' | 'claude';
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  streamingOutput,
  isStreaming = false,
  awaitingThinking = false,
  providerId = 'codex',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const scrollToBottom = useCallback((force = false) => {
    if (!shouldAutoScroll && !force) return;
    // Double RAF: first waits for React to commit layout, second waits for paint
    // so scrollHeight reflects the fully rendered content (critical for bulk loads)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        isProgrammaticScroll.current = true;
        container.scrollTop = container.scrollHeight;
        // Reset flag after the scroll event has had a chance to fire
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
      });
    });
  }, [shouldAutoScroll]);

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    const nearBottom = isNearBottom();
    setShouldAutoScroll(nearBottom);

    if (!nearBottom) {
      setIsUserScrolling(true);
    } else {
      setIsUserScrolling(false);
    }
  }, [isNearBottom]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currCount = messages.length;
    prevMessageCountRef.current = currCount;
    // Force scroll when many messages load at once (e.g. resume conversation)
    const isBulkLoad = currCount - prevCount > 5;
    scrollToBottom(isBulkLoad);
  }, [messages, streamingOutput, scrollToBottom]);

  const handleScrollToBottomClick = useCallback(() => {
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    const container = scrollContainerRef.current;
    if (!container) return;
    isProgrammaticScroll.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const c = scrollContainerRef.current;
        if (c) c.scrollTop = c.scrollHeight;
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false;
        });
      });
    });
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 pb-2 pt-6"
        style={{
          maskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 93%, transparent 100%)',
        }}
      >
      <div className="mx-auto max-w-4xl space-y-6">
        {messages.map((message) => {
          const isUserMessage = message.sender === 'user';
          const content = message.content ?? '';
          const trimmedContent = content.trim();
          if (!isUserMessage && !trimmedContent) return null;

          // Parse agent outputs for reasoning blocks
          const parsed = !isUserMessage && trimmedContent ? parseCodexOutput(trimmedContent) : null;

          return (
            <div
              key={message.id}
              className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 font-sans text-sm leading-relaxed text-gray-900 dark:text-gray-100 ${
                  isUserMessage ? 'rounded-md bg-gray-100 dark:bg-neutral-800' : ''
                }`}
              >
                {isUserMessage ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        code: ({ inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 dark:bg-neutral-900">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code
                              className="rounded bg-gray-100 px-1 py-0.5 text-sm dark:bg-neutral-900"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        ul: ({ children }) => (
                          <ul className="my-2 list-inside list-disc space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="my-2 list-inside list-decimal space-y-1">{children}</ol>
                        ),
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => (
                          <span className="font-normal">{children}</span>
                        ),
                        em: ({ children }) => <em className="italic">{children}</em>,
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                    {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {message.attachments.map((p) => (
                          <Badge key={p} className="flex items-center gap-1">
                            <FileTypeIcon path={p} type="file" className="h-3.5 w-3.5" />
                            <span>{basename(p)}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {parsed?.reasoning ? (
                      <Reasoning className="w-full" isStreaming={false} defaultOpen={false}>
                        <ReasoningTrigger />
                        <ReasoningContent>{parsed.reasoning || ''}</ReasoningContent>
                      </Reasoning>
                    ) : null}
                    <Response>{parsed ? parsed.response : trimmedContent}</Response>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {streamingOutput !== null && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 font-sans text-sm leading-relaxed text-gray-900 dark:text-gray-100">
              {providerId === 'codex' ? (
                (() => {
                  const parsed = parseCodexStream(streamingOutput || '');
                  if (awaitingThinking) return <ThinkingDots />;
                  return (
                    <div className="space-y-3">
                      {parsed.reasoning ? (
                        <Reasoning
                          className="w-full"
                          isStreaming={!!isStreaming}
                          defaultOpen={false}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{parsed.reasoning || ''}</ReasoningContent>
                        </Reasoning>
                      ) : null}
                      {parsed.hasCodex && parsed.response ? (
                        <Response>{parsed.response}</Response>
                      ) : null}
                      {parsed && parsed.actions && parsed.actions.length > 0 ? (
                        <StreamingAction text={parsed.actions[parsed.actions.length - 1]} />
                      ) : null}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-3">
                  {streamingOutput && streamingOutput.trim().length > 0 ? (
                    <Response>{streamingOutput}</Response>
                  ) : null}
                  {isStreaming ? <ThinkingDots /> : null}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      </div>
      {isUserScrolling && (
        <button
          type="button"
          onClick={handleScrollToBottomClick}
          aria-label="Scroll to bottom"
          className="absolute bottom-6 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 shadow-md transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default MessageList;
