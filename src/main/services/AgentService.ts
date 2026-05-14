import { type ChildProcess, execFile, spawn } from "child_process";
import { app } from "electron";
import { EventEmitter } from "events";
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from "fs";
import path from "path";
import { promisify } from "util";
import { codexService } from "./CodexService";
import { type CustomClaudeConfig, databaseService } from "./DatabaseService";

const execFileAsync = promisify(execFile);

export type ProviderId = "codex" | "claude" | string; // Allow custom Claude config IDs

export interface AgentStartOptions {
	providerId: ProviderId;
	workspaceId: string;
	worktreePath: string;
	message: string;
	conversationId?: string;
	customClaudeConfigId?: string; // ID of custom Claude configuration to use
}

export class AgentService extends EventEmitter {
	private processes = new Map<string, ChildProcess>(); // key: providerId:workspaceId
	private writers = new Map<string, WriteStream>();

	private key(providerId: ProviderId, workspaceId: string) {
		return `${providerId}:${workspaceId}`;
	}

	private ensureLog(providerId: ProviderId, workspaceId: string) {
		const base = app.getPath("userData");
		const dir = path.join(base, "logs", "agent", providerId, workspaceId);
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		const file = path.join(dir, "stream.log");
		const w = createWriteStream(file, { flags: "w", encoding: "utf8" });
		this.writers.set(this.key(providerId, workspaceId), w);
		return w;
	}

	private append(providerId: ProviderId, workspaceId: string, data: string) {
		const w = this.writers.get(this.key(providerId, workspaceId));
		if (w && !w.destroyed) w.write(data);
	}

	private async resolveClaudePath(customClaudeConfigId?: string): Promise<string | null> {
		const { existsSync, readdirSync } = require("fs");
		const { homedir } = require("os");
		const path = require("path");
		const home = homedir();

		// Check for custom binary path from config first
		if (customClaudeConfigId) {
			try {
				const config =
					await databaseService.getCustomClaudeConfig(customClaudeConfigId);
				if (config?.binaryPath) {
					if (existsSync(config.binaryPath)) {
						console.log("[AgentService] Using custom binary path from config:", config.binaryPath);
						return config.binaryPath;
					}
					console.warn("[AgentService] Custom binary path not found on disk:", config.binaryPath);
				}
			} catch (error) {
				console.error("[AgentService] Failed to load config for binary path resolution:", error);
			}
		}

		const candidatePaths: string[] = [];

		// Try 'which' first (works if PATH is properly set)
		try {
			const { stdout } = await execFileAsync("which", ["claude"]);
			const claudePath = stdout.trim();
			if (claudePath && existsSync(claudePath)) {
				console.log("[AgentService] Found claude via which:", claudePath);
				return claudePath;
			}
		} catch (err) {
			console.log("[AgentService] which claude failed:", err);
		}

		// Check all nvm versions (no 'current' symlink, need to glob)
		const nvmDirs = [
			`${home}/.local/share/nvm`,
			`${home}/.nvm/versions/node`,
			`${home}/.nvm`,
		];

		for (const nvmDir of nvmDirs) {
			if (existsSync(nvmDir)) {
				try {
					const entries = readdirSync(nvmDir);
					const versions = entries.filter((v: string) => v.startsWith("v"));
					// Sort versions in reverse order to check newest first
					versions.sort().reverse();
					for (const version of versions) {
						candidatePaths.push(path.join(nvmDir, version, "bin", "claude"));
					}
				} catch (e) {
					console.log("[AgentService] Failed to read nvm dir:", nvmDir, e);
				}
			}
		}

		// Add PATH entries
		const pathEnv = process.env.PATH || "";
		console.log("[AgentService] Current PATH:", pathEnv);
		candidatePaths.push(
			...pathEnv
				.split(":")
				.filter(Boolean)
				.map((p: string) => `${p}/claude`),
		);

		// Also check common global npm paths
		candidatePaths.push(
			"/usr/local/bin/claude",
			"/opt/homebrew/bin/claude",
			`${home}/.npm-global/bin/claude`,
			`${home}/.local/bin/claude`,
		);

		console.log(
			"[AgentService] Checking",
			candidatePaths.length,
			"candidate paths for claude",
		);

		for (const candidatePath of candidatePaths) {
			if (existsSync(candidatePath)) {
				console.log("[AgentService] Found claude at:", candidatePath);
				return candidatePath;
			}
		}

		console.log("[AgentService] Claude not found in any of the checked paths");
		console.log(
			"[AgentService] First 5 paths checked:",
			candidatePaths.slice(0, 5),
		);
		return null;
	}

	async isInstalled(providerId: ProviderId): Promise<boolean> {
		try {
			if (providerId === "codex") {
				return await codexService.getInstallationStatus();
			}
			if (providerId === "claude") {
				const claudePath = await this.resolveClaudePath();
				if (!claudePath) return false;
				await execFileAsync(claudePath, ["--version"]);
				return true;
			}
			if (providerId === "kimi") {
				await execFileAsync("which", ["kimi"]);
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	getInstallationInstructions(providerId: ProviderId): string {
		if (providerId === "codex")
			return codexService.getInstallationInstructions();
		if (providerId === "claude") {
			return `Install Claude Code CLI:\n\n  npm install -g @anthropic-ai/claude-code\n\nThen authenticate once by running:\n\n  claude\n  /login\n\nAfter that, try again.`;
		}
		if (providerId === "kimi") {
			return `Install Kimi CLI:\n\n  npm install -g kimi-cli\n\nThen authenticate and try again.`;
		}
		return "";
	}

	private async getCustomClaudeEnv(
		customClaudeConfigId?: string,
	): Promise<NodeJS.ProcessEnv> {
		const env = { ...process.env };

		if (customClaudeConfigId) {
			try {
				console.log(
					"[AgentService] Loading custom Claude config:",
					customClaudeConfigId,
				);
				const config =
					await databaseService.getCustomClaudeConfig(customClaudeConfigId);
				if (config) {
					console.log("[AgentService] Custom Claude config loaded:", {
						name: config.name,
						hasBaseUrl: !!config.baseUrl,
						hasModel: !!config.model,
						hasAuthToken: !!config.authToken,
					});
					if (config.baseUrl) env.ANTHROPIC_BASE_URL = config.baseUrl;
					if (config.model) env.ANTHROPIC_MODEL = config.model;
					if (config.smallFastModel)
						env.ANTHROPIC_SMALL_FAST_MODEL = config.smallFastModel;
					if (config.authToken) env.ANTHROPIC_AUTH_TOKEN = config.authToken;
					if (config.disableNonessentialTraffic) {
						env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
					}
				} else {
					console.warn(
						"[AgentService] Custom Claude config not found:",
						customClaudeConfigId,
					);
				}
			} catch (error) {
				console.error(
					"Failed to load custom Claude config:",
					customClaudeConfigId,
					error,
				);
			}
		}

		return env;
	}

	private async getClaudeBinaryVersion(binaryPath: string): Promise<string | null> {
		try {
			const { stdout, stderr } = await execFileAsync(binaryPath, ["--version"]);
			const output = stdout || stderr;
			if (!output) return null;
			const match = output.match(/\d+\.\d+(\.\d+)?/);
			return match ? match[0] : null;
		} catch {
			return null;
		}
	}

	async detectBinaryVersion(binaryPath: string): Promise<{ version?: string; exists: boolean }> {
		const { existsSync } = require("fs");
		if (!existsSync(binaryPath)) {
			return { exists: false };
		}
		const version = await this.getClaudeBinaryVersion(binaryPath);
		return { exists: true, version: version || undefined };
	}

	async startStream(opts: AgentStartOptions): Promise<void> {
		const {
			providerId,
			workspaceId,
			worktreePath,
			message,
			conversationId,
			customClaudeConfigId,
		} = opts;

		// If codex, delegate to codexService (and events are bridged in agent IPC setup)
		if (providerId === "codex") {
			await codexService.sendMessageStream(
				workspaceId,
				message,
				conversationId,
			);
			return;
		}

		// Ensure only one process per workspace across providers
		for (const [key, proc] of this.processes) {
			const [, wid] = key.split(":");
			if (wid === workspaceId) {
				try {
					proc.kill("SIGTERM");
				} catch {}
				this.processes.delete(key);
			}
		}

		// Only one process per provider/workspace (redundant after global sweep but retained for safety)
		const k = this.key(providerId, workspaceId);
		const prev = this.processes.get(k);
		if (prev) {
			try {
				prev.kill("SIGTERM");
			} catch {}
			this.processes.delete(k);
		}

		const writer = this.ensureLog(providerId, workspaceId);
		writer.write(
			`=== Agent Stream ${new Date().toISOString()} ===\nProvider: ${providerId}\nWorkspace: ${workspaceId}\nMessage: ${message}\n\n--- Output ---\n`,
		);

		if (providerId === "claude") {
			// Try SDK first (preferred), fallback to CLI with safe edit flags
			let usedSdk = false;
			try {
				// Try to load SDK dynamically; avoid static import so build doesn't require it
				let cc: any = null;
				try {
					// eslint-disable-next-line @typescript-eslint/no-var-requires
					cc = require("@anthropic/claude-code-sdk");
				} catch {}
				if (cc && typeof cc.query === "function") {
					usedSdk = true;
					const abortController = new AbortController();
					// Store abort handle so stopStream can cancel
					const abortHandle = {
						kill: () => abortController.abort(),
					} as unknown as ChildProcess;
					this.processes.set(k, abortHandle);
					(async () => {
						try {
							const q: AsyncGenerator<any, void> = cc.query({
								prompt: message,
								options: {
									cwd: worktreePath,
									includePartialMessages: true,
									permissionMode: "acceptEdits",
									allowedTools: ["Edit", "MultiEdit", "Write", "Read"],
									abortController,
								},
							});
							for await (const msg of q) {
								try {
									let out = "";
									if (msg?.type === "stream_event") {
										const ev = msg.event || {};
										out = ev?.delta?.text || ev?.text || "";
									} else if (msg?.type === "assistant") {
										const content = msg.message?.content;
										if (Array.isArray(content))
											out = content.map((c: any) => c?.text || "").join("\n");
										else if (typeof content === "string") out = content;
									} else if (
										msg?.type === "result" &&
										typeof msg?.result === "string"
									) {
										out = msg.result;
									}
									if (out) {
										this.append(providerId, workspaceId, out);
										this.emit("agent:output", {
											providerId,
											workspaceId,
											output: out,
										});
									}
								} catch {}
							}
							this.append(
								providerId,
								workspaceId,
								`\n[COMPLETE] sdk success\n`,
							);
							try {
								writer.end();
							} catch {}
							this.writers.delete(k);
							this.processes.delete(k);
							this.emit("agent:complete", {
								providerId,
								workspaceId,
								exitCode: 0,
							});
						} catch (err: any) {
							const em = err?.message || String(err);
							this.append(providerId, workspaceId, `\n[ERROR] ${em}\n`);
							this.emit("agent:error", { providerId, workspaceId, error: em });
							try {
								writer.end();
							} catch {}
							this.writers.delete(k);
							this.processes.delete(k);
						}
					})();
				}
			} catch {
				usedSdk = false;
			}

			if (!usedSdk) {
				// CLI fallback with streaming JSON and safe edit tools
				const claudePath = await this.resolveClaudePath(customClaudeConfigId);
				if (!claudePath) {
					const err = "Claude CLI not found in PATH";
					this.append(providerId, workspaceId, `\n[ERROR] ${err}\n`);
					this.emit("agent:error", { providerId, workspaceId, error: err });
					try {
						writer.end();
					} catch {}
					this.writers.delete(k);
					return;
				}

				const args = [
					"-p",
					message,
					"--verbose",
					"--output-format",
					"stream-json",
					// Some CLI versions do not support --include-partial-messages; omit for compatibility.
					"--permission-mode",
					"acceptEdits",
					"--allowedTools",
					"Edit",
					"--allowedTools",
					"MultiEdit",
					"--allowedTools",
					"Write",
					"--allowedTools",
					"Read",
				];

				// Get custom environment variables if a custom config is specified
				const customEnv = await this.getCustomClaudeEnv(customClaudeConfigId);

				console.log("[AgentService] Starting Claude CLI:", {
					claudePath,
					cwd: worktreePath,
					customClaudeConfigId,
					hasCustomEnv: !!customClaudeConfigId,
					envVars: customClaudeConfigId
						? Object.keys(customEnv).filter((k) =>
								k.startsWith("ANTHROPIC_") || k.startsWith("CLAUDE_"),
							)
						: [],
				});

				const child = spawn(claudePath, args, {
					cwd: worktreePath,
					stdio: ["ignore", "pipe", "pipe"],
					env: customEnv,
				});
				this.processes.set(k, child);
				console.log("[AgentService] Claude CLI spawned, PID:", child.pid);
				let partial = "";
				child.stdout.on("data", (buf) => {
					partial += buf.toString();
					// Process line-delimited JSON events
					let idx;
					while ((idx = partial.indexOf("\n")) >= 0) {
						const line = partial.slice(0, idx).trim();
						partial = partial.slice(idx + 1);
						if (!line) continue;
						try {
							const obj = JSON.parse(line);
							let out = "";
							if (obj?.type === "stream_event") {
								const ev = obj?.event || {};
								out = ev?.delta?.text || ev?.text || "";
							} else if (obj?.type === "assistant") {
								const content = obj?.message?.content;
								if (Array.isArray(content))
									out = content.map((c: any) => c?.text || "").join("\n");
								else if (typeof content === "string") out = content;
							} else if (
								obj?.type === "result" &&
								typeof obj?.result === "string"
							) {
								out = obj.result;
							} else if (typeof obj?.message === "string") {
								out = obj.message;
							}
							if (out) {
								this.append(providerId, workspaceId, out);
								this.emit("agent:output", {
									providerId,
									workspaceId,
									output: out,
								});
							}
						} catch {
							// If not JSON, treat as plain text chunk
							this.append(providerId, workspaceId, line + "\n");
							this.emit("agent:output", {
								providerId,
								workspaceId,
								output: line + "\n",
							});
						}
					}
				});
				child.stderr.on("data", (buf) => {
					const s = buf.toString();
					this.append(providerId, workspaceId, `\n[stderr] ${s}`);
					this.emit("agent:error", { providerId, workspaceId, error: s });
				});
				child.on("close", (code) => {
					this.append(
						providerId,
						workspaceId,
						`\n[COMPLETE] exit code ${code}\n`,
					);
					try {
						writer.end();
					} catch {}
					this.writers.delete(k);
					this.processes.delete(k);
					this.emit("agent:complete", {
						providerId,
						workspaceId,
						exitCode: code ?? 0,
					});
				});
				child.on("error", (err) => {
					this.emit("agent:error", {
						providerId,
						workspaceId,
						error: err.message,
					});
				});
			}
			return;
		}

		if (providerId === "kimi") {
			const args = [message];
			const child = spawn("kimi", args, {
				cwd: worktreePath,
				stdio: ["ignore", "pipe", "pipe"],
			});
			this.processes.set(k, child);
			console.log("[AgentService] Kimi spawned, PID:", child.pid);

			child.stdout.on("data", (buf) => {
				const s = buf.toString();
				this.append(providerId, workspaceId, s);
				this.emit("agent:output", {
					providerId,
					workspaceId,
					output: s,
				});
			});
			child.stderr.on("data", (buf) => {
				const s = buf.toString();
				this.append(providerId, workspaceId, `\n[stderr] ${s}`);
				this.emit("agent:error", { providerId, workspaceId, error: s });
			});
			child.on("close", (code) => {
				this.append(
					providerId,
					workspaceId,
					`\n[COMPLETE] exit code ${code}\n`,
				);
				try {
					writer.end();
				} catch {}
				this.writers.delete(k);
				this.processes.delete(k);
				this.emit("agent:complete", {
					providerId,
					workspaceId,
					exitCode: code ?? 0,
				});
			});
			child.on("error", (err) => {
				this.emit("agent:error", {
					providerId,
					workspaceId,
					error: err.message,
				});
			});
			return;
		}

		// No other providers handled here
	}

	async stopStream(
		providerId: ProviderId,
		workspaceId: string,
	): Promise<boolean> {
		if (providerId === "codex") {
			return await codexService.stopMessageStream(workspaceId);
		}
		const k = this.key(providerId, workspaceId);
		const p = this.processes.get(k);
		if (!p) return true;
		try {
			p.kill("SIGTERM");
			this.processes.delete(k);
			const w = this.writers.get(k);
			if (w && !w.destroyed) w.end();
			this.writers.delete(k);
			return true;
		} catch {
			return false;
		}
	}
}

export const agentService = new AgentService();
