import { app, dialog, ipcMain, shell } from 'electron';
import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

export function registerAppIpc() {
  // Open external links in default browser
  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    try {
      if (!url || typeof url !== 'string') throw new Error('Invalid URL');
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Open a filesystem path in a specific application (Finder/Zed/VS Code/Ghostty)
  ipcMain.handle(
    'app:openIn',
    async (_event, args: { app: 'finder' | 'zed' | 'vscode' | 'ghostty'; path: string }) => {
      const target = args?.path;
      const which = args?.app;
      if (!target || typeof target !== 'string' || !which) {
        return { success: false, error: 'Invalid arguments' };
      }
      try {
        const platform = process.platform;
        const quoted = (p: string) => `'${p.replace(/'/g, "'\\''")}'`;

        let command = '';
        if (platform === 'darwin') {
          switch (which) {
            case 'finder':
              // Open directory in Finder
              command = `open ${quoted(target)}`;
              break;
            case 'zed':
              // Prefer CLI when available to ensure the folder opens in-app
              command = `command -v zed >/dev/null 2>&1 && zed ${quoted(target)} || open -a "Zed" ${quoted(target)}`;
              break;
            case 'vscode':
              command = `command -v code >/dev/null 2>&1 && code ${quoted(target)} || open -a "Visual Studio Code" ${quoted(target)}`;
              break;
            case 'ghostty':
              // Open Ghostty terminal at the target directory
              // This should open a new window with CWD set to target
              command = `open -a Ghostty ${quoted(target)}`;
              break;
          }
        } else if (platform === 'win32') {
          switch (which) {
            case 'finder':
              command = `explorer ${quoted(target)}`;
              break;
            case 'zed':
              // Zed installer usually adds to PATH; fallback to app path is omitted
              command = `start "" zed ${quoted(target)}`;
              break;
            case 'vscode':
              command = `start "" code ${quoted(target)}`;
              break;
            case 'ghostty':
              // Prefer Ghostty if available
              command = `start "" ghostty -d ${quoted(target)}`;
              break;
          }
        } else {
          // linux and others
          switch (which) {
            case 'finder':
              command = `xdg-open ${quoted(target)}`;
              break;
            case 'zed':
              command = `zed ${quoted(target)}`;
              break;
            case 'vscode':
              command = `code ${quoted(target)}`;
              break;
            case 'ghostty':
              // Try ghostty
              command = `ghostty --working-directory=${quoted(target)}`;
              break;
          }
        }

        if (!command) {
          return { success: false, error: 'Unsupported platform or app' };
        }

        await new Promise<void>((resolve, reject) => {
          exec(command, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  );

  // App metadata
  ipcMain.handle('app:getAppVersion', () => {
    try {
      // Try multiple possible paths for package.json
      const possiblePaths = [
        join(__dirname, '../../package.json'), // from dist/main/ipc
        join(__dirname, '../../../package.json'), // alternative path
        join(app.getAppPath(), 'package.json'), // production build
      ];

      for (const packageJsonPath of possiblePaths) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'nvcode' && packageJson.version) {
            return packageJson.version;
          }
        } catch {
          continue;
        }
      }
      return app.getVersion();
    } catch {
      return app.getVersion();
    }
  });
  ipcMain.handle('app:getElectronVersion', () => process.versions.electron);
  ipcMain.handle('app:getPlatform', () => process.platform);

  // File selection dialog for choosing binary paths
  ipcMain.handle('dialog:select-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Claude Binary',
        properties: ['openFile'],
        filters: [{ name: 'Executables', extensions: ['*'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No file selected' };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
