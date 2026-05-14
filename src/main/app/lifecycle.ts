import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { killAllPtys } from '../services/ptyManager';

let isQuitting = false;

export function registerAppLifecycle() {
  // Clean up PTY sessions before quitting
  app.on('before-quit', () => {
    if (!isQuitting) {
      isQuitting = true;
      console.log('[lifecycle] Cleaning up PTY sessions...');
      killAllPtys();
      console.log('[lifecycle] Cleanup complete');
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
