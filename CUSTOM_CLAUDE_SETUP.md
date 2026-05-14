# Custom Claude Configurations - Setup Guide

This guide explains how to set up and use custom Claude configurations in NVCode, allowing you to run the Claude Code CLI with different API endpoints, models, or authentication tokens.

## Overview

Custom Claude configurations enable you to:
- Use custom API endpoints (e.g., alternative Claude-compatible APIs like GLM, proxy servers)
- Specify different models for different tasks (e.g., `glm-4.6`, `claude-sonnet-4`)
- Use separate authentication tokens for different projects
- Disable non-essential traffic for privacy or performance
- Run multiple Claude CLI instances simultaneously with different settings

**Important**: Custom Claude configs work as **interactive terminals** running the `claude` CLI with your custom environment variables, just like the regular Claude provider. They are NOT chat interfaces - you interact with the Claude CLI directly in the terminal.

## Environment Variables Supported

Each custom Claude configuration can set the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_BASE_URL` | Custom API endpoint URL | `https://api.example.com` |
| `ANTHROPIC_MODEL` | Main model to use | `claude-3-5-sonnet-20250219` |
| `ANTHROPIC_SMALL_FAST_MODEL` | Model for quick operations | `claude-3-5-haiku-20241022` |
| `ANTHROPIC_AUTH_TOKEN` | Authentication token | `sk-ant-...` |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Disable telemetry/analytics | `1` (enabled by default) |

## Setup Instructions

### 1. Access Settings

1. Click the **Settings** icon in the top-right corner of NVCode
2. Navigate to the **Connections** tab
3. Scroll to the **Custom Claude Configurations** section

### 2. Create a New Configuration

1. Click the **"Add Custom Claude Configuration"** button
2. Fill in the configuration form:

#### Required Field
- **Name**: A descriptive name for your configuration (e.g., "Production API", "Development Server", "Custom Model")

#### Optional Fields
- **Base URL (ANTHROPIC_BASE_URL)**:
  - Custom API endpoint
  - Example: `https://api.mycompany.com`
  - Leave empty to use the default Anthropic API

- **Model (ANTHROPIC_MODEL)**:
  - Main model identifier
  - Example: `claude-3-5-sonnet-20250219`
  - Leave empty to use the CLI's default

- **Small/Fast Model (ANTHROPIC_SMALL_FAST_MODEL)**:
  - Model for quick operations
  - Example: `claude-3-5-haiku-20241022`
  - Leave empty to use the CLI's default

- **Auth Token (ANTHROPIC_AUTH_TOKEN)**:
  - API authentication token
  - Example: `sk-ant-api03-...`
  - Leave empty to use the CLI's default authentication

- **Disable Non-Essential Traffic**:
  - Toggle to enable/disable telemetry
  - Enabled by default for privacy

3. Click **Save** to create the configuration

### 3. Using Custom Configurations

1. Open a workspace or create a new one
2. Click the **provider selector** dropdown (appears in the left sidebar or workspace view)
3. Your custom Claude configurations will appear at the bottom under **"Custom Claude"**
4. Select your desired custom configuration
5. **A terminal will open** running the interactive Claude CLI with your custom environment variables
6. Use the Claude CLI normally:
   - Type your messages directly
   - Use `/help` to see available commands
   - Your custom API endpoint, model, and auth token are active in this session

### 4. Verifying Your Custom Environment Variables

To verify your custom environment variables are working:

1. **Check the console logs** (View → Toggle Developer Tools):
   ```
   [ChatInterface] Custom Claude env loaded: { ANTHROPIC_BASE_URL: '...', ANTHROPIC_MODEL: '...', ... }
   [ptyIpc] Starting PTY with custom env: { ... }
   [ptyManager] Spawning shell with custom env vars: { ... }
   ```

2. **Check in the terminal** - Once the Claude terminal opens, type:
   ```bash
   env | grep ANTHROPIC
   ```
   You should see your custom values:
   ```
   ANTHROPIC_BASE_URL=https://api.example.com
   ANTHROPIC_MODEL=glm-4.6
   ANTHROPIC_AUTH_TOKEN=your-token-here
   ...
   ```

3. **Test with Claude** - Claude will automatically use your custom settings. Check Claude's behavior/responses to verify the correct model/endpoint is being used.

## Example Use Cases

### Use Case 1: Using GLM Models via Claude Code

```
Name: GLM 4.6
Base URL: https://api.z.ai/api/anthropic
Model: glm-4.6
Small/Fast Model: glm-4.5-air
Auth Token: your-glm-api-token
Disable Non-Essential Traffic: ✓
```

This allows you to use GLM models through the Claude CLI interface!

### Use Case 2: Self-Hosted Claude Instance

```
Name: My Self-Hosted Claude
Base URL: https://claude.mycompany.internal
Auth Token: my-internal-token-123
Model: claude-3-5-sonnet-20250219
```

### Use Case 3: Testing Different Claude Models

```
Name: Claude Haiku
Model: claude-3-5-haiku-20241022
Small/Fast Model: claude-3-5-haiku-20241022
Disable Non-Essential Traffic: ✓
```

```
Name: Claude Opus
Model: claude-3-opus-20240229
Small/Fast Model: claude-3-5-haiku-20241022
```

### Use Case 4: Development vs Production

**Development Configuration:**
```
Name: Dev Environment
Base URL: https://dev-api.example.com
Auth Token: dev-token-xyz
Disable Non-Essential Traffic: ✓
```

**Production Configuration:**
```
Name: Production
Base URL: https://api.example.com
Auth Token: prod-token-abc
Disable Non-Essential Traffic: ✓
```

## Managing Configurations

### Edit a Configuration
1. Click the **Edit** button next to the configuration
2. Modify the fields as needed
3. Click **Save**

### Delete a Configuration
1. Click the **trash icon** next to the configuration
2. Confirm the deletion
3. The configuration will be removed from the database

**Note**: Deleting a configuration does not affect existing workspaces using it, but you won't be able to select it for new chats.

## Technical Details

### How It Works

1. **Storage**: Configurations are stored in NVCode's local database (`custom_claude_configs` table)
2. **Terminal Mode**: Custom Claude configs work as terminal-only providers (like regular Claude, Codex, Droid, etc.)
3. **Environment Injection**: When the terminal opens, NVCode loads your config from the database and injects the environment variables into the PTY (pseudo-terminal) session
4. **Process Isolation**: Each workspace runs its own Claude CLI process with its own environment in an interactive terminal

### Database Schema

```sql
CREATE TABLE custom_claude_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_url TEXT,
  model TEXT,
  small_fast_model TEXT,
  auth_token TEXT,
  disable_nonessential_traffic BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Code Flow

1. User selects custom configuration from provider dropdown
2. `ChatInterface` detects custom config ID (starts with `custom-claude-`)
3. `ChatInterface` loads the config from database via `getCustomClaudeConfig()`
4. Environment variables are built from the config:
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_MODEL`
   - `ANTHROPIC_SMALL_FAST_MODEL`
   - `ANTHROPIC_AUTH_TOKEN`
   - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
5. `TerminalPane` component waits for env to load (shows "Loading configuration...")
6. Once loaded, `TerminalPane` spawns a PTY with:
   - `shell: 'claude'` (the Claude CLI)
   - `env: { ...customEnvironmentVariables }`
7. The `claude` CLI runs interactively with your custom settings
8. Your custom API endpoint, model, and token are active in the terminal session

## Security Considerations

### Token Storage
- Auth tokens are stored in the local SQLite database
- The database is stored in your user data directory:
  - **macOS**: `~/Library/Application Support/nvcode/nvcode.db`
  - **Windows**: `%APPDATA%/nvcode/nvcode.db`
  - **Linux**: `~/.config/nvcode/nvcode.db`

### Best Practices
1. **Never share your database file** - it contains authentication tokens
2. **Use environment-specific tokens** - don't use production tokens in development configs
3. **Enable "Disable Non-Essential Traffic"** for privacy
4. **Rotate tokens regularly** if using custom auth tokens
5. **Use HTTPS** for custom base URLs to ensure encrypted communication

## Troubleshooting

### Configuration not appearing in dropdown
- Ensure the configuration was saved successfully
- Check the browser console for errors
- Refresh the app

### Authentication errors
- Verify your auth token is correct
- Check that the base URL is accessible
- Ensure the Claude CLI is installed: `claude --version`

### Environment variables not being applied
- Check the console logs in developer tools for:
  - `[ChatInterface] Custom Claude env loaded: {...}` - confirms config was loaded
  - `[ptyIpc] Starting PTY with custom env: {...}` - confirms env was passed to PTY
  - `[ptyManager] Spawning shell with custom env vars: {...}` - confirms env was injected
- Verify the configuration exists in the database
- Check `hasEnv: true` in the `pty:start OK` log
- In the terminal, run `env | grep ANTHROPIC` to see the actual environment variables

### Terminal shows "Loading configuration..."
- This is normal and should only appear for 1-2 seconds
- If it persists, check the console for errors loading the config
- Verify the custom config ID exists in the database

### Terminal not opening or black screen
- Check that the Claude CLI is installed: `claude --version`
- Verify the workspace path is valid
- Look for errors in the developer console (`Cmd/Ctrl + Shift + I`)
- Check `shell: 'claude'` appears in the `pty:start OK` log

## Limitations

1. **Terminal Only**: Custom configurations work as interactive terminals, not chat interfaces
2. **Requires Claude CLI**: You must have the Claude CLI installed for custom configs to work
3. **One Config Per Workspace**: Each workspace uses one configuration at a time (but you can run multiple workspaces with different configs)
4. **No Hot Reloading**: Changing a config requires closing and reopening the workspace
5. **Provider Lock**: Once a terminal starts with a provider, it stays locked to that provider until the terminal is closed

## FAQ

**Q: Can I use multiple custom configurations simultaneously?**
A: Yes! Each workspace can use a different custom configuration. Open multiple workspaces with different configs running in parallel.

**Q: What happens if I delete a configuration that's being used?**
A: Existing terminals will continue to work, but you won't be able to create new workspaces with that configuration.

**Q: Can I export/import configurations?**
A: Not currently supported. Configurations are stored in the local SQLite database.

**Q: Do custom configurations work offline?**
A: If your custom base URL is accessible offline (e.g., localhost or LAN server), yes. Otherwise, you need internet connectivity.

**Q: Can I use custom configurations with other providers (Codex, Gemini, etc.)?**
A: No, custom configurations are currently only supported for Claude Code CLI. However, you can use any Claude-compatible API (like GLM models) that implements the Anthropic API format.

**Q: Why does it open a terminal instead of a chat interface?**
A: Custom Claude configs work exactly like the regular Claude provider - as interactive terminals running the Claude CLI. This is by design, allowing full access to Claude CLI features while injecting your custom environment variables.

**Q: Can I use models from other providers (like GLM)?**
A: Yes! As long as the API is compatible with the Anthropic/Claude API format, you can use any model. Just set the appropriate base URL, model name, and auth token.

## Support

For issues or questions:
- GitHub Issues: https://github.com/nonvariable/nvcode/issues
- Discord: https://discord.gg/meqK3A5b

## Future Enhancements

Potential future features:
- [ ] Import/export configurations
- [ ] Configuration templates
- [ ] Custom configurations for other providers
- [ ] Configuration validation before saving
- [ ] Usage analytics per configuration
- [ ] Shared team configurations
