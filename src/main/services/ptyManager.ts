import os from 'os';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

type PtyRecord = {
  id: string;
  proc: IPty;
};

const ptys = new Map<string, PtyRecord>();

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    // Prefer ComSpec (usually cmd.exe) or fallback to PowerShell
    return process.env.ComSpec || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

export function startPty(options: {
  id: string;
  cwd?: string;
  shell?: string;
  env?: NodeJS.ProcessEnv;
  cols?: number;
  rows?: number;
}): IPty {
  const { id, cwd, shell, env, cols = 80, rows = 24 } = options;

  const useShell = shell || getDefaultShell();
  const useCwd = cwd || process.cwd() || os.homedir();
  const useEnv = { TERM: 'xterm-256color', ...process.env, ...(env || {}) };

  // Log custom env vars being applied
  if (env && Object.keys(env).length > 0) {
    const customEnvKeys = Object.keys(env).filter(k =>
      k.startsWith('ANTHROPIC_') || k.startsWith('CLAUDE_')
    );
    if (customEnvKeys.length > 0) {
      console.log('[ptyManager] Spawning shell with custom env vars:', {
        shell: useShell,
        customEnvKeys,
        values: customEnvKeys.reduce((obj, key) => {
          obj[key] = env[key];
          return obj;
        }, {} as Record<string, any>)
      });
    }
  }

  const proc = pty.spawn(useShell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: useCwd,
    env: useEnv,
  });

  const rec: PtyRecord = { id, proc };
  ptys.set(id, rec);
  return proc;
}

export function writePty(id: string, data: string): void {
  const rec = ptys.get(id);
  if (!rec) return;
  rec.proc.write(data);
}

export function resizePty(id: string, cols: number, rows: number): void {
  const rec = ptys.get(id);
  if (!rec) return;
  rec.proc.resize(cols, rows);
}

export function killPty(id: string): void {
  const rec = ptys.get(id);
  if (!rec) return;
  try {
    rec.proc.kill();
  } finally {
    ptys.delete(id);
  }
}

export function hasPty(id: string): boolean {
  return ptys.has(id);
}

export function getPty(id: string): IPty | undefined {
  return ptys.get(id)?.proc;
}

/**
 * Kill all active PTY sessions.
 * IMPORTANT: Must be called before app quit to prevent crashes.
 */
export function killAllPtys(): void {
  console.log(`[ptyManager] Cleaning up ${ptys.size} active PTY sessions...`);

  const ptyIds = Array.from(ptys.keys());

  for (const id of ptyIds) {
    try {
      const rec = ptys.get(id);
      if (rec) {
        console.log(`[ptyManager] Killing PTY: ${id}`);
        rec.proc.kill();
        ptys.delete(id);
      }
    } catch (err) {
      console.error(`[ptyManager] Error killing PTY ${id}:`, err);
      // Still remove it from the map
      ptys.delete(id);
    }
  }

  console.log('[ptyManager] All PTY sessions cleaned up');
}
