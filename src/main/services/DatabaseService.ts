import { app } from "electron";
import { existsSync, renameSync } from "fs";
import { join } from "path";
import type sqlite3Type from "sqlite3";
import { promisify } from "util";
import { log } from "../lib/logger";

export interface Project {
	id: string;
	name: string;
	path: string;
	gitInfo: {
		isGitRepo: boolean;
		remote?: string;
		branch?: string;
	};
	githubInfo?: {
		repository: string;
		connected: boolean;
	};
	createdAt: string;
	updatedAt: string;
}

export interface Workspace {
	id: string;
	projectId: string;
	name: string;
	branch: string;
	path: string;
	status: "active" | "idle" | "running";
	agentId?: string;
	metadata?: any;
	worktreeType?: "worktree" | "main";
	gitPullEnabled?: boolean;
	lastGitCheck?: string;
	setupCommands?: string;
	createdAt: string;
	updatedAt: string;
}

export interface SetupCommand {
	id: string;
	type: "global" | "project" | "workspace";
	parentId: string; // project_id or workspace_id
	commands: string[]; // JSON array of command strings
	enabled: boolean;
	name?: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Conversation {
	id: string;
	workspaceId: string;
	title: string;
	createdAt: string;
	updatedAt: string;
}

export interface Message {
	id: string;
	conversationId: string;
	content: string;
	sender: "user" | "agent";
	timestamp: string;
	metadata?: string; // JSON string for additional data
}

export interface CustomClaudeConfig {
	id: string;
	name: string;
	baseUrl?: string;
	model?: string;
	smallFastModel?: string;
	authToken?: string;
	disableNonessentialTraffic: boolean;
	createdAt: string;
	updatedAt: string;
}

export class DatabaseService {
	private db: sqlite3Type.Database | null = null;
	private sqlite3: typeof sqlite3Type | null = null;
	private dbPath: string;
	private disabled: boolean = false;

	constructor() {
		if (process.env.EMDASH_DISABLE_NATIVE_DB === "1") {
			this.disabled = true;
		}
		const userDataPath = app.getPath("userData");

		// Preferred/current DB filename
		const currentName = "emdash.db";
		const currentPath = join(userDataPath, currentName);

		// Known legacy filenames we may encounter from earlier builds/docs
		const legacyNames = ["database.sqlite", "orcbench.db"];

		// If current DB exists, use it
		if (existsSync(currentPath)) {
			this.dbPath = currentPath;
			return;
		}

		// Otherwise, migrate the first legacy DB we find to the current name
		for (const legacyName of legacyNames) {
			const legacyPath = join(userDataPath, legacyName);
			if (existsSync(legacyPath)) {
				try {
					renameSync(legacyPath, currentPath);
					this.dbPath = currentPath;
				} catch {
					// If rename fails for any reason, fall back to using the legacy file in place
					this.dbPath = legacyPath;
				}
				return;
			}
		}

		// No existing DB found; initialize a new one at the current path
		this.dbPath = currentPath;
	}

	async initialize(): Promise<void> {
		if (this.disabled) return Promise.resolve();
		if (!this.sqlite3) {
			try {
				// Dynamic import to avoid loading native module at startup
				this.sqlite3 = (await import(
					"sqlite3"
				)) as unknown as typeof sqlite3Type;
			} catch (e) {
				return Promise.reject(e);
			}
		}
		return new Promise((resolve, reject) => {
			this.db = new this.sqlite3!.Database(this.dbPath, (err) => {
				if (err) {
					reject(err);
					return;
				}

				this.createTables()
					.then(() => resolve())
					.catch(reject);
			});
		});
	}

	private async createTables(): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		const runAsync = promisify(this.db.run.bind(this.db));

		// Create projects table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        git_remote TEXT,
        git_branch TEXT,
        github_repository TEXT,
        github_connected BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create workspaces table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        agent_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);

		try {
			await runAsync(`ALTER TABLE workspaces ADD COLUMN metadata TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/duplicate column name/i.test(error.message)
			) {
				throw error;
			}
		}

		// Add new workspace columns for git polling and setup commands
		try {
			await runAsync(`ALTER TABLE workspaces ADD COLUMN worktree_type TEXT DEFAULT 'worktree'`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/duplicate column name/i.test(error.message)
			) {
				throw error;
			}
		}

		// Migrate existing workspaces: set worktree_type based on path
		// Main branch workspaces are those that don't contain '/worktrees/' in their path
		try {
			await runAsync(`
				UPDATE workspaces
				SET worktree_type = 'main'
				WHERE worktree_type IS NULL
				AND path NOT LIKE '%/worktrees/%'
			`);
		} catch (error) {
			log.warn('Failed to migrate worktree_type for existing workspaces:', error);
		}

		try {
			await runAsync(`ALTER TABLE workspaces ADD COLUMN git_pull_enabled BOOLEAN DEFAULT 1`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/duplicate column name/i.test(error.message)
			) {
				throw error;
			}
		}

		try {
			await runAsync(`ALTER TABLE workspaces ADD COLUMN last_git_check DATETIME`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/duplicate column name/i.test(error.message)
			) {
				throw error;
			}
		}

		try {
			await runAsync(`ALTER TABLE workspaces ADD COLUMN setup_commands TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/duplicate column name/i.test(error.message)
			) {
				throw error;
			}
		}

		// Create conversations table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
      )
    `);

		// Create messages table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      )
    `);

		// Create custom_claude_configs table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS custom_claude_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        base_url TEXT,
        model TEXT,
        small_fast_model TEXT,
        auth_token TEXT,
        disable_nonessential_traffic BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create setup_commands table
		await runAsync(`
      CREATE TABLE IF NOT EXISTS setup_commands (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('global', 'project', 'workspace')),
        parent_id TEXT NOT NULL,
        commands TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        name TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create indexes
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_projects_path ON projects (path)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_workspaces_project_id ON workspaces (project_id)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON conversations (workspace_id)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_custom_claude_configs_name ON custom_claude_configs (name)`,
		);
		await runAsync(
			`CREATE INDEX IF NOT EXISTS idx_setup_commands_parent ON setup_commands (parent_id, type)`,
		);
	}

	async saveProject(
		project: Omit<Project, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		// Important: avoid INSERT OR REPLACE on projects. REPLACE deletes the existing
		// row to satisfy UNIQUE(path) which can cascade-delete related workspaces
		// (workspaces.project_id ON DELETE CASCADE). Use an UPSERT on the unique
		// path constraint that updates fields in-place and preserves the existing id.
		//
		// Semantics:
		// - If no row exists for this path: insert with the provided id.
		// - If a row exists for this path: update fields; do NOT change id or path.
		// - created_at remains intact on updates; updated_at is bumped.
		return new Promise((resolve, reject) => {
			this.db!.run(
				`INSERT INTO projects (id, name, path, git_remote, git_branch, github_repository, github_connected, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(path) DO UPDATE SET
           name = excluded.name,
           git_remote = excluded.git_remote,
           git_branch = excluded.git_branch,
           github_repository = excluded.github_repository,
           github_connected = excluded.github_connected,
           updated_at = CURRENT_TIMESTAMP
        `,
				[
					project.id,
					project.name,
					project.path,
					project.gitInfo.remote || null,
					project.gitInfo.branch || null,
					project.githubInfo?.repository || null,
					project.githubInfo?.connected ? 1 : 0,
				],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async getProjects(): Promise<Project[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.all(
				`
        SELECT
          id, name, path, git_remote, git_branch, github_repository, github_connected,
          created_at, updated_at
        FROM projects
        ORDER BY updated_at DESC
      `,
				(err, rows: any[]) => {
					if (err) {
						reject(err);
					} else {
						const projects = rows.map((row) => ({
							id: row.id,
							name: row.name,
							path: row.path,
							gitInfo: {
								isGitRepo: !!(row.git_remote || row.git_branch),
								remote: row.git_remote,
								branch: row.git_branch,
							},
							githubInfo: row.github_repository
								? {
										repository: row.github_repository,
										connected: !!row.github_connected,
									}
								: undefined,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						}));
						resolve(projects);
					}
				},
			);
		});
	}

	async saveWorkspace(
		workspace: Omit<Workspace, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				`
        INSERT OR REPLACE INTO workspaces
        (id, project_id, name, branch, path, status, agent_id, metadata, worktree_type, git_pull_enabled, last_git_check, setup_commands, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[
					workspace.id,
					workspace.projectId,
					workspace.name,
					workspace.branch,
					workspace.path,
					workspace.status,
					workspace.agentId || null,
					typeof workspace.metadata === "string"
						? workspace.metadata
						: workspace.metadata
							? JSON.stringify(workspace.metadata)
							: null,
					workspace.worktreeType || 'worktree',
					workspace.gitPullEnabled !== undefined ? (workspace.gitPullEnabled ? 1 : 0) : 1,
					workspace.lastGitCheck || null,
					workspace.setupCommands || null,
				],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async getWorkspaces(projectId?: string): Promise<Workspace[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		let query = `
      SELECT
        id, project_id, name, branch, path, status, agent_id, metadata,
        worktree_type, git_pull_enabled, last_git_check, setup_commands,
        created_at, updated_at
      FROM workspaces
    `;
		const params: any[] = [];

		if (projectId) {
			query += " WHERE project_id = ?";
			params.push(projectId);
		}

		query += " ORDER BY updated_at DESC";

		return new Promise((resolve, reject) => {
			this.db!.all(query, params, (err, rows: any[]) => {
				if (err) {
					reject(err);
				} else {
					const workspaces = rows.map((row) => {
						let metadata: any = null;
						if (row.metadata) {
							try {
								metadata = JSON.parse(row.metadata);
							} catch (parseError) {
								console.warn(
									"Failed to parse workspace metadata for",
									row.id,
									parseError,
								);
								metadata = null;
							}
						}

						return {
							id: row.id,
							projectId: row.project_id,
							name: row.name,
							branch: row.branch,
							path: row.path,
							status: row.status,
							agentId: row.agent_id,
							metadata,
							worktreeType: row.worktree_type as "worktree" | "main" || "worktree",
							gitPullEnabled: !!row.git_pull_enabled,
							lastGitCheck: row.last_git_check,
							setupCommands: row.setup_commands,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						};
					});
					resolve(workspaces);
				}
			});
		});
	}

	async deleteProject(projectId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run("DELETE FROM projects WHERE id = ?", [projectId], (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	async deleteWorkspace(workspaceId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				"DELETE FROM workspaces WHERE id = ?",
				[workspaceId],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	// Conversation management methods
	async saveConversation(
		conversation: Omit<Conversation, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				`
        INSERT OR REPLACE INTO conversations
        (id, workspace_id, title, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[conversation.id, conversation.workspaceId, conversation.title],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async getConversations(workspaceId: string): Promise<Conversation[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.all(
				`
        SELECT * FROM conversations
        WHERE workspace_id = ?
        ORDER BY updated_at DESC
      `,
				[workspaceId],
				(err, rows: any[]) => {
					if (err) {
						reject(err);
					} else {
						const conversations = rows.map((row) => ({
							id: row.id,
							workspaceId: row.workspace_id,
							title: row.title,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						}));
						resolve(conversations);
					}
				},
			);
		});
	}

	async getOrCreateDefaultConversation(
		workspaceId: string,
	): Promise<Conversation> {
		if (this.disabled) {
			return {
				id: `conv-${workspaceId}-default`,
				workspaceId,
				title: "Default Conversation",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
		}
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			// First, try to get existing conversations
			this.db!.all(
				`
        SELECT * FROM conversations
        WHERE workspace_id = ?
        ORDER BY created_at ASC
        LIMIT 1
      `,
				[workspaceId],
				(err, rows: any[]) => {
					if (err) {
						reject(err);
						return;
					}

					if (rows.length > 0) {
						// Return existing conversation
						const row = rows[0];
						resolve({
							id: row.id,
							workspaceId: row.workspace_id,
							title: row.title,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						});
					} else {
						// Create new default conversation
						const conversationId = `conv-${workspaceId}-${Date.now()}`;
						this.db!.run(
							`
            INSERT INTO conversations
            (id, workspace_id, title, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
							[conversationId, workspaceId, "Default Conversation"],
							(err) => {
								if (err) {
									reject(err);
								} else {
									resolve({
										id: conversationId,
										workspaceId,
										title: "Default Conversation",
										createdAt: new Date().toISOString(),
										updatedAt: new Date().toISOString(),
									});
								}
							},
						);
					}
				},
			);
		});
	}

	// Message management methods
	async saveMessage(message: Omit<Message, "timestamp">): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				`
        INSERT INTO messages
        (id, conversation_id, content, sender, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[
					message.id,
					message.conversationId,
					message.content,
					message.sender,
					message.metadata || null,
				],
				(err) => {
					if (err) {
						reject(err);
					} else {
						// Update conversation's updated_at timestamp
						this.db!.run(
							`
            UPDATE conversations
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
							[message.conversationId],
							() => {
								resolve();
							},
						);
					}
				},
			);
		});
	}

	async getMessages(conversationId: string): Promise<Message[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.all(
				`
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `,
				[conversationId],
				(err, rows: any[]) => {
					if (err) {
						reject(err);
					} else {
						const messages = rows.map((row) => ({
							id: row.id,
							conversationId: row.conversation_id,
							content: row.content,
							sender: row.sender as "user" | "agent",
							timestamp: row.timestamp,
							metadata: row.metadata,
						}));
						resolve(messages);
					}
				},
			);
		});
	}

	async deleteConversation(conversationId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				"DELETE FROM conversations WHERE id = ?",
				[conversationId],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async close(): Promise<void> {
		if (this.disabled || !this.db) return;

		return new Promise((resolve, reject) => {
			this.db!.close((err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	// Custom Claude config management methods
	async saveCustomClaudeConfig(
		config: Omit<CustomClaudeConfig, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				`INSERT INTO custom_claude_configs
         (id, name, base_url, model, small_fast_model, auth_token, disable_nonessential_traffic, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET
           base_url = excluded.base_url,
           model = excluded.model,
           small_fast_model = excluded.small_fast_model,
           auth_token = excluded.auth_token,
           disable_nonessential_traffic = excluded.disable_nonessential_traffic,
           updated_at = CURRENT_TIMESTAMP
        `,
				[
					config.id,
					config.name,
					config.baseUrl || null,
					config.model || null,
					config.smallFastModel || null,
					config.authToken || null,
					config.disableNonessentialTraffic ? 1 : 0,
				],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async getCustomClaudeConfigs(): Promise<CustomClaudeConfig[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.all(
				`
        SELECT
          id, name, base_url, model, small_fast_model, auth_token,
          disable_nonessential_traffic, created_at, updated_at
        FROM custom_claude_configs
        ORDER BY created_at DESC
      `,
				(err, rows: any[]) => {
					if (err) {
						reject(err);
					} else {
						const configs = rows.map((row) => ({
							id: row.id,
							name: row.name,
							baseUrl: row.base_url,
							model: row.model,
							smallFastModel: row.small_fast_model,
							authToken: row.auth_token,
							disableNonessentialTraffic: !!row.disable_nonessential_traffic,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						}));
						resolve(configs);
					}
				},
			);
		});
	}

	async getCustomClaudeConfig(id: string): Promise<CustomClaudeConfig | null> {
		if (this.disabled) return null;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.get(
				`
        SELECT
          id, name, base_url, model, small_fast_model, auth_token,
          disable_nonessential_traffic, created_at, updated_at
        FROM custom_claude_configs
        WHERE id = ?
      `,
				[id],
				(err, row: any) => {
					if (err) {
						reject(err);
					} else if (!row) {
						resolve(null);
					} else {
						resolve({
							id: row.id,
							name: row.name,
							baseUrl: row.base_url,
							model: row.model,
							smallFastModel: row.small_fast_model,
							authToken: row.auth_token,
							disableNonessentialTraffic: !!row.disable_nonessential_traffic,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						});
					}
				},
			);
		});
	}

	async deleteCustomClaudeConfig(id: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				"DELETE FROM custom_claude_configs WHERE id = ?",
				[id],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	// Setup command management methods
	async saveSetupCommand(
		command: Omit<SetupCommand, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				`
        INSERT OR REPLACE INTO setup_commands
        (id, type, parent_id, commands, enabled, name, description, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
				[
					command.id,
					command.type,
					command.parentId,
					JSON.stringify(command.commands),
					command.enabled ? 1 : 0,
					command.name || null,
					command.description || null,
				],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	async getSetupCommands(
		type?: "global" | "project" | "workspace",
		parentId?: string
	): Promise<SetupCommand[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			let query = `
        SELECT
          id, type, parent_id, commands, enabled, name, description,
          created_at, updated_at
        FROM setup_commands
      `;
			const params: any[] = [];

			if (type && parentId) {
				query += " WHERE type = ? AND parent_id = ?";
				params.push(type, parentId);
			} else if (type) {
				query += " WHERE type = ?";
				params.push(type);
			} else if (parentId) {
				query += " WHERE parent_id = ?";
				params.push(parentId);
			}

			query += " ORDER BY created_at DESC";

			this.db!.all(query, params, (err, rows: any[]) => {
				if (err) {
					reject(err);
				} else {
					const commands = rows.map((row) => {
						let commandsArray: string[] = [];
						try {
							commandsArray = JSON.parse(row.commands);
						} catch (parseError) {
							console.warn("Failed to parse setup commands for", row.id, parseError);
						}

						return {
							id: row.id,
							type: row.type as "global" | "project" | "workspace",
							parentId: row.parent_id,
							commands: commandsArray,
							enabled: !!row.enabled,
							name: row.name,
							description: row.description,
							createdAt: row.created_at,
							updatedAt: row.updated_at,
						};
					});
					resolve(commands);
				}
			});
		});
	}

	async deleteSetupCommand(id: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		return new Promise((resolve, reject) => {
			this.db!.run(
				"DELETE FROM setup_commands WHERE id = ?",
				[id],
				(err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				},
			);
		});
	}

	// Get all setup commands for a workspace (including inherited from project and global)
	async getEffectiveSetupCommands(workspaceId: string, projectId?: string): Promise<SetupCommand[]> {
		if (this.disabled) return [];

		const allCommands: SetupCommand[] = [];

		// Get global commands
		try {
			const globalCommands = await this.getSetupCommands("global");
			allCommands.push(...globalCommands.filter(cmd => cmd.enabled));
		} catch (error) {
			console.warn("Failed to get global setup commands:", error);
		}

		// Get project-specific commands
		if (projectId) {
			try {
				const projectCommands = await this.getSetupCommands("project", projectId);
				allCommands.push(...projectCommands.filter(cmd => cmd.enabled));
			} catch (error) {
				console.warn("Failed to get project setup commands:", error);
			}
		}

		// Get workspace-specific commands
		try {
			const workspaceCommands = await this.getSetupCommands("workspace", workspaceId);
			allCommands.push(...workspaceCommands.filter(cmd => cmd.enabled));
		} catch (error) {
			console.warn("Failed to get workspace setup commands:", error);
		}

		return allCommands;
	}
}

export const databaseService = new DatabaseService();
