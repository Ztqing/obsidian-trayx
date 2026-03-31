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
	private snapshot = createEmptyTraySnapshot();
	private tray: ElectronTray | null = null;

	constructor(
		private readonly runtime: AvailableDesktopRuntime,
		private readonly pluginDir: string,
	) {}

	refresh(options: TrayRefreshOptions): TrayRefreshResult {
		this.destroy();
		if (!options.enabled || !options.isOwner) {
			return { ok: true };
		}

		try {
			const { snapshot, trayInput } = buildTrayImage(this.runtime, this.pluginDir);
			this.snapshot = this.fromAssetSnapshot(snapshot);

			const menu = this.runtime.Menu.buildFromTemplate(
				createTrayMenuTemplateForLocale(options.actions),
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
			this.snapshot = {
				...this.fromAssetSnapshot(snapshot),
				trayBounds: tray.getBounds?.() ?? null,
				trayCreated: true,
				trayObjectCreated: true,
			};

			return { ok: true };
		} catch (error) {
			this.destroyTrayObject();
			if (error instanceof TrayImageError) {
				this.snapshot = this.fromAssetSnapshot(error.snapshot);
			}

			return { error: toError(error), ok: false };
		}
	}

	destroy(): void {
		this.destroyTrayObject();
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
			...snapshot,
			trayBounds: null,
			trayCreated: false,
			trayObjectCreated: false,
		};
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
