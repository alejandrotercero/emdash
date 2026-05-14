import { app } from "electron";
import { existsSync, renameSync, mkdirSync } from "fs";
import { join } from "path";
import type { PGlite } from "@electric-sql/pglite";
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
	baseBranch?: string; // Branch this workspace was created from (for PR targeting)
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
	binaryPath?: string;
	createdAt: string;
	updatedAt: string;
}

export class DatabaseService {
	private db: PGlite | null = null;
	private dbPath: string;
	private disabled: boolean = false;

	constructor() {
		if (process.env.EMDASH_DISABLE_NATIVE_DB === "1") {
			this.disabled = true;
		}
		const userDataPath = app.getPath("userData");

		// PGlite data directory (directory, not a single file)
		this.dbPath = join(userDataPath, "pglite-data");
	}

	async initialize(): Promise<void> {
		if (this.disabled) return;

		try {
			const { PGlite: PGliteClass } = await import(
				"@electric-sql/pglite"
			) as any;

			// Create data directory if it doesn't exist
			if (!existsSync(this.dbPath)) {
				mkdirSync(this.dbPath, { recursive: true });
			}

			// Initialize PGlite with filesystem persistence
			this.db = await (PGliteClass as any).create(this.dbPath);

			// Create tables and run migrations
			await this.createTables();

			// Migrate data from old SQLite database if it exists
			await this.migrateFromSqlite();
		} catch (e) {
			log.error("Failed to initialize PGlite database:", e);
			throw e;
		}
	}

	private async createTables(): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		// Create projects table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        git_remote TEXT,
        git_branch TEXT,
        github_repository TEXT,
        github_connected BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create workspaces table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        agent_id TEXT,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
      )
    `);

		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN metadata TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		// Add new workspace columns for git polling and setup commands
		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN worktree_type TEXT DEFAULT 'worktree'`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		// Migrate existing workspaces: set worktree_type based on path
		// Main branch workspaces are those that don't contain '/worktrees/' in their path
		try {
			await this.db.exec(`
				UPDATE workspaces
				SET worktree_type = 'main'
				WHERE worktree_type = 'worktree'
				AND path NOT LIKE '%/worktrees/%'
			`);
		} catch (error) {
			log.warn('Failed to migrate worktree_type for existing workspaces:', error);
		}

		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN git_pull_enabled BOOLEAN DEFAULT true`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN last_git_check TIMESTAMP`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN setup_commands TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		// Add base_branch column to track original branch for PR targeting
		try {
			await this.db.exec(`ALTER TABLE workspaces ADD COLUMN base_branch TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		// Create conversations table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
      )
    `);

		// Create messages table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'agent')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      )
    `);

		// Create custom_claude_configs table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_claude_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        base_url TEXT,
        model TEXT,
        small_fast_model TEXT,
        auth_token TEXT,
        disable_nonessential_traffic BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Add binary_path column for custom Claude binary paths
		try {
			await this.db.exec(`ALTER TABLE custom_claude_configs ADD COLUMN binary_path TEXT`);
		} catch (error) {
			if (
				!(error instanceof Error) ||
				!/already exists/i.test(error.message)
			) {
				throw error;
			}
		}

		// Create setup_commands table
		await this.db.exec(`
      CREATE TABLE IF NOT EXISTS setup_commands (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('global', 'project', 'workspace')),
        parent_id TEXT NOT NULL,
        commands TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        name TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create indexes
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_projects_path ON projects (path)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_workspaces_project_id ON workspaces (project_id)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON conversations (workspace_id)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_custom_claude_configs_name ON custom_claude_configs (name)`,
		);
		await this.db.exec(
			`CREATE INDEX IF NOT EXISTS idx_setup_commands_parent ON setup_commands (parent_id, type)`,
		);
	}

	/**
	 * One-time migration from the old SQLite database (emdash.db) to PGlite.
	 * Runs after createTables() on first launch with an existing sqlite3 DB present.
	 */
	private async migrateFromSqlite(): Promise<void> {
		if (this.disabled) return;

		const userDataPath = app.getPath("userData");
		const oldDbPath = join(userDataPath, "emdash.db");
		const migratedMarker = join(userDataPath, "emdash.db.migrated");

		// Skip if no old DB or already migrated
		if (!existsSync(oldDbPath) || existsSync(migratedMarker)) return;

		log.info("Migrating data from SQLite database to PGlite...");

		let sqlite3Module: any;
		try {
			// @ts-expect-error - sqlite3 may be absent; gracefully handled by try/catch
			sqlite3Module = await import("sqlite3");
		} catch {
			log.warn("sqlite3 module not available, skipping data migration");
			// Mark as done so we don't retry
			renameSync(oldDbPath, migratedMarker);
			return;
		}

		const { promisify } = await import("util");

		try {
			// Open old SQLite DB
			const oldDb: any = await new Promise((resolve, reject) => {
				const db = new sqlite3Module.Database(oldDbPath, (err: Error | null) => {
					if (err) reject(err);
					else resolve(db);
				});
			});

			const allAsync = promisify(oldDb.all.bind(oldDb));

			// Migrate all data inside a single PGlite transaction
			await this.db!.transaction(async (tx) => {
				// Migrate projects
				const projects = await allAsync("SELECT * FROM projects ORDER BY created_at ASC");
				for (const p of projects) {
					await tx.query(
						`INSERT INTO projects (id, name, path, git_remote, git_branch, github_repository, github_connected, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						 ON CONFLICT (path) DO NOTHING`,
						[p.id, p.name, p.path, p.git_remote, p.git_branch,
						 p.github_repository, !!p.github_connected,
						 p.created_at || new Date().toISOString(),
						 p.updated_at || new Date().toISOString()]
					);
				}

				// Migrate workspaces
				const workspaces = await allAsync("SELECT * FROM workspaces ORDER BY created_at ASC");
				for (const w of workspaces) {
					await tx.query(
						`INSERT INTO workspaces
						 (id, project_id, name, branch, base_branch, path, status, agent_id,
						  metadata, worktree_type, git_pull_enabled, last_git_check,
						  setup_commands, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
						 ON CONFLICT (id) DO NOTHING`,
						[w.id, w.project_id, w.name, w.branch, w.base_branch || null,
						 w.path, w.status, w.agent_id || null, w.metadata || null,
						 w.worktree_type || "worktree", !!w.git_pull_enabled,
						 w.last_git_check || null, w.setup_commands || null,
						 w.created_at || new Date().toISOString(),
						 w.updated_at || new Date().toISOString()]
					);
				}

				// Migrate conversations
				const conversations = await allAsync("SELECT * FROM conversations ORDER BY created_at ASC");
				for (const c of conversations) {
					await tx.query(
						`INSERT INTO conversations (id, workspace_id, title, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5)
						 ON CONFLICT (id) DO NOTHING`,
						[c.id, c.workspace_id, c.title,
						 c.created_at || new Date().toISOString(),
						 c.updated_at || new Date().toISOString()]
					);
				}

				// Migrate messages
				const messages = await allAsync("SELECT * FROM messages ORDER BY timestamp ASC");
				for (const m of messages) {
					await tx.query(
						`INSERT INTO messages (id, conversation_id, content, sender, timestamp, metadata)
						 VALUES ($1, $2, $3, $4, $5, $6)
						 ON CONFLICT (id) DO NOTHING`,
						[m.id, m.conversation_id, m.content, m.sender,
						 m.timestamp || new Date().toISOString(), m.metadata || null]
					);
				}

				// Migrate custom_claude_configs
				const configs = await allAsync("SELECT * FROM custom_claude_configs ORDER BY created_at ASC");
				for (const cfg of configs) {
					await tx.query(
						`INSERT INTO custom_claude_configs
						 (id, name, base_url, model, small_fast_model, auth_token,
						  disable_nonessential_traffic, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						 ON CONFLICT (name) DO NOTHING`,
						[cfg.id, cfg.name, cfg.base_url || null, cfg.model || null,
						 cfg.small_fast_model || null, cfg.auth_token || null,
						 !!cfg.disable_nonessential_traffic,
						 cfg.created_at || new Date().toISOString(),
						 cfg.updated_at || new Date().toISOString()]
					);
				}

				// Migrate setup_commands
				const commands = await allAsync("SELECT * FROM setup_commands ORDER BY created_at ASC");
				for (const cmd of commands) {
					await tx.query(
						`INSERT INTO setup_commands
						 (id, type, parent_id, commands, enabled, name, description,
						  created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						 ON CONFLICT (id) DO NOTHING`,
						[cmd.id, cmd.type, cmd.parent_id, cmd.commands,
						 !!cmd.enabled, cmd.name || null, cmd.description || null,
						 cmd.created_at || new Date().toISOString(),
						 cmd.updated_at || new Date().toISOString()]
					);
				}
			});

			// Close old DB and mark as migrated
			await new Promise<void>((resolve, reject) => {
				oldDb.close((err: Error | null) => {
					if (err) reject(err);
					else resolve();
				});
			});
			renameSync(oldDbPath, migratedMarker);
			log.info("SQLite database migration to PGlite completed successfully");
		} catch (error) {
			log.error("Failed to migrate SQLite data to PGlite:", error);
			// Do NOT delete the old database on failure; user data is safe
			throw error;
		}
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
		await this.db.query(
			`INSERT INTO projects (id, name, path, git_remote, git_branch, github_repository, github_connected, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (path) DO UPDATE SET
         name = EXCLUDED.name,
         git_remote = EXCLUDED.git_remote,
         git_branch = EXCLUDED.git_branch,
         github_repository = EXCLUDED.github_repository,
         github_connected = EXCLUDED.github_connected,
         updated_at = CURRENT_TIMESTAMP`,
			[
				project.id,
				project.name,
				project.path,
				project.gitInfo.remote || null,
				project.gitInfo.branch || null,
				project.githubInfo?.repository || null,
				project.githubInfo?.connected ?? false,
			],
		);
	}

	async getProjects(): Promise<Project[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		const result = await this.db.query(`
      SELECT
        id, name, path, git_remote, git_branch, github_repository, github_connected,
        created_at, updated_at
      FROM projects
      ORDER BY updated_at DESC
    `);

		return result.rows.map((row: any) => ({
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
	}

	async saveWorkspace(
		workspace: Omit<Workspace, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query(
			`INSERT INTO workspaces
       (id, project_id, name, branch, base_branch, path, status, agent_id, metadata, worktree_type, git_pull_enabled, last_git_check, setup_commands, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         name = EXCLUDED.name,
         branch = EXCLUDED.branch,
         base_branch = EXCLUDED.base_branch,
         path = EXCLUDED.path,
         status = EXCLUDED.status,
         agent_id = EXCLUDED.agent_id,
         metadata = EXCLUDED.metadata,
         worktree_type = EXCLUDED.worktree_type,
         git_pull_enabled = EXCLUDED.git_pull_enabled,
         last_git_check = EXCLUDED.last_git_check,
         setup_commands = EXCLUDED.setup_commands,
         updated_at = CURRENT_TIMESTAMP`,
			[
				workspace.id,
				workspace.projectId,
				workspace.name,
				workspace.branch,
				workspace.baseBranch || null,
				workspace.path,
				workspace.status,
				workspace.agentId || null,
				typeof workspace.metadata === "string"
					? workspace.metadata
					: workspace.metadata
						? JSON.stringify(workspace.metadata)
						: null,
				workspace.worktreeType || 'worktree',
				workspace.gitPullEnabled !== undefined ? workspace.gitPullEnabled : true,
				workspace.lastGitCheck || null,
				workspace.setupCommands || null,
			],
		);
	}

	async getWorkspaces(projectId?: string): Promise<Workspace[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		let query = `
      SELECT
        id, project_id, name, branch, base_branch, path, status, agent_id, metadata,
        worktree_type, git_pull_enabled, last_git_check, setup_commands,
        created_at, updated_at
      FROM workspaces
    `;
		const params: any[] = [];

		if (projectId) {
			query += " WHERE project_id = $1";
			params.push(projectId);
		}

		query += " ORDER BY updated_at DESC";

		const result = await this.db.query(query, params);

		return result.rows.map((row: any) => {
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
				baseBranch: row.base_branch || undefined,
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
	}

	async deleteProject(projectId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query("DELETE FROM projects WHERE id = $1", [projectId]);
	}

	async deleteWorkspace(workspaceId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
	}

	// Conversation management methods
	async saveConversation(
		conversation: Omit<Conversation, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query(
			`INSERT INTO conversations
       (id, workspace_id, title, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         workspace_id = EXCLUDED.workspace_id,
         title = EXCLUDED.title,
         updated_at = CURRENT_TIMESTAMP`,
			[conversation.id, conversation.workspaceId, conversation.title],
		);
	}

	async getConversations(workspaceId: string): Promise<Conversation[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		const result = await this.db.query(
			`SELECT * FROM conversations
       WHERE workspace_id = $1
       ORDER BY updated_at DESC`,
			[workspaceId],
		);

		return result.rows.map((row: any) => ({
			id: row.id,
			workspaceId: row.workspace_id,
			title: row.title,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
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

		// First, try to get existing conversations
		const result = await this.db.query(
			`SELECT * FROM conversations
       WHERE workspace_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
			[workspaceId],
		);

		if (result.rows.length > 0) {
			const row = result.rows[0] as any;
			return {
				id: row.id,
				workspaceId: row.workspace_id,
				title: row.title,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			};
		}

		// Create new default conversation
		const conversationId = `conv-${workspaceId}-${Date.now()}`;
		await this.db.query(
			`INSERT INTO conversations
       (id, workspace_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			[conversationId, workspaceId, "Default Conversation"],
		);

		return {
			id: conversationId,
			workspaceId,
			title: "Default Conversation",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}

	// Message management methods
	async saveMessage(message: Omit<Message, "timestamp">): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query(
			`INSERT INTO messages
       (id, conversation_id, content, sender, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
			[
				message.id,
				message.conversationId,
				message.content,
				message.sender,
				message.metadata || null,
			],
		);

		// Update conversation's updated_at timestamp
		await this.db.query(
			`UPDATE conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
			[message.conversationId],
		);
	}

	async getMessages(conversationId: string): Promise<Message[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		const result = await this.db.query(
			`SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY timestamp ASC`,
			[conversationId],
		);

		return result.rows.map((row: any) => ({
			id: row.id,
			conversationId: row.conversation_id,
			content: row.content,
			sender: row.sender as "user" | "agent",
			timestamp: row.timestamp,
			metadata: row.metadata,
		}));
	}

	async deleteConversation(conversationId: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query("DELETE FROM conversations WHERE id = $1", [conversationId]);
	}

	async close(): Promise<void> {
		if (this.disabled || !this.db) return;
		await this.db.close();
	}

	// Custom Claude config management methods
	async saveCustomClaudeConfig(
		config: Omit<CustomClaudeConfig, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query(
			`INSERT INTO custom_claude_configs
       (id, name, base_url, model, small_fast_model, auth_token, disable_nonessential_traffic, binary_path, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (name) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         model = EXCLUDED.model,
         small_fast_model = EXCLUDED.small_fast_model,
         auth_token = EXCLUDED.auth_token,
         disable_nonessential_traffic = EXCLUDED.disable_nonessential_traffic,
         binary_path = EXCLUDED.binary_path,
         updated_at = CURRENT_TIMESTAMP`,
			[
				config.id,
				config.name,
				config.baseUrl || null,
				config.model || null,
				config.smallFastModel || null,
				config.authToken || null,
				config.disableNonessentialTraffic,
				config.binaryPath || null,
			],
		);
	}

	async getCustomClaudeConfigs(): Promise<CustomClaudeConfig[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		const result = await this.db.query(`
      SELECT
        id, name, base_url, model, small_fast_model, auth_token,
        disable_nonessential_traffic, binary_path, created_at, updated_at
      FROM custom_claude_configs
      ORDER BY created_at DESC
    `);

		return result.rows.map((row: any) => ({
			id: row.id,
			name: row.name,
			baseUrl: row.base_url,
			model: row.model,
			smallFastModel: row.small_fast_model,
			authToken: row.auth_token,
			disableNonessentialTraffic: !!row.disable_nonessential_traffic,
			binaryPath: row.binary_path || undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		}));
	}

	async getCustomClaudeConfig(id: string): Promise<CustomClaudeConfig | null> {
		if (this.disabled) return null;
		if (!this.db) throw new Error("Database not initialized");

		const result = await this.db.query(
			`SELECT
         id, name, base_url, model, small_fast_model, auth_token,
         disable_nonessential_traffic, binary_path, created_at, updated_at
       FROM custom_claude_configs
       WHERE id = $1`,
			[id],
		);

		const row = result.rows[0] as any | undefined;
		if (!row) return null;

		return {
			id: row.id,
			name: row.name,
			baseUrl: row.base_url,
			model: row.model,
			smallFastModel: row.small_fast_model,
			authToken: row.auth_token,
			disableNonessentialTraffic: !!row.disable_nonessential_traffic,
			binaryPath: row.binary_path || undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	async deleteCustomClaudeConfig(id: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query("DELETE FROM custom_claude_configs WHERE id = $1", [id]);
	}

	// Setup command management methods
	async saveSetupCommand(
		command: Omit<SetupCommand, "createdAt" | "updatedAt">,
	): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query(
			`INSERT INTO setup_commands
       (id, type, parent_id, commands, enabled, name, description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         parent_id = EXCLUDED.parent_id,
         commands = EXCLUDED.commands,
         enabled = EXCLUDED.enabled,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP`,
			[
				command.id,
				command.type,
				command.parentId,
				JSON.stringify(command.commands),
				command.enabled,
				command.name || null,
				command.description || null,
			],
		);
	}

	async getSetupCommands(
		type?: "global" | "project" | "workspace",
		parentId?: string
	): Promise<SetupCommand[]> {
		if (this.disabled) return [];
		if (!this.db) throw new Error("Database not initialized");

		let query = `
      SELECT
        id, type, parent_id, commands, enabled, name, description,
        created_at, updated_at
      FROM setup_commands
    `;
		const params: any[] = [];
		const conditions: string[] = [];

		if (type && parentId) {
			conditions.push("type = $1 AND parent_id = $2");
			params.push(type, parentId);
		} else if (type) {
			conditions.push("type = $1");
			params.push(type);
		} else if (parentId) {
			conditions.push("parent_id = $1");
			params.push(parentId);
		}

		if (conditions.length > 0) {
			query += " WHERE " + conditions.join(" AND ");
		}

		query += " ORDER BY created_at DESC";

		const result = await this.db.query(query, params);

		return result.rows.map((row: any) => {
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
	}

	async deleteSetupCommand(id: string): Promise<void> {
		if (this.disabled) return;
		if (!this.db) throw new Error("Database not initialized");

		await this.db.query("DELETE FROM setup_commands WHERE id = $1", [id]);
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
