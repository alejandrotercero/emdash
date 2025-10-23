import { Plus, Save, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

interface CustomClaudeConfig {
	id: string;
	name: string;
	baseUrl?: string;
	model?: string;
	smallFastModel?: string;
	authToken?: string;
	disableNonessentialTraffic: boolean;
}

const CustomClaudeCard: React.FC = () => {
	const [configs, setConfigs] = useState<CustomClaudeConfig[]>([]);
	const [isAdding, setIsAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState<Partial<CustomClaudeConfig>>({
		name: "",
		baseUrl: "",
		model: "",
		smallFastModel: "",
		authToken: "",
		disableNonessentialTraffic: true,
	});

	const loadConfigs = async () => {
		try {
			const result = await window.electronAPI.getCustomClaudeConfigs();
			if (result.success && result.configs) {
				setConfigs(result.configs);
			}
		} catch (error) {
			console.error("Failed to load custom Claude configs:", error);
		}
	};

	useEffect(() => {
		loadConfigs();
	}, []);

	const handleSave = async () => {
		if (!formData.name?.trim()) {
			alert("Name is required");
			return;
		}

		try {
			const config = {
				id: editingId || `custom-claude-${Date.now()}`,
				name: formData.name,
				baseUrl: formData.baseUrl || undefined,
				model: formData.model || undefined,
				smallFastModel: formData.smallFastModel || undefined,
				authToken: formData.authToken || undefined,
				disableNonessentialTraffic: formData.disableNonessentialTraffic ?? true,
			};

			const result = await window.electronAPI.saveCustomClaudeConfig(config);
			if (result.success) {
				await loadConfigs();
				handleCancel();
			} else {
				alert(`Failed to save: ${result.error}`);
			}
		} catch (error) {
			console.error("Failed to save custom Claude config:", error);
			alert("Failed to save configuration");
		}
	};

	const handleDelete = async (id: string) => {
		if (
			!confirm(
				"Are you sure you want to delete this custom Claude configuration?",
			)
		) {
			return;
		}

		try {
			const result = await window.electronAPI.deleteCustomClaudeConfig(id);
			if (result.success) {
				await loadConfigs();
			} else {
				alert(`Failed to delete: ${result.error}`);
			}
		} catch (error) {
			console.error("Failed to delete custom Claude config:", error);
			alert("Failed to delete configuration");
		}
	};

	const handleEdit = (config: CustomClaudeConfig) => {
		setEditingId(config.id);
		setFormData({
			name: config.name,
			baseUrl: config.baseUrl || "",
			model: config.model || "",
			smallFastModel: config.smallFastModel || "",
			authToken: config.authToken || "",
			disableNonessentialTraffic: config.disableNonessentialTraffic,
		});
		setIsAdding(true);
	};

	const handleCancel = () => {
		setIsAdding(false);
		setEditingId(null);
		setFormData({
			name: "",
			baseUrl: "",
			model: "",
			smallFastModel: "",
			authToken: "",
			disableNonessentialTraffic: true,
		});
	};

	return (
		<div className="space-y-3">
			{configs.length === 0 && !isAdding && (
				<p className="text-sm text-muted-foreground">
					No custom Claude configurations. Add one to use custom API endpoints
					or models.
				</p>
			)}

			{configs.map((config) => (
				<Card key={config.id} className="p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 space-y-1">
							<h4 className="text-sm font-medium">{config.name}</h4>
							<div className="space-y-0.5 text-xs text-muted-foreground">
								{config.baseUrl && (
									<div>
										<span className="font-medium">Base URL:</span>{" "}
										{config.baseUrl}
									</div>
								)}
								{config.model && (
									<div>
										<span className="font-medium">Model:</span> {config.model}
									</div>
								)}
								{config.smallFastModel && (
									<div>
										<span className="font-medium">Small/Fast Model:</span>{" "}
										{config.smallFastModel}
									</div>
								)}
								{config.authToken && (
									<div>
										<span className="font-medium">Auth Token:</span> ••••••••
									</div>
								)}
								{config.disableNonessentialTraffic && (
									<div className="text-xs text-muted-foreground">
										Non-essential traffic disabled
									</div>
								)}
							</div>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => handleEdit(config)}
								className="h-8 px-2"
							>
								Edit
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => handleDelete(config.id)}
								className="h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</Card>
			))}

			{isAdding ? (
				<Card className="p-4">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium">
								{editingId ? "Edit" : "Add"} Custom Claude Configuration
							</h4>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCancel}
								className="h-8 w-8 p-0"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						<div className="space-y-3">
							<div>
								<label
									htmlFor="config-name"
									className="text-xs font-medium text-muted-foreground"
								>
									Name *
								</label>
								<Input
									id="config-name"
									type="text"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									placeholder="My Custom Claude"
									className="mt-1"
								/>
							</div>

							<div>
								<label
									htmlFor="config-base-url"
									className="text-xs font-medium text-muted-foreground"
								>
									Base URL (ANTHROPIC_BASE_URL)
								</label>
								<Input
									id="config-base-url"
									type="text"
									value={formData.baseUrl}
									onChange={(e) =>
										setFormData({ ...formData, baseUrl: e.target.value })
									}
									placeholder="https://api.example.com"
									className="mt-1"
								/>
							</div>

							<div>
								<label
									htmlFor="config-model"
									className="text-xs font-medium text-muted-foreground"
								>
									Model (ANTHROPIC_MODEL)
								</label>
								<Input
									id="config-model"
									type="text"
									value={formData.model}
									onChange={(e) =>
										setFormData({ ...formData, model: e.target.value })
									}
									placeholder="claude-3-5-sonnet-20250219"
									className="mt-1"
								/>
							</div>

							<div>
								<label
									htmlFor="config-small-model"
									className="text-xs font-medium text-muted-foreground"
								>
									Small/Fast Model (ANTHROPIC_SMALL_FAST_MODEL)
								</label>
								<Input
									id="config-small-model"
									type="text"
									value={formData.smallFastModel}
									onChange={(e) =>
										setFormData({ ...formData, smallFastModel: e.target.value })
									}
									placeholder="claude-3-5-haiku-20241022"
									className="mt-1"
								/>
							</div>

							<div>
								<label
									htmlFor="config-auth-token"
									className="text-xs font-medium text-muted-foreground"
								>
									Auth Token (ANTHROPIC_AUTH_TOKEN)
								</label>
								<Input
									id="config-auth-token"
									type="password"
									value={formData.authToken}
									onChange={(e) =>
										setFormData({ ...formData, authToken: e.target.value })
									}
									placeholder="sk-ant-..."
									className="mt-1"
								/>
							</div>

							<div className="flex items-center justify-between">
								<label
									htmlFor="config-disable-traffic"
									className="text-sm font-medium"
								>
									Disable Non-Essential Traffic
								</label>
								<Switch
									id="config-disable-traffic"
									checked={formData.disableNonessentialTraffic ?? true}
									onCheckedChange={(checked) =>
										setFormData({
											...formData,
											disableNonessentialTraffic: checked,
										})
									}
								/>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCancel}
							>
								Cancel
							</Button>
							<Button type="button" size="sm" onClick={handleSave}>
								<Save className="mr-2 h-4 w-4" />
								Save
							</Button>
						</div>
					</div>
				</Card>
			) : (
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setIsAdding(true)}
					className="w-full"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Custom Claude Configuration
				</Button>
			)}
		</div>
	);
};

export default CustomClaudeCard;
