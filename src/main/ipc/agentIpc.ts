import { BrowserWindow, ipcMain } from "electron";
import { agentService } from "../services/AgentService";
import { codexService } from "../services/CodexService";
import { agentSwitchingService } from "../services/AgentSwitchingService";

export function registerAgentIpc() {
	// Installation check
	ipcMain.handle(
		"agent:check-installation",
		async (_e, providerId: "codex" | "claude") => {
			try {
				const ok = await agentService.isInstalled(providerId);
				return { success: true, isInstalled: ok };
			} catch (e: any) {
				return { success: false, error: e?.message || String(e) };
			}
		},
	);

	// Installation instructions
	ipcMain.handle(
		"agent:get-installation-instructions",
		async (_e, providerId: "codex" | "claude") => {
			try {
				const text = agentService.getInstallationInstructions(providerId);
				return { success: true, instructions: text };
			} catch (e: any) {
				return { success: false, error: e?.message || String(e) };
			}
		},
	);

	// Start streaming
	ipcMain.handle(
		"agent:send-message-stream",
		async (
			_e,
			args: {
				providerId: "codex" | "claude" | string;
				workspaceId: string;
				worktreePath: string;
				message: string;
				conversationId?: string;
				customClaudeConfigId?: string;
			},
		) => {
			try {
				await agentService.startStream(args);
				return { success: true };
			} catch (e: any) {
				return { success: false, error: e?.message || String(e) };
			}
		},
	);

	// Stop streaming
	ipcMain.handle(
		"agent:stop-stream",
		async (
			_e,
			args: { providerId: "codex" | "claude"; workspaceId: string },
		) => {
			try {
				const ok = await agentService.stopStream(
					args.providerId,
					args.workspaceId,
				);
				return { success: ok };
			} catch (e: any) {
				return { success: false, error: e?.message || String(e) };
			}
		},
	);

	// Bridge Codex native events to generic agent events so renderer can listen once
	codexService.on("codex:output", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) =>
			w.webContents.send("agent:stream-output", {
				providerId: "codex",
				...data,
			}),
		);
	});
	codexService.on("codex:error", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) =>
			w.webContents.send("agent:stream-error", {
				providerId: "codex",
				...data,
			}),
		);
	});
	codexService.on("codex:complete", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) =>
			w.webContents.send("agent:stream-complete", {
				providerId: "codex",
				...data,
			}),
		);
	});

	// Forward AgentService events (Claude et al.)
	agentService.on("agent:output", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) => w.webContents.send("agent:stream-output", data));
	});
	agentService.on("agent:error", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) => w.webContents.send("agent:stream-error", data));
	});
	agentService.on("agent:complete", (data: any) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) => w.webContents.send("agent:stream-complete", data));
	});

	// Agent switching handlers
	ipcMain.handle("agent:switch", async (event, { workspaceId, provider }) => {
		try {
			if (!workspaceId || !provider) {
				throw new Error('Workspace ID and provider are required');
			}

			const switchInfo = await agentSwitchingService.switchAgent(workspaceId, provider);

			return {
				success: true,
				switchInfo,
			};
		} catch (error) {
			console.error('Failed to switch agent:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	});

	ipcMain.handle("agent:get-current", async (event, workspaceId) => {
		try {
			if (!workspaceId) {
				throw new Error('Workspace ID is required');
			}

			const currentProvider = await agentSwitchingService.getCurrentProvider(workspaceId);

			return {
				success: true,
				provider: currentProvider,
			};
		} catch (error) {
			console.error('Failed to get current agent:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	});

	ipcMain.handle("agent:get-available", async () => {
		try {
			const providers = agentSwitchingService.getAvailableProviders();

			return {
				success: true,
				providers,
			};
		} catch (error) {
			console.error('Failed to get available providers:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	});

	// Forward agent switching events to renderer
	agentSwitchingService.on('agent-switched', (switchInfo) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) => w.webContents.send('agent:switched', switchInfo));
	});

	agentSwitchingService.on('agent-switch-failed', (switchInfo) => {
		const windows = BrowserWindow.getAllWindows();
		windows.forEach((w) => w.webContents.send('agent:switch-failed', switchInfo));
	});

	// console.log('✅ Agent IPC handlers registered');
}
