import type React from "react";
import { useEffect, useState } from "react";
import ampLogo from "../../assets/images/ampcode.png";
import augmentLogo from "../../assets/images/augmentcode.png";
import charmLogo from "../../assets/images/charm.png";
import claudeLogo from "../../assets/images/claude.png";
import cursorLogo from "../../assets/images/cursorlogo.png";
import factoryLogo from "../../assets/images/factorydroid.png";
import geminiLogo from "../../assets/images/gemini.png";
import copilotLogo from "../../assets/images/ghcopilot.png";
import kimiLogo from "../../assets/images/kimi.png";
import openaiLogo from "../../assets/images/openai.png";
import opencodeLogo from "../../assets/images/opencode.png";
import qwenLogo from "../../assets/images/qwen.png";
import type { Provider } from "../types";

type Props = {
	workspaceName: string;
	provider?: Provider;
};

export const WorkspaceNotice: React.FC<Props> = ({
	workspaceName,
	provider,
}) => {
	const [customClaudeName, setCustomClaudeName] = useState<string | null>(null);

	// Load custom Claude config name if provider is a custom config
	useEffect(() => {
		if (!provider?.startsWith('custom-claude-')) {
			setCustomClaudeName(null);
			return;
		}

		(async () => {
			try {
				const result = await (window as any).electronAPI.getCustomClaudeConfig(provider);
				if (result.success && result.config) {
					setCustomClaudeName(result.config.name);
				}
			} catch (error) {
				console.error("Failed to load custom Claude config name:", error);
			}
		})();
	}, [provider]);

	const providerMap = {
		qwen: { name: "Qwen Code", logo: qwenLogo },
		codex: { name: "Codex", logo: openaiLogo },
		claude: { name: "Claude Code", logo: claudeLogo },
		droid: { name: "Droid", logo: factoryLogo },
		gemini: { name: "Gemini", logo: geminiLogo },
		cursor: { name: "Cursor", logo: cursorLogo },
		copilot: { name: "Copilot", logo: copilotLogo },
		amp: { name: "Amp", logo: ampLogo },
		opencode: { name: "OpenCode", logo: opencodeLogo },
		charm: { name: "Charm", logo: charmLogo },
		auggie: { name: "Auggie", logo: augmentLogo },
		kimi: { name: "Kimi", logo: kimiLogo },
	} as const;

	// Handle custom Claude configs
	const isCustomClaude = provider?.startsWith('custom-claude-');
	const providerInfo = isCustomClaude
		? { name: customClaudeName || "Custom Claude", logo: claudeLogo }
		: provider ? providerMap[provider] : null;

	return (
		<div className="flex items-center justify-between text-sm">
			<div className="flex items-center gap-2">
				<span className="text-xs font-mono uppercase text-muted-foreground">
					Workspace:
				</span>
				<span className="text-xs font-mono text-foreground">
					{workspaceName}
				</span>
			</div>
			{provider && providerInfo && (
				<div className="flex items-center gap-2">
					<span className="text-xs font-mono uppercase text-muted-foreground">
						Provider:
					</span>
					{providerInfo.logo && (
						<img
							src={providerInfo.logo}
							alt={providerInfo.name}
							className="h-4 w-4 rounded-sm object-contain"
						/>
					)}
					<span className="text-xs font-mono text-foreground">
						{providerInfo.name}
					</span>
				</div>
			)}
		</div>
	);
};

export default WorkspaceNotice;
