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
import openaiLogo from "../../assets/images/openai.png";
import opencodeLogo from "../../assets/images/opencode.png";
import qwenLogo from "../../assets/images/qwen.png";
import type { Provider } from "../types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectItemText,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface CustomClaudeConfig {
	id: string;
	name: string;
	baseUrl?: string;
	model?: string;
	smallFastModel?: string;
	authToken?: string;
	disableNonessentialTraffic: boolean;
}

interface ProviderSelectorProps {
	value: Provider;
	onChange: (provider: Provider) => void;
	disabled?: boolean;
	className?: string;
}

const providerConfig = {
	codex: {
		name: "Codex",
		logo: openaiLogo,
		alt: "Codex",
		invertInDark: true,
	},
	qwen: {
		name: "Qwen Code",
		logo: qwenLogo,
		alt: "Qwen Code CLI",
		invertInDark: false,
	},
	claude: {
		name: "Claude Code",
		logo: claudeLogo,
		alt: "Claude Code",
		invertInDark: false,
	},
	droid: {
		name: "Droid",
		logo: factoryLogo,
		alt: "Factory Droid",
		invertInDark: true,
	},
	gemini: {
		name: "Gemini",
		logo: geminiLogo,
		alt: "Gemini CLI",
		invertInDark: false,
	},
	cursor: {
		name: "Cursor",
		logo: cursorLogo,
		alt: "Cursor CLI",
		invertInDark: true,
	},
	copilot: {
		name: "Copilot",
		logo: copilotLogo,
		alt: "GitHub Copilot CLI",
		invertInDark: true,
	},
	amp: {
		name: "Amp",
		logo: ampLogo,
		alt: "Amp CLI",
		invertInDark: false,
	},
	opencode: {
		name: "OpenCode",
		logo: opencodeLogo,
		alt: "OpenCode CLI",
		invertInDark: true,
	},
	charm: {
		name: "Charm",
		logo: charmLogo,
		alt: "Charm CLI",
		invertInDark: false,
	},
	auggie: {
		name: "Auggie",
		logo: augmentLogo,
		alt: "Auggie CLI",
		invertInDark: false,
	},
} as const;

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	className = "",
}) => {
	const [customClaudeConfigs, setCustomClaudeConfigs] = useState<
		CustomClaudeConfig[]
	>([]);

	useEffect(() => {
		const loadCustomConfigs = async () => {
			try {
				const result = await window.electronAPI.getCustomClaudeConfigs();
				if (result.success && result.configs) {
					setCustomClaudeConfigs(result.configs);
				}
			} catch (error) {
				console.error("Failed to load custom Claude configs:", error);
			}
		};
		loadCustomConfigs();
	}, []);

	// Check if the current value is a custom Claude config ID
	const isCustomClaude = customClaudeConfigs.some(
		(config) => config.id === value,
	);
	const currentCustomConfig = customClaudeConfigs.find(
		(config) => config.id === value,
	);
	const currentProvider = providerConfig[value as keyof typeof providerConfig];

	return (
		<div className={`relative block w-[12rem] min-w-0 ${className}`}>
			<Select
				value={value}
				onValueChange={(v) => {
					if (!disabled) {
						onChange(v as Provider);
					}
				}}
				disabled={disabled}
			>
				{disabled ? (
					<TooltipProvider delayDuration={250}>
						<Tooltip>
							<TooltipTrigger asChild>
								<SelectTrigger
									aria-disabled
									className={`h-9 w-full border-none bg-gray-100 dark:bg-gray-700 ${
										disabled ? "cursor-not-allowed opacity-60" : ""
									}`}
								>
									<div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
										{isCustomClaude && currentCustomConfig ? (
											<>
												<img
													src={claudeLogo}
													alt="Custom Claude"
													className="h-4 w-4 shrink-0 rounded-sm"
												/>
												<span className="truncate text-sm">
													{currentCustomConfig.name}
												</span>
											</>
										) : currentProvider ? (
											<>
												<img
													src={currentProvider.logo}
													alt={currentProvider.alt}
													className={`h-4 w-4 shrink-0 rounded-sm ${currentProvider.invertInDark ? "dark:invert" : ""}`}
												/>
												<SelectValue placeholder="Select provider" />
											</>
										) : (
											<SelectValue placeholder="Select provider" />
										)}
									</div>
								</SelectTrigger>
							</TooltipTrigger>
							<TooltipContent>
								<p>Provider is locked for this conversation.</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<SelectTrigger className="h-9 w-full border-none bg-gray-100 dark:bg-gray-700">
						<div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
							{isCustomClaude && currentCustomConfig ? (
								<>
									<img
										src={claudeLogo}
										alt="Custom Claude"
										className="h-4 w-4 shrink-0 rounded-sm"
									/>
									<span className="truncate text-sm">
										{currentCustomConfig.name}
									</span>
								</>
							) : currentProvider ? (
								<>
									<img
										src={currentProvider.logo}
										alt={currentProvider.alt}
										className={`h-4 w-4 shrink-0 rounded-sm ${currentProvider.invertInDark ? "dark:invert" : ""}`}
									/>
									<SelectValue placeholder="Select provider" />
								</>
							) : (
								<SelectValue placeholder="Select provider" />
							)}
						</div>
					</SelectTrigger>
				)}
				<SelectContent side="top">
					{Object.entries(providerConfig).map(([key, config]) => (
						<SelectItem key={key} value={key}>
							<div className="flex items-center gap-2">
								<img
									src={config.logo}
									alt={config.alt}
									className={`h-4 w-4 rounded-sm ${config.invertInDark ? "dark:invert" : ""}`}
								/>
								<SelectItemText>{config.name}</SelectItemText>
							</div>
						</SelectItem>
					))}
					{customClaudeConfigs.length > 0 && (
						<>
							<div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
								Custom Claude
							</div>
							{customClaudeConfigs.map((config) => (
								<SelectItem key={config.id} value={config.id}>
									<div className="flex items-center gap-2">
										<img
											src={claudeLogo}
											alt={config.name}
											className="h-4 w-4 rounded-sm"
										/>
										<SelectItemText>{config.name}</SelectItemText>
									</div>
								</SelectItem>
							))}
						</>
					)}
				</SelectContent>
			</Select>
		</div>
	);
};

export default ProviderSelector;
