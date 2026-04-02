import { existsSync, statSync } from "fs";
import * as path from "path";

import type {
	AvailableDesktopRuntime,
	ElectronTray,
	MenuItemConstructorOptions,
} from "../runtime/electron";
import { getCurrentLocale, getLocalizedStrings, type SupportedLocale } from "../i18n";
import { TRAY_MENU_ORDER, type TrayMenuKey } from "../ui-metadata";
import {
	type TrayAssetSnapshot,
	TrayImageError,
	buildTrayImage,
	createEmptyTrayAssetSnapshot,
} from "./assets";

export interface TrayActions {
	closeVault(): void;
	hideVault(): void;
	relaunchApp(): void;
	showVault(): void;
	toggleVaultVisibility(): void;
}

export interface TrayRefreshOptions {
	actions: TrayActions;
	enabled: boolean;
	isOwner: boolean;
	toolTip: string;
}

export interface TraySnapshot extends TrayAssetSnapshot {
	lastRefreshAttempted: boolean;
	lastTrayError: string | null;
	trayBounds: { height: number; width: number; x: number; y: number } | null;
	trayCreated: boolean;
	trayObjectCreated: boolean;
}

export interface TrayRefreshResult {
	error?: Error;
	ok: boolean;
}

export function createEmptyTraySnapshot(): TraySnapshot {
	return {
		lastRefreshAttempted: false,
		lastTrayError: null,
		...createEmptyTrayAssetSnapshot(),
		trayBounds: null,
		trayCreated: false,
		trayObjectCreated: false,
	};
}

export function createTrayMenuTemplate(actions: TrayActions): MenuItemConstructorOptions[] {
	return createTrayMenuTemplateForLocale(actions, getCurrentLocale());
}

export function createTrayMenuTemplateForLocale(
	actions: TrayActions,
	locale: SupportedLocale = getCurrentLocale(),
): MenuItemConstructorOptions[] {
	const labels = getLocalizedStrings(locale).trayMenu;

	return [
		...TRAY_MENU_ORDER.slice(0, 2).map((key) => createTrayMenuItem(key, labels[key], actions)),
		{ type: "separator" },
		...TRAY_MENU_ORDER.slice(2).map((key) => createTrayMenuItem(key, labels[key], actions)),
	];
}

export class TrayService {
	private lastRefreshSignature: string | null = null;
	private snapshot = createEmptyTraySnapshot();
	private tray: ElectronTray | null = null;

	constructor(
		private readonly runtime: AvailableDesktopRuntime,
		private readonly pluginDir: string,
	) {}

	refresh(options: TrayRefreshOptions): TrayRefreshResult {
		const locale = getCurrentLocale();
		const signature = this.buildRefreshSignature(options, locale);

		if (!options.enabled || !options.isOwner) {
			this.destroy();
			return { ok: true };
		}

		if (this.tray && this.lastRefreshSignature === signature) {
			this.snapshot = {
				...this.snapshot,
				lastRefreshAttempted: true,
				lastTrayError: null,
				trayBounds: this.tray.getBounds?.() ?? this.snapshot.trayBounds,
				trayCreated: true,
				trayObjectCreated: true,
			};
			return { ok: true };
		}

		this.destroy();

		try {
			const { snapshot, trayInput } = buildTrayImage(this.runtime, this.pluginDir);
			this.snapshot = {
				...this.fromAssetSnapshot(snapshot),
				lastRefreshAttempted: true,
			};

			const menu = this.runtime.Menu.buildFromTemplate(
				createTrayMenuTemplateForLocale(options.actions, locale),
			);
			const tray = new this.runtime.Tray(trayInput);
			const isMac = this.runtime.platform === "darwin";

			tray.setToolTip(options.toolTip);
			if (!isMac) {
				tray.setContextMenu?.(menu);
			}
			tray.on("click", () => {
				if (isMac) {
					options.actions.showVault();
					return;
				}

				options.actions.toggleVaultVisibility();
			});
			tray.on("right-click", () => tray.popUpContextMenu(menu));

			this.tray = tray;
			this.lastRefreshSignature = signature;
			this.snapshot = {
				...this.fromAssetSnapshot(snapshot),
				lastRefreshAttempted: true,
				lastTrayError: null,
				trayBounds: tray.getBounds?.() ?? null,
				trayCreated: true,
				trayObjectCreated: true,
			};

			return { ok: true };
		} catch (error) {
			const trayError = toError(error);
			this.destroyTrayObject();
			if (error instanceof TrayImageError) {
				this.snapshot = {
					...this.fromAssetSnapshot(error.snapshot),
					lastRefreshAttempted: true,
					lastTrayError: trayError.message,
				};
			} else {
				this.snapshot = {
					...this.snapshot,
					lastRefreshAttempted: true,
					lastTrayError: trayError.message,
				};
			}

			return { error: trayError, ok: false };
		}
	}

	destroy(): void {
		this.destroyTrayObject();
		this.lastRefreshSignature = null;
		this.snapshot = createEmptyTraySnapshot();
	}

	getSnapshot(): TraySnapshot {
		return {
			...this.snapshot,
			trayBounds: this.tray?.getBounds?.() ?? this.snapshot.trayBounds,
			trayObjectCreated: this.tray !== null,
		};
	}

	private destroyTrayObject(): void {
		this.tray?.destroy();
		this.tray = null;
		this.snapshot = {
			...this.snapshot,
			trayBounds: null,
			trayCreated: false,
			trayObjectCreated: false,
		};
	}

	private fromAssetSnapshot(snapshot: TrayAssetSnapshot): TraySnapshot {
		return {
			lastRefreshAttempted: false,
			lastTrayError: null,
			...snapshot,
			trayBounds: null,
			trayCreated: false,
			trayObjectCreated: false,
		};
	}

	private buildRefreshSignature(
		options: TrayRefreshOptions,
		locale: SupportedLocale,
	): string {
		return JSON.stringify({
			enabled: options.enabled,
			iconAsset: this.getTrayAssetSignature(),
			isOwner: options.isOwner,
			locale,
			toolTip: options.toolTip,
		});
	}

	private getTrayAssetSignature(): string {
		if (this.runtime.platform !== "darwin") {
			return "data-url";
		}

		const assetPath = path.join(this.pluginDir, "trayTemplate.png");
		if (!existsSync(assetPath)) {
			return `${assetPath}:missing`;
		}

		try {
			const stats = statSync(assetPath);
			return `${assetPath}:${stats.size}:${stats.mtimeMs}`;
		} catch {
			return `${assetPath}:unreadable`;
		}
	}
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

function createTrayMenuItem(
	key: TrayMenuKey,
	label: string,
	actions: TrayActions,
): MenuItemConstructorOptions {
	const handlerByKey: Record<TrayMenuKey, () => void> = {
		closeVault: () => actions.closeVault(),
		hideVault: () => actions.hideVault(),
		relaunchApp: () => actions.relaunchApp(),
		showVault: () => actions.showVault(),
	};

	return {
		click: handlerByKey[key],
		label,
		type: "normal",
	};
}
