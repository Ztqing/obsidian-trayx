import type { App } from "obsidian";

import { formatRuntimeDiagnosticsSummary } from "./diagnostics/runtime-diagnostics";
import { getRuntimeFailureReason, getTrayCreationFailureNotice } from "./i18n";
import {
	AppLifecycleController,
	type AppLifecycleHooks,
	type AppLifecycleSettings,
	type AppLifecycleWindowManager,
	syncFocusedAppIconVisibility,
} from "./lifecycle/app-lifecycle";
import {
	BackgroundSessionController,
	type BackgroundLifecycleSnapshot,
	type BackgroundWindowManager,
	type CloseInterceptionOptions,
} from "./lifecycle/background-session";
import {
	type AvailableDesktopRuntime,
	createDesktopRuntime,
	type DesktopRuntime,
	type ElectronWindow,
} from "./runtime/electron";
import type { TrayXSettings } from "./settings";
import {
	buildAppLifecycleSettingsFromState,
	buildCloseInterceptionOptionsFromState,
	buildTrayControllerDerivedState,
	buildTrayControllerDiagnostics,
	buildTrayRefreshOptions,
	type TrayControllerDerivedState,
} from "./tray-controller-state";
import {
	type TrayOwnerSnapshot,
	createTrayOwnerSnapshot,
	releaseTrayOwnership,
	syncTrayOwnership,
} from "./tray/owner";
import { createEmptyTraySnapshot, type TrayRefreshOptions, type TraySnapshot, type TrayRefreshResult, TrayService } from "./tray/service";
import { WindowManager } from "./window-manager";

type NoticeSink = (message: string, timeout?: number) => void;

export interface TrayControllerWindowCallbacks {
	onFocus?(): void;
	onTopologyChange?(): void;
}

export interface TrayControllerWindowManager
	extends AppLifecycleWindowManager,
		BackgroundWindowManager {
	destroy(): void;
	getWindows(): ElectronWindow[];
	hasVisibleWindows(): boolean;
	start(callbacks?: TrayControllerWindowCallbacks): void;
}

export interface TrayControllerTrayService {
	destroy(): void;
	getSnapshot(): TraySnapshot;
	refresh(options: TrayRefreshOptions): TrayRefreshResult;
}

export interface TrayControllerBackgroundSession {
	applyCloseInterception(options: CloseInterceptionOptions): void;
	backgroundCurrentSession(windowManager: TrayControllerWindowManager): void;
	destroy(): void;
	disable(): void;
	getSnapshot(): BackgroundLifecycleSnapshot;
	isCurrentWindowFullScreen(): boolean;
}

export interface TrayControllerAppLifecycle {
	applyAppIconVisibility(hidden: boolean): void;
	applySettings(settings: AppLifecycleSettings): void;
	destroy(): void;
	getAppIconHidden(): boolean;
	initialize(): void;
	syncVisibilityAndRestorePath(hideRequested: boolean, canHideSafely: boolean): void;
}

export interface TrayControllerDependencies {
	createAppLifecycle?(
		runtime: AvailableDesktopRuntime,
		windowManager: TrayControllerWindowManager,
		hooks: AppLifecycleHooks,
	): TrayControllerAppLifecycle;
	createBackgroundSession?(runtime: AvailableDesktopRuntime): TrayControllerBackgroundSession;
	createRuntime?(): DesktopRuntime;
	createTrayService?(
		runtime: AvailableDesktopRuntime,
		pluginDir: string,
	): TrayControllerTrayService;
	createWindowManager?(runtime: AvailableDesktopRuntime): TrayControllerWindowManager;
	logDebug?(...args: unknown[]): void;
	logWarn?(...args: unknown[]): void;
	showNotice?: NoticeSink;
}

export class TrayController {
	private readonly appLifecycle: TrayControllerAppLifecycle | null;
	private readonly backgroundSession: TrayControllerBackgroundSession | null;
	private readonly dependencies: Required<TrayControllerDependencies>;
	private readonly runtime: DesktopRuntime;
	private readonly trayService: TrayControllerTrayService | null;
	private readonly windowManager: TrayControllerWindowManager | null;
	private ownerSnapshot: TrayOwnerSnapshot;
	private unavailableNoticeShown = false;

	constructor(
		private readonly app: App,
		private settings: TrayXSettings,
		private readonly pluginDir: string,
		dependencies: TrayControllerDependencies = {},
	) {
		this.dependencies = {
			createAppLifecycle: (runtime, windowManager, hooks) =>
				new AppLifecycleController(runtime, windowManager, hooks),
			createBackgroundSession: (runtime) => new BackgroundSessionController(runtime),
			createRuntime: () => createDesktopRuntime(),
			createTrayService: (runtime, pluginDir) => new TrayService(runtime, pluginDir),
			createWindowManager: (runtime) => new WindowManager(runtime),
			logDebug: (...args) => console.debug(...args),
			logWarn: (...args) => console.warn(...args),
			showNotice: showDefaultNotice,
			...dependencies,
		};
		this.runtime = this.dependencies.createRuntime();

		if (this.runtime.available) {
			this.windowManager = this.dependencies.createWindowManager(this.runtime);
			this.trayService = this.dependencies.createTrayService(this.runtime, this.pluginDir);
			this.backgroundSession = this.dependencies.createBackgroundSession(this.runtime);
			this.appLifecycle = this.dependencies.createAppLifecycle(this.runtime, this.windowManager, {
				onActivateRestore: () => this.showVault(),
				onBeforeQuit: () => {
					this.releaseTrayOwnership();
					this.backgroundSession?.disable();
					this.appLifecycle?.applyAppIconVisibility(false);
				},
			});
		} else {
			this.windowManager = null;
			this.trayService = null;
			this.backgroundSession = null;
			this.appLifecycle = null;
		}

		this.ownerSnapshot = createTrayOwnerSnapshot(
			this.runtime.available ? this.runtime.currentWindow.id : null,
		);
	}

	initialize(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		context.windowManager.start({
			onFocus: () => {
				syncFocusedAppIconVisibility(
					this.appLifecycle,
					this.settings.hideAppIcon,
					this.getDerivedState().canHideAppIconSafely,
				);
			},
			onTopologyChange: () => this.reconcileRuntimeState("window-topology-change"),
		});

		this.appLifecycle?.initialize();
		this.reconcileRuntimeState("initialize");
	}

	applySettings(settings: TrayXSettings): void {
		this.settings = settings;
		this.reconcileRuntimeState("apply-settings");
	}

	handleHideOnLaunch(): void {
		if (!this.settings.hideOnLaunch) {
			return;
		}

		this.hideVault();
	}

	toggleVaultVisibility(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		const state = this.getDerivedState();
		if (this.settings.runInBackground && !state.canRecoverFromHiddenState) {
			this.showVault();
			return;
		}

		if (context.windowManager.hasVisibleWindows()) {
			this.hideVault();
			return;
		}

		this.showVault();
	}

	showVault(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		if (context.runtime.platform === "darwin") {
			context.runtime.app.show?.();
		}

		context.windowManager.showWindows();
	}

	hideVault(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		const state = this.getDerivedState();
		if (this.settings.runInBackground && !state.canRecoverFromHiddenState) {
			this.dependencies.logWarn(
				"[TrayX] Background hide skipped because no recovery path is available.",
			);
			context.windowManager.hideWindows(false);
			return;
		}

		this.backgroundSession?.backgroundCurrentSession(context.windowManager);
	}

	relaunchApp(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		context.runtime.app.relaunch();
		context.runtime.app.exit(0);
	}

	closeVault(): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		const managedWindows = context.windowManager.getWindows();
		this.destroyManagedSession(false);

		if (context.runtime.BrowserWindow.getAllWindows().length === managedWindows.length) {
			context.runtime.app.quit();
			return;
		}

		for (const window of managedWindows) {
			window.destroy();
		}
	}

	unload(): void {
		if (!this.runtime.available || !this.windowManager) {
			return;
		}

		this.destroyManagedSession(true);
	}

	showRuntimeDiagnostics(): void {
		const diagnostics = this.getDiagnosticsPayload();
		this.dependencies.logDebug("[TrayX] Runtime diagnostics", diagnostics);
		this.dependencies.showNotice(
			formatRuntimeDiagnosticsSummary(diagnostics, this.runtime.available),
			12000,
		);
	}

	private destroyManagedSession(destroyWindowManager: boolean): void {
		this.releaseTrayOwnership();
		this.destroyTray();
		this.appLifecycle?.destroy();
		this.backgroundSession?.destroy();

		if (destroyWindowManager) {
			this.windowManager?.destroy();
		}
	}

	private destroyTray(): void {
		this.trayService?.destroy();
	}

	private getAppIconHidden(): boolean {
		return this.appLifecycle?.getAppIconHidden() ?? false;
	}

	private getDerivedState(traySnapshot = this.getTraySnapshot()): TrayControllerDerivedState {
		return buildTrayControllerDerivedState({
			hideAppIconRequested: this.settings.hideAppIcon,
			appIconHidden: this.getAppIconHidden(),
			ownerSnapshot: this.ownerSnapshot,
			runInBackground: this.settings.runInBackground,
			runtimeAvailable: this.runtime.available,
			runtimePlatform: this.runtime.diagnostics.platform,
			traySnapshot,
		});
	}

	private getDiagnosticsPayload() {
		const traySnapshot = this.getTraySnapshot();
		return buildTrayControllerDiagnostics({
			appIconHidden: this.getAppIconHidden(),
			backgroundSnapshot: this.backgroundSession?.getSnapshot(),
			isFullScreen: this.backgroundSession?.isCurrentWindowFullScreen() ?? false,
			ownerSnapshot: this.ownerSnapshot,
			restoreBlocker: this.getDerivedState(traySnapshot).restoreBlocker,
			restorePolicyInput: this.getDerivedState(traySnapshot).restorePolicyInput,
			runtimeDiagnostics: this.runtime.diagnostics,
			traySnapshot,
		});
	}

	private getRuntimeContext(): { runtime: AvailableDesktopRuntime; windowManager: TrayControllerWindowManager } | null {
		if (!this.runtime.available || !this.windowManager) {
			this.showUnavailableNotice(this.getUnavailableReason());
			return null;
		}

		return {
			runtime: this.runtime,
			windowManager: this.windowManager,
		};
	}

	private getTraySnapshot(): TraySnapshot {
		return this.trayService?.getSnapshot() ?? createEmptyTraySnapshot();
	}

	private getUnavailableReason(): string {
		return this.runtime.available
			? formatRuntimeDiagnosticsSummary(this.getDiagnosticsPayload(), this.runtime.available)
			: getRuntimeFailureReason(this.runtime.diagnostics);
	}

	private reconcileRuntimeState(reason: string): void {
		const context = this.getRuntimeContext();
		if (!context) {
			return;
		}

		this.dependencies.logDebug("[TrayX] Reconciling runtime state.", reason);
		this.syncTrayOwnership();

		if (!this.settings.enableTrayIcon) {
			this.releaseTrayOwnership();
			this.destroyTray();
		} else {
			this.refreshTray();
		}

		const initialState = this.getDerivedState();
		this.appLifecycle?.applySettings(
			buildAppLifecycleSettingsFromState(this.settings, initialState),
		);

		const settledState = this.getDerivedState();
		this.backgroundSession?.applyCloseInterception(
			buildCloseInterceptionOptionsFromState(this.settings, settledState, context.windowManager),
		);
	}

	private refreshTray(): void {
		const result = this.trayService?.refresh(
			buildTrayRefreshOptions({
				actions: {
					closeVault: () => this.closeVault(),
					hideVault: () => this.hideVault(),
					relaunchApp: () => this.relaunchApp(),
					showVault: () => this.showVault(),
					toggleVaultVisibility: () => this.toggleVaultVisibility(),
				},
				ownerSnapshot: this.ownerSnapshot,
				settings: this.settings,
				toolTip: `TrayX: ${this.app.vault.getName()}`,
			}),
		);
		if (!result || result.ok) {
			return;
		}

		this.releaseTrayOwnership();
		this.dependencies.logWarn("[TrayX] Tray creation failed.", this.getDiagnosticsPayload());
		this.dependencies.showNotice(getTrayCreationFailureNotice(), 8000);
	}

	private releaseTrayOwnership(): void {
		this.ownerSnapshot = releaseTrayOwnership(this.app, this.ownerSnapshot);
	}

	private showUnavailableNotice(reason: string): void {
		if (this.unavailableNoticeShown) {
			return;
		}

		this.unavailableNoticeShown = true;
		this.dependencies.logWarn("[TrayX] Runtime diagnostics", this.getDiagnosticsPayload());
		this.dependencies.showNotice(reason, 8000);
	}

	private syncTrayOwnership(): void {
		if (!this.runtime.available) {
			return;
		}

		const liveWindowIds = new Set(
			this.runtime.BrowserWindow.getAllWindows()
				.filter((window) => !window.isDestroyed?.())
				.map((window) => window.id),
		);
		this.ownerSnapshot = syncTrayOwnership(
			this.app,
			this.runtime.currentWindow.id,
			liveWindowIds,
		);
	}
}

function showDefaultNotice(message: string, timeout?: number): void {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const obsidian = require("obsidian") as {
		Notice: new (message: string, timeout?: number) => unknown;
	};
	new obsidian.Notice(message, timeout);
}
