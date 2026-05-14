import React from 'react';

type Props = {
  showGithubRequirement: boolean;
  needsGhInstall: boolean;
  needsGhAuth: boolean;
  showAgentRequirement: boolean;
};

const Cmd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono-custom text-xs text-foreground">
    {children}
  </code>
);

const RequirementsNotice: React.FC<Props> = ({
  showGithubRequirement,
  needsGhInstall,
  needsGhAuth,
  showAgentRequirement,
}) => {
  return (
    <div className="mx-auto max-w-2xl space-y-4 text-sm text-muted-foreground">
      {showGithubRequirement && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Setup required
          </p>
          {needsGhInstall ? (
            <p className="text-xs">
              Install GitHub CLI: <Cmd>brew install gh</Cmd>
            </p>
          ) : (
            needsGhAuth && (
              <p className="text-xs">
                Authenticate GitHub CLI: <Cmd>gh auth login</Cmd>
              </p>
            )
          )}
        </div>
      )}

      {showAgentRequirement && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Install an agent CLI
          </p>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="font-medium text-foreground">Codex CLI</span>
              <div className="mt-0.5 text-muted-foreground">
                <Cmd>npm install -g @openai/codex</Cmd>
                {' · '}
                <Cmd>codex auth login</Cmd>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Claude Code CLI</span>
              <div className="mt-0.5 text-muted-foreground">
                <Cmd>npm install -g @anthropic-ai/claude-code</Cmd>
                {' · then '}
                <Cmd>claude</Cmd>
                {' → '}
                <Cmd>/login</Cmd>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Factory CLI (Droid)</span>
              <div className="mt-0.5">
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    (window as any).electronAPI.openExternal?.(
                      'https://docs.factory.ai/cli/getting-started/quickstart'
                    )
                  }
                >
                  docs.factory.ai/cli/getting-started/quickstart
                </button>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Gemini CLI</span>
              <div className="mt-0.5">
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    (window as any).electronAPI.openExternal?.(
                      'https://github.com/google-gemini/gemini-cli'
                    )
                  }
                >
                  github.com/google-gemini/gemini-cli
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequirementsNotice;
