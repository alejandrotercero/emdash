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
import type { CliProviderStatus } from "../types/connections";
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
	detectedProviders?: CliProviderStatus[];
}

const providerConfig = {
	codex:    { name: "Codex",      logo: openaiLogo,   alt: "Codex",              invertInDark: true,  accent: "bg-emerald-500" },
	claude:   { name: "Claude Code",logo: claudeLogo,   alt: "Claude Code",        invertInDark: false, accent: "bg-orange-400"  },
	qwen:     { name: "Qwen Code",  logo: qwenLogo,     alt: "Qwen Code CLI",      invertInDark: false, accent: "bg-violet-500"  },
	gemini:   { name: "Gemini",     logo: geminiLogo,   alt: "Gemini CLI",         invertInDark: false, accent: "bg-sky-400"     },
	copilot:  { name: "Copilot",    logo: copilotLogo,  alt: "GitHub Copilot CLI", invertInDark: true,  accent: "bg-slate-400"   },
	kimi:     { name: "Kimi",       logo: kimiLogo,     alt: "Kimi CLI",           invertInDark: false, accent: "bg-blue-500"    },
	auggie:   { name: "Auggie",     logo: augmentLogo,  alt: "Auggie CLI",         invertInDark: false, accent: "bg-cyan-500"    },
	amp:      { name: "Amp",        logo: ampLogo,      alt: "Amp CLI",            invertInDark: false, accent: "bg-amber-400"   },
	opencode: { name: "OpenCode",   logo: opencodeLogo, alt: "OpenCode CLI",       invertInDark: true,  accent: "bg-emerald-400" },
	charm:    { name: "Charm",      logo: charmLogo,    alt: "Charm CLI",          invertInDark: false, accent: "bg-pink-400"    },
	droid:    { name: "Droid",      logo: factoryLogo,  alt: "Factory Droid",      invertInDark: true,  accent: "bg-zinc-400"    },
	cursor:   { name: "Cursor",     logo: cursorLogo,   alt: "Cursor CLI",         invertInDark: true,  accent: "bg-zinc-400"    },
} as const;

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	className = "",
	detectedProviders,
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

	// Filter providers to only show detected ones
	const detectedIds = new Set(
		(detectedProviders ?? [])
			.filter((p) => p.status === "connected")
			.map((p) => p.id),
	);
	const showAll = !detectedProviders || detectedProviders.length === 0;
	const visibleProviders = Object.entries(providerConfig).filter(
		([key]) => showAll || detectedIds.has(key),
	);

	// Check if the current value is a custom Claude config ID
	const isCustomClaude = customClaudeConfigs.some(
		(config) => config.id === value,
	);
	const currentCustomConfig = customClaudeConfigs.find(
		(config) => config.id === value,
	);
	const currentProvider = providerConfig[value as keyof typeof providerConfig];

	const triggerContent = (
		<div className="flex w-full min-w-0 items-center gap-2 overflow-hidden">
			{isCustomClaude && currentCustomConfig ? (
				<>
					<img
						src={claudeLogo}
						alt="Custom Claude"
						className="h-4 w-4 shrink-0 rounded-sm"
					/>
					<span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden="true" />
					<span className="truncate text-sm">{currentCustomConfig.name}</span>
				</>
			) : currentProvider ? (
				<>
					<img
						src={currentProvider.logo}
						alt={currentProvider.alt}
						className={`h-4 w-4 shrink-0 rounded-sm ${currentProvider.invertInDark ? "dark:invert" : ""}`}
					/>
					<span className={`h-2 w-2 shrink-0 rounded-full ${currentProvider.accent}`} aria-hidden="true" />
					<SelectValue placeholder="Select provider" />
				</>
			) : (
				<SelectValue placeholder="Select provider" />
			)}
		</div>
	);

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
									className="h-9 w-full cursor-not-allowed border-none bg-muted opacity-60"
								>
									{triggerContent}
								</SelectTrigger>
							</TooltipTrigger>
							<TooltipContent>
								<p>Provider is locked for this conversation.</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<SelectTrigger className="h-9 w-full border-none bg-muted">
						{triggerContent}
					</SelectTrigger>
				)}
				<SelectContent side="top">
					{visibleProviders.map(([key, config]) => (
						<SelectItem key={key} value={key}>
							<div className="flex items-center gap-2">
								<img
									src={config.logo}
									alt={config.alt}
									className={`h-4 w-4 rounded-sm ${config.invertInDark ? "dark:invert" : ""}`}
								/>
								<span className={`h-2 w-2 shrink-0 rounded-full ${config.accent}`} aria-hidden="true" />
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
										<span className="h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden="true" />
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
