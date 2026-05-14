import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFileDiff, type DiffLine } from '../hooks/useFileDiff';
import { type FileChange } from '../hooks/useFileChanges';

interface ChangesDiffModalProps {
  open: boolean;
  onClose: () => void;
  workspacePath: string;
  files: FileChange[];
  initialFile?: string;
}

const Line: React.FC<{ text?: string; type: DiffLine['type'] }> = ({ text = '', type }) => {
  const cls =
    type === 'add'
      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
      : type === 'del'
        ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200'
        : 'bg-transparent text-neutral-700 dark:text-neutral-300';
  return (
    <div
      className={`whitespace-pre-wrap break-words px-3 py-0.5 font-mono-custom text-[12px] leading-5 ${cls}`}
    >
      {text}
    </div>
  );
};

export const ChangesDiffModal: React.FC<ChangesDiffModalProps> = ({
  open,
  onClose,
  workspacePath,
  files,
  initialFile,
}) => {
  const [selected, setSelected] = useState<string | undefined>(initialFile || files[0]?.path);
  const { lines, loading } = useFileDiff(workspacePath, selected);
  const shouldReduceMotion = useReducedMotion();

  const grouped = useMemo(() => {
    // Convert linear diff into rows for side-by-side
    const rows: Array<{ left?: DiffLine; right?: DiffLine }> = [];
    for (const l of lines) {
      if (l.type === 'context') {
        rows.push({
          left: { ...l, left: l.left, right: undefined },
          right: { ...l, right: l.right, left: undefined },
        });
      } else if (l.type === 'del') {
        rows.push({ left: l });
      } else if (l.type === 'add') {
        // Try to pair with previous deletion if it exists and right is empty
        const last = rows[rows.length - 1];
        if (last && last.right === undefined && last.left && last.left.type === 'del') {
          last.right = l;
        } else {
          rows.push({ right: l });
        }
      }
    }
    return rows;
  }, [lines]);

  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
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
            className="flex h-[82vh] w-[92vw] transform-gpu overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl will-change-transform dark:border-neutral-700 dark:bg-neutral-800"
          >
            <div className="w-72 overflow-y-auto border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/40">
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Changed Files
              </div>
              {files.map((f) => (
                <button
                  key={f.path}
                  className={`w-full border-b border-neutral-200 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-700 ${
                    selected === f.path
                      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                  onClick={() => setSelected(f.path)}
                >
                  <div className="truncate font-medium">{f.path}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {f.status} • +{f.additions} / -{f.deletions}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/50">
                <div className="truncate text-sm text-neutral-700 dark:text-neutral-200">{selected}</div>
                <button
                  onClick={onClose}
                  className="rounded-md p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400">
                    Loading diff…
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-px bg-neutral-200 dark:bg-neutral-800">
                    <div className="bg-white dark:bg-neutral-900">
                      {grouped.map((r, idx) => (
                        <Line
                          key={`l-${idx}`}
                          text={r.left?.left ?? r.left?.right}
                          type={r.left?.type || 'context'}
                        />
                      ))}
                    </div>
                    <div className="bg-white dark:bg-neutral-900">
                      {grouped.map((r, idx) => (
                        <Line
                          key={`r-${idx}`}
                          text={r.right?.right ?? r.right?.left}
                          type={r.right?.type || 'context'}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ChangesDiffModal;
