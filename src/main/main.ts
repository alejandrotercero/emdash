import { app } from 'electron';
// Ensure PATH matches the user's shell when launched from Finder (macOS)
// so Homebrew/NPM global binaries like `gh` and `codex` are found.
try {
  // Lazy import to avoid bundler complaints if not present on other platforms
  // We also defensively prepend common Homebrew locations.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fixPath = require('fix-path');
  if (typeof fixPath === 'function') fixPath();
} catch {
  // no-op if fix-path isn't available at runtime
}

if (process.platform === 'darwin') {
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/homebrew/sbin', '/usr/local/sbin'];
  const cur = process.env.PATH || '';
  const parts = cur.split(':').filter(Boolean);
  for (const p of extras) {
    if (!parts.includes(p)) parts.unshift(p);
  }
  process.env.PATH = parts.join(':');

  // As a last resort, ask the user's login shell for PATH and all env vars.
  try {
    const { execSync } = require('child_process');
    const shell = process.env.SHELL || '/bin/zsh';

    // Fish shell requires separate flags: -l -c instead of -ilc
    const isFish = shell.includes('fish');

    // Get PATH
    // Fish uses spaces to separate PATH, so we need to join with colons
    const pathCmd = isFish
      ? `${shell} -l -c 'string join : $PATH'`
      : `${shell} -ilc 'echo -n $PATH'`;
    const loginPath = execSync(pathCmd, { encoding: 'utf8', timeout: 5000 });
    if (loginPath) {
      const merged = new Set((loginPath + ':' + process.env.PATH).split(':').filter(Boolean));
      process.env.PATH = Array.from(merged).join(':');
      console.log('[main.ts] Loaded PATH from shell:', isFish ? 'fish' : 'bash/zsh');
      console.log('[main.ts] PATH entries containing nvm:',
        process.env.PATH.split(':').filter(p => p.includes('nvm')));
      console.log('[main.ts] Total PATH entries:', process.env.PATH.split(':').length);
    }

    // Get all environment variables (for things like ANTHROPIC_API_KEY, etc.)
    const envCmd = isFish ? `${shell} -l -c 'env'` : `${shell} -ilc 'env'`;
    const envOutput = execSync(envCmd, { encoding: 'utf8', timeout: 5000 });
    envOutput.split('\n').forEach((line: string) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && match[1]) {
        const [, key, value] = match;
        // Only set if not already in process.env (don't override Electron's env)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.error('[main.ts] Failed to load shell environment:', error);
  }
}
import { createMainWindow } from './app/window';
import { registerAppLifecycle } from './app/lifecycle';
import { registerAllIpc } from './ipc';
import { databaseService } from './services/DatabaseService';

// App bootstrap
app.whenReady().then(async () => {
  // Initialize database
  try {
    await databaseService.initialize();
    // console.log('Database initialized successfully');
  } catch (error) {
    // console.error('Failed to initialize database:', error);
  }

  // Register IPC handlers
  registerAllIpc();

  // Create main window
  createMainWindow();
});

// App lifecycle handlers
registerAppLifecycle();

// Graceful shutdown: close PGlite to flush WAL to disk
app.on('before-quit', async () => {
  try {
    await databaseService.close();
  } catch {
    // Non-critical: PGlite will recover on next startup
  }
});
