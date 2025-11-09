import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { killAllPtys } from '../services/ptyManager';

let isQuitting = false;

export function registerAppLifecycle() {
  // Clean up PTY sessions BEFORE quitting
  app.on('before-quit', (event) => {
    if (!isQuitting) {
      console.log('[lifecycle] before-quit: Cleaning up PTY sessions...');

      // Prevent quit until cleanup is done
      event.preventDefault();
      isQuitting = true;

      try {
        // Kill all active PTY sessions
        killAllPtys();

        // Small delay to ensure cleanup completes
        setTimeout(() => {
          console.log('[lifecycle] Cleanup complete, quitting now');
          app.quit();
        }, 100);
      } catch (err) {
        console.error('[lifecycle] Error during PTY cleanup:', err);
        // Quit anyway to avoid hanging
        app.quit();
      }
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}
