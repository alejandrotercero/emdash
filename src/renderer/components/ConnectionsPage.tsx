import { Cable, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CliProviderStatus } from "../types/connections";
import CliProvidersList, { BASE_CLI_PROVIDERS } from "./CliProvidersList";
import CustomClaudeCard from "./CustomClaudeCard";
import IntegrationsCard from "./IntegrationsCard";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Spinner } from "./ui/spinner";

const createDefaultCliProviders = (): CliProviderStatus[] =>
	BASE_CLI_PROVIDERS.map((provider) => ({ ...provider }));

const mergeCliProviders = (
	incoming: CliProviderStatus[],
): CliProviderStatus[] => {
	const mergedMap = new Map<string, CliProviderStatus>();

	BASE_CLI_PROVIDERS.forEach((provider) => {
		mergedMap.set(provider.id, { ...provider });
	});

	incoming.forEach((provider) => {
		mergedMap.set(provider.id, {
			...(mergedMap.get(provider.id) ?? {}),
			...provider,
		});
	});

	return Array.from(mergedMap.values());
};

interface ConnectionsPageProps {
	onClose: () => void;
}

const ConnectionsPage: React.FC<ConnectionsPageProps> = ({ onClose }) => {
	const [cliProviders, setCliProviders] = useState<CliProviderStatus[]>(() =>
		createDefaultCliProviders(),
	);
	const [cliError, setCliError] = useState<string | null>(null);
	const [cliLoading, setCliLoading] = useState<boolean>(false);

	const fetchCliProviders = useCallback(async () => {
		if (!window?.electronAPI?.getCliProviders) {
			setCliProviders(createDefaultCliProviders());
			setCliError("CLI detection is unavailable in this build.");
			return;
		}

		setCliLoading(true);
		setCliError(null);

		try {
			const result = await window.electronAPI.getCliProviders();
			if (result?.success && Array.isArray(result.providers)) {
				setCliProviders(mergeCliProviders(result.providers));
			} else {
				setCliError(result?.error || "Failed to detect CLI providers.");
			}
		} catch (error) {
			console.error("CLI detection failed:", error);
			setCliError("Unable to detect CLI providers.");
		} finally {
			setCliLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCliProviders();
	}, [fetchCliProviders]);

	const sections = useMemo(() => {
		return [
			{ title: "Integrations", render: () => <IntegrationsCard /> },
			{
				title: "Custom Claude Configurations",
				description:
					"Configure custom Claude instances with different API endpoints, models, or auth tokens.",
				render: () => <CustomClaudeCard />,
			},
			{
				title: "CLI providers",
				action: (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={fetchCliProviders}
						disabled={cliLoading}
						aria-busy={cliLoading}
						aria-label="Refresh CLI providers"
					>
						{cliLoading ? (
							<Spinner size="sm" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
					</Button>
				),
				render: () => (
					<CliProvidersList
						providers={cliProviders}
						isLoading={cliLoading}
						error={cliError}
					/>
				),
			},
		] as const;
	}, [cliProviders, cliLoading, cliError, fetchCliProviders]);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
			<header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
				<div className="flex items-center gap-3">
					<Cable className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
					<div>
						<h2 className="text-lg font-semibold">Connections</h2>
						<p className="mt-0.5 text-sm text-muted-foreground">
							Manage integrations, custom Claude instances, and CLI providers.
						</p>
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					className="h-8 px-3"
				>
					Back to Home
				</Button>
			</header>

			<div className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto max-w-2xl space-y-6">
					{sections.map((section, index) => (
						<React.Fragment key={section.title}>
							{index > 0 ? <Separator className="border-border/60" /> : null}
							<section className="space-y-3">
								<div className="space-y-1">
									<div className="flex items-center justify-between gap-3">
										<h3 className="text-sm font-medium">{section.title}</h3>
										{"action" in section && section.action ? (
											<div>{section.action}</div>
										) : null}
									</div>
									{"description" in section && section.description ? (
										<p className="text-sm text-muted-foreground">
											{section.description}
										</p>
									) : null}
								</div>
								<div className="flex flex-col gap-3">
									{section.render()}
								</div>
							</section>
						</React.Fragment>
					))}
				</div>
			</div>
		</div>
	);
};

export default ConnectionsPage;
