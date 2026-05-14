import { Settings2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import ThemeCard from "./ThemeCard";
import { Button } from "./ui/button";
import VersionCard from "./VersionCard";

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type SettingsTab = "general";

const ORDERED_TABS: SettingsTab[] = ["general"];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
	const shouldReduceMotion = useReducedMotion();

	const tabDetails = useMemo(() => {
		return {
			general: {
				icon: Settings2,
				label: "Settings",
				title: "Settings",
				description: "",
				sections: [
					{ title: "Theme", render: () => <ThemeCard /> },
					{ title: "Version", render: () => <VersionCard /> },
				],
			},
		} as const;
	}, []);

	const activeTabDetails = tabDetails["general"];

	const renderContent = () => {
		const { sections } = activeTabDetails;

		if (!sections.length) {
			return null;
		}

		return (
			<div className="space-y-6">
				{sections.map((section, index) => (
					<React.Fragment key={section.title}>
						<section className="space-y-3">
							<div className="space-y-1">
								<h3 className="text-sm font-medium">{section.title}</h3>
							</div>
							<div className="flex flex-col gap-3">
								{section.render()}
							</div>
						</section>
					</React.Fragment>
				))}
			</div>
		);
	};

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<motion.div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm"
					initial={shouldReduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
					transition={
						shouldReduceMotion
							? { duration: 0 }
							: { duration: 0.12, ease: "easeOut" }
					}
					onClick={onClose}
				>
					<motion.div
						onClick={(event) => event.stopPropagation()}
						initial={
							shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }
						}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={
							shouldReduceMotion
								? { opacity: 1, y: 0, scale: 1 }
								: { opacity: 0, y: 6, scale: 0.995 }
						}
						transition={
							shouldReduceMotion
								? { duration: 0 }
								: { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
						}
						className="mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl"
					>
						<div className="flex min-h-[300px] max-h-[80vh]">
							<div className="flex flex-1 flex-col">
								<header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
									<div>
										<h2 className="text-lg font-semibold">
											{activeTabDetails.title}
										</h2>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={onClose}
										className="h-8 w-8"
										aria-label="Close settings"
									>
										<X className="h-4 w-4" />
									</Button>
								</header>

								<div className="flex-1 overflow-y-auto px-6 py-6">
									{renderContent()}
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
};

export default SettingsModal;
