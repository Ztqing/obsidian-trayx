import type { AvailableDesktopRuntime, LoginItemSettings } from "../runtime/electron";

export interface AppLifecycleWindowManager {
	needsDockRestore(): boolean;
	setSkipTaskbar(skipTaskbar: boolean): void;
}

export interface AppLifecycleHooks {
	onActivateRestore(): void;
	onBeforeQuit(): void;
}

export interface AppLifecycleSettings {
	canHideAppIconSafely: boolean;
	hideAppIcon: boolean;
	hideOnLaunch: boolean;
	launchOnStartup: boolean;
	runInBackground: boolean;
}

export interface AppVisibilitySyncTarget {
	syncVisibilityAndRestorePath(hideRequested: boolean, canHideSafely: boolean): void;
}

export class AppLifecycleController {
	private appActivateHandler: (() => void) | null = null;
	private appIconHidden = false;
	private beforeQuitHandler: (() => void) | null = null;

	constructor(
		private readonly runtime: AvailableDesktopRuntime,
		private readonly windowManager: AppLifecycleWindowManager,
		private readonly hooks: AppLifecycleHooks,
	) {}

	applyAppIconVisibility(hidden: boolean): void {
		this.appIconHidden = hidden;

		this.windowManager.setSkipTaskbar(hidden);

		if (this.runtime.platform !== "darwin") {
			return;
		}

		try {
			if (hidden) {
				this.runtime.app.dock?.hide();
			} else {
				this.runtime.app.dock?.show();
			}
		} catch {
			// Ignore unsupported dock APIs.
		}
	}

	applySettings(settings: AppLifecycleSettings): void {
		this.syncVisibilityAndRestorePath(
			settings.hideAppIcon,
			settings.canHideAppIconSafely,
		);
		this.applyLaunchOnStartup(buildLoginItemSettings(settings));
	}

	destroy(): void {
		this.unregisterAppActivationRestorePath();
		this.unregisterBeforeQuitHandler();
		this.applyAppIconVisibility(false);
	}

	getAppIconHidden(): boolean {
		return this.appIconHidden;
	}

	syncVisibilityAndRestorePath(hideRequested: boolean, canHideSafely: boolean): void {
		this.applyAppIconVisibility(hideRequested && canHideSafely);
		this.updateAppActivationRestorePath(this.canUseDockRestore());
	}

	initialize(): void {
		this.registerBeforeQuitHandler();
	}

	private applyLaunchOnStartup(settings: LoginItemSettings): void {
		try {
			this.runtime.app.setLoginItemSettings(settings);
		} catch {
			// Ignore unsupported desktop builds and OS-specific failures.
		}
	}

	private canUseDockRestore(): boolean {
		return this.runtime.platform === "darwin" && !this.appIconHidden;
	}

	private updateAppActivationRestorePath(canUseDockRestore: boolean): void {
		if (canUseDockRestore) {
			this.registerAppActivationRestorePath();
			return;
		}

		this.unregisterAppActivationRestorePath();
	}

	private registerAppActivationRestorePath(): void {
		if (this.appActivateHandler) {
			return;
		}

		const app = this.runtime.app;
		if (!app.on || !app.removeListener) {
			return;
		}

		this.appActivateHandler = () => {
			if (this.windowManager.needsDockRestore()) {
				this.hooks.onActivateRestore();
			}
		};
		app.on("activate", this.appActivateHandler);
	}

	private unregisterAppActivationRestorePath(): void {
		if (!this.appActivateHandler) {
			return;
		}

		this.runtime.app.removeListener?.("activate", this.appActivateHandler);
		this.appActivateHandler = null;
	}

	private registerBeforeQuitHandler(): void {
		if (this.beforeQuitHandler) {
			return;
		}

		const app = this.runtime.app;
		if (!app.on || !app.removeListener) {
			return;
		}

		this.beforeQuitHandler = () => this.hooks.onBeforeQuit();
		app.on("before-quit", this.beforeQuitHandler);
	}

	private unregisterBeforeQuitHandler(): void {
		if (!this.beforeQuitHandler) {
			return;
		}

		this.runtime.app.removeListener?.("before-quit", this.beforeQuitHandler);
		this.beforeQuitHandler = null;
	}
}

export function syncFocusedAppIconVisibility(
	target: AppVisibilitySyncTarget | null,
	hideRequested: boolean,
	canHideSafely: boolean,
): void {
	if (!hideRequested) {
		return;
	}

	target?.syncVisibilityAndRestorePath(hideRequested, canHideSafely);
}

export function buildLoginItemSettings(settings: AppLifecycleSettings): LoginItemSettings {
	return {
		openAtLogin: settings.launchOnStartup,
		openAsHidden:
			settings.launchOnStartup && settings.hideOnLaunch && settings.runInBackground,
	};
}
