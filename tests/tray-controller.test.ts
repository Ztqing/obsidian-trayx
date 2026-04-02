import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptyBackgroundLifecycleSnapshot } from "../src/lifecycle/background-session";
import { syncFocusedAppIconVisibility, type AppLifecycleSettings } from "../src/lifecycle/app-lifecycle";
import type { AvailableDesktopRuntime, DesktopRuntime, ElectronWindow } from "../src/runtime/electron";
import { DEFAULT_SETTINGS, type TrayXSettings } from "../src/settings";
import {
	TrayController,
	type TrayControllerAppLifecycle,
	type TrayControllerBackgroundSession,
	type TrayControllerDependencies,
	type TrayControllerTrayService,
	type TrayControllerWindowCallbacks,
	type TrayControllerWindowManager,
} from "../src/tray-controller";
import { TRAY_OWNER_SCHEMA_VERSION, TRAY_OWNER_STORAGE_KEY } from "../src/tray/owner";
import { createEmptyTraySnapshot, type TrayRefreshOptions, type TrayRefreshResult, type TraySnapshot } from "../src/tray/service";
import {
	FakeApp,
	FakeNoticeSink,
	FakePluginApp,
	FakeWindow,
} from "./helpers/fakes";

class FakeControllerWindowManager implements TrayControllerWindowManager {
	callbacks: TrayControllerWindowCallbacks | null = null;
	destroyCalls = 0;
	getWindowsValue: ElectronWindow[] = [];
	hasVisibleWindowsValue = false;
	hideWindowsCalls: boolean[] = [];
	needsDockRestoreValue = false;
	setSkipTaskbarCalls: boolean[] = [];
	showWindowsCalls = 0;
	startCalls = 0;

	destroy(): void {
		this.destroyCalls += 1;
	}

	getWindows(): ElectronWindow[] {
		return this.getWindowsValue;
	}

	hasVisibleWindows(): boolean {
		return this.hasVisibleWindowsValue;
	}

	hideWindows(runInBackground: boolean): void {
		this.hideWindowsCalls.push(runInBackground);
	}

	needsDockRestore(): boolean {
		return this.needsDockRestoreValue;
	}

	setSkipTaskbar(skipTaskbar: boolean): void {
		this.setSkipTaskbarCalls.push(skipTaskbar);
	}

	showWindows(): void {
		this.showWindowsCalls += 1;
	}

	start(callbacks?: TrayControllerWindowCallbacks): void {
		this.startCalls += 1;
		this.callbacks = callbacks ?? null;
	}

	triggerFocus(): void {
		this.callbacks?.onFocus?.();
	}

	triggerTopologyChange(): void {
		this.callbacks?.onTopologyChange?.();
	}
}

class FakeControllerTrayService implements TrayControllerTrayService {
	destroyCalls = 0;
	nextResult: TrayRefreshResult = { ok: true };
	refreshCalls: TrayRefreshOptions[] = [];
	snapshot: TraySnapshot = createEmptyTraySnapshot();

	destroy(): void {
		this.destroyCalls += 1;
	}

	getSnapshot(): TraySnapshot {
		return { ...this.snapshot };
	}

	refresh(options: TrayRefreshOptions): TrayRefreshResult {
		this.refreshCalls.push(options);
		this.snapshot = this.nextResult.ok
			? {
					...this.snapshot,
					lastRefreshAttempted: true,
					lastTrayError: null,
					trayCreated: options.enabled && options.isOwner,
					trayObjectCreated: options.enabled && options.isOwner,
				}
			: {
					...this.snapshot,
					lastRefreshAttempted: true,
					lastTrayError: this.nextResult.error?.message ?? "tray failed",
					trayCreated: false,
					trayObjectCreated: false,
				};
		return this.nextResult;
	}
}

class FakeControllerBackgroundSession implements TrayControllerBackgroundSession {
	applyCloseInterceptionCalls = [] as Array<{
		canRecoverFromHiddenState: boolean;
		onCloseRequest: () => void;
		runInBackground: boolean;
		windowManager: TrayControllerWindowManager;
	}>;
	backgroundCurrentSessionCalls = 0;
	disableCalls = 0;
	destroyCalls = 0;
	isCurrentWindowFullScreenValue = false;
	snapshot = createEmptyBackgroundLifecycleSnapshot();

	applyCloseInterception(
		options: Parameters<TrayControllerBackgroundSession["applyCloseInterception"]>[0],
	): void {
		this.applyCloseInterceptionCalls.push({
			canRecoverFromHiddenState: options.canRecoverFromHiddenState,
			onCloseRequest: () => options.onCloseRequest(),
			runInBackground: options.runInBackground,
			windowManager: options.windowManager as TrayControllerWindowManager,
		});
	}

	backgroundCurrentSession(_windowManager: TrayControllerWindowManager): void {
		this.backgroundCurrentSessionCalls += 1;
	}

	destroy(): void {
		this.destroyCalls += 1;
	}

	disable(): void {
		this.disableCalls += 1;
	}

	getSnapshot() {
		return { ...this.snapshot };
	}

	isCurrentWindowFullScreen(): boolean {
		return this.isCurrentWindowFullScreenValue;
	}
}

class FakeControllerAppLifecycle implements TrayControllerAppLifecycle {
	applyAppIconVisibilityCalls: boolean[] = [];
	applySettingsCalls: AppLifecycleSettings[] = [];
	destroyCalls = 0;
	initializeCalls = 0;
	private appIconHidden = false;

	applyAppIconVisibility(hidden: boolean): void {
		this.appIconHidden = hidden;
		this.applyAppIconVisibilityCalls.push(hidden);
	}

	applySettings(settings: AppLifecycleSettings): void {
		this.appIconHidden = settings.hideAppIcon && settings.canHideAppIconSafely;
		this.applySettingsCalls.push(settings);
	}

	destroy(): void {
		this.destroyCalls += 1;
	}

	getAppIconHidden(): boolean {
		return this.appIconHidden;
	}

	initialize(): void {
		this.initializeCalls += 1;
	}

	syncVisibilityAndRestorePath(hideRequested: boolean, canHideSafely: boolean): void {
		this.appIconHidden = hideRequested && canHideSafely;
	}
}

function createAvailableRuntime(
	platform: AvailableDesktopRuntime["platform"] = "darwin",
): {
	allWindows: ElectronWindow[];
	currentWindow: FakeWindow;
	runtime: AvailableDesktopRuntime;
	runtimeApp: FakeApp;
} {
	const currentWindow = new FakeWindow(11);
	const runtimeApp = new FakeApp();
	const allWindows: ElectronWindow[] = [currentWindow];

	return {
		allWindows,
		currentWindow,
		runtime: {
			available: true,
			app: runtimeApp,
			BrowserWindow: {
				getAllWindows: () => allWindows,
			},
			currentWindow,
			diagnostics: {
				bridgeKind: "host.remote",
				capabilitySources: { app: "property" },
				electronModuleLoaded: true,
				failureReason: "ready",
				hostVersion: "1.10.3",
				missingCapabilities: [],
				notes: [],
				platform,
			},
			Menu: {
				buildFromTemplate: () => ({}),
			},
			nativeImage: {
				createFromDataURL: () => ({
					resize: () => ({
						resize: () => {
							throw new Error("not used");
						},
						setTemplateImage: () => {},
					}),
					setTemplateImage: () => {},
				}),
				createFromPath: () => ({
					resize: () => ({
						resize: () => {
							throw new Error("not used");
						},
						setTemplateImage: () => {},
					}),
					setTemplateImage: () => {},
				}),
			},
			platform,
			Tray: class {
				destroy(): void {}
				on(): void {}
				popUpContextMenu(): void {}
				removeListener(): void {}
				setToolTip(): void {}
			},
		},
		runtimeApp,
	};
}

function createUnavailableRuntime(): DesktopRuntime {
	return {
		available: false,
		diagnostics: {
			bridgeKind: "none",
			capabilitySources: {},
			electronModuleLoaded: false,
			failureReason: "TrayX is only available in the desktop app.",
			missingCapabilities: [],
			notes: [],
			platform: "darwin",
		},
		platform: "darwin",
		reason: "TrayX is only available in the desktop app.",
	};
}

function createControllerHarness(options?: {
	runtime?: DesktopRuntime;
	settings?: TrayXSettings;
}): {
	app: FakePluginApp;
	appLifecycle: FakeControllerAppLifecycle;
	backgroundSession: FakeControllerBackgroundSession;
	controller: TrayController;
	noticeSink: FakeNoticeSink;
	runtime: DesktopRuntime;
	trayService: FakeControllerTrayService;
	warnLogs: unknown[][];
	windowManager: FakeControllerWindowManager;
} {
	const app = new FakePluginApp();
	const noticeSink = new FakeNoticeSink();
	const warnLogs: unknown[][] = [];
	const runtime = options?.runtime ?? createAvailableRuntime().runtime;
	const windowManager = new FakeControllerWindowManager();
	const trayService = new FakeControllerTrayService();
	const backgroundSession = new FakeControllerBackgroundSession();
	const appLifecycle = new FakeControllerAppLifecycle();
	const dependencies: TrayControllerDependencies = {
		createAppLifecycle: () => appLifecycle,
		createBackgroundSession: () => backgroundSession,
		createRuntime: () => runtime,
		createTrayService: () => trayService,
		createWindowManager: () => windowManager,
		logDebug: () => {},
		logWarn: (...args) => warnLogs.push(args),
		showNotice: (message, timeout) => noticeSink.show(message, timeout),
	};
	const controller = new TrayController(
		app as unknown as ConstructorParameters<typeof TrayController>[0],
		options?.settings ?? { ...DEFAULT_SETTINGS },
		"/tmp/trayx-plugin",
		dependencies,
	);

	return {
		app,
		appLifecycle,
		backgroundSession,
		controller,
		noticeSink,
		runtime,
		trayService,
		warnLogs,
		windowManager,
	};
}

void test("focused app icon sync uses the unified lifecycle method instead of raw visibility writes", () => {
	let rawVisibilityCalls = 0;
	const syncCalls: Array<{ canHideSafely: boolean; hideRequested: boolean }> = [];

	const target = {
		applyAppIconVisibility(): void {
			rawVisibilityCalls += 1;
		},
		syncVisibilityAndRestorePath(hideRequested: boolean, canHideSafely: boolean): void {
			syncCalls.push({ canHideSafely, hideRequested });
		},
	};

	syncFocusedAppIconVisibility(target, true, true);

	assert.deepEqual(syncCalls, [{ canHideSafely: true, hideRequested: true }]);
	assert.equal(rawVisibilityCalls, 0);

	syncFocusedAppIconVisibility(target, false, true);
	assert.deepEqual(syncCalls, [{ canHideSafely: true, hideRequested: true }]);
});

void test("TrayController shows the unavailable notice only once across repeated actions", () => {
	const harness = createControllerHarness({
		runtime: createUnavailableRuntime(),
	});

	harness.controller.initialize();
	harness.controller.showVault();
	harness.controller.hideVault();

	assert.deepEqual(harness.noticeSink.notices, [
		{
			message: "TrayX is only available in the desktop app.",
			timeout: 8000,
		},
	]);
	assert.equal(harness.warnLogs.length, 1);
});

void test("TrayController releases tray ownership and shows a localized notice when tray creation fails", () => {
	const runtime = createAvailableRuntime("win32").runtime;
	const harness = createControllerHarness({ runtime });
	harness.trayService.nextResult = {
		error: new Error("tray failed"),
		ok: false,
	};

	harness.controller.initialize();

	assert.equal(harness.app.storage.has(TRAY_OWNER_STORAGE_KEY), false);
	assert.deepEqual(
		harness.noticeSink.notices[harness.noticeSink.notices.length - 1],
		{
			message: "Could not create the tray icon in this desktop build.",
			timeout: 8000,
		},
	);
	assert.equal(harness.trayService.refreshCalls.length, 1);
	assert.equal(harness.appLifecycle.initializeCalls, 1);
	assert.equal(
		harness.warnLogs[harness.warnLogs.length - 1]?.[0],
		"[TrayX] Tray creation failed.",
	);
});

void test("TrayController falls back to foreground minimize when background restore is unsafe", () => {
	const runtime = createAvailableRuntime("win32").runtime;
	const harness = createControllerHarness({
		runtime,
		settings: {
			...DEFAULT_SETTINGS,
			enableTrayIcon: false,
			runInBackground: true,
		},
	});

	harness.controller.initialize();
	harness.windowManager.hideWindowsCalls = [];
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.controller.hideVault();

	assert.deepEqual(harness.windowManager.hideWindowsCalls, [false]);
	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 0);
});

void test("TrayController minimizes on hide-on-launch when foreground mode is enabled", () => {
	const runtime = createAvailableRuntime("darwin").runtime;
	const harness = createControllerHarness({
		runtime,
		settings: {
			...DEFAULT_SETTINGS,
			hideOnLaunch: true,
			runInBackground: false,
		},
	});

	harness.controller.initialize();
	harness.windowManager.hideWindowsCalls = [];
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.controller.handleHideOnLaunch();

	assert.deepEqual(harness.windowManager.hideWindowsCalls, [false]);
	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 0);
});

void test("TrayController toggles visible windows through the unified hide policy", () => {
	const runtime = createAvailableRuntime("win32").runtime;
	const harness = createControllerHarness({
		runtime,
		settings: {
			...DEFAULT_SETTINGS,
			enableTrayIcon: false,
			runInBackground: true,
		},
	});
	harness.windowManager.hasVisibleWindowsValue = true;

	harness.controller.initialize();
	harness.windowManager.showWindowsCalls = 0;
	harness.windowManager.hideWindowsCalls = [];
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.controller.toggleVaultVisibility();

	assert.equal(harness.windowManager.showWindowsCalls, 0);
	assert.deepEqual(harness.windowManager.hideWindowsCalls, [false]);
	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 0);
});

void test("TrayController resyncs tray ownership before hiding from a stale non-owner state", () => {
	const available = createAvailableRuntime("win32");
	const previousOwner = new FakeWindow(42);
	available.allWindows.push(previousOwner);
	const harness = createControllerHarness({
		runtime: available.runtime,
		settings: {
			...DEFAULT_SETTINGS,
			runInBackground: true,
		},
	});
	harness.app.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, {
		ownerWindowId: 42,
		schemaVersion: TRAY_OWNER_SCHEMA_VERSION,
		updatedAt: 1,
	});

	harness.controller.initialize();
	assert.equal(harness.trayService.refreshCalls[0]?.isOwner, false);

	available.allWindows.splice(available.allWindows.indexOf(previousOwner), 1);
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.controller.hideVault();

	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 1);
	assert.equal(
		(
			harness.app.storage.get(TRAY_OWNER_STORAGE_KEY) as
				| { ownerWindowId: number }
				| undefined
		)?.ownerWindowId,
		11,
	);
});

void test("TrayController safely degrades after resync when reclaiming the tray still fails", () => {
	const available = createAvailableRuntime("win32");
	const previousOwner = new FakeWindow(42);
	available.allWindows.push(previousOwner);
	const harness = createControllerHarness({
		runtime: available.runtime,
		settings: {
			...DEFAULT_SETTINGS,
			runInBackground: true,
		},
	});
	harness.app.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, {
		ownerWindowId: 42,
		schemaVersion: TRAY_OWNER_SCHEMA_VERSION,
		updatedAt: 1,
	});

	harness.controller.initialize();
	available.allWindows.splice(available.allWindows.indexOf(previousOwner), 1);
	harness.trayService.nextResult = {
		error: new Error("tray failed"),
		ok: false,
	};
	harness.windowManager.hideWindowsCalls = [];
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.controller.hideVault();

	assert.deepEqual(harness.windowManager.hideWindowsCalls, [false]);
	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 0);
	assert.equal(harness.app.storage.has(TRAY_OWNER_STORAGE_KEY), false);
	assert.equal(harness.trayService.refreshCalls[1]?.isOwner, true);
});

void test("TrayController close interception reuses the unified hide policy", () => {
	const runtime = createAvailableRuntime("win32").runtime;
	const harness = createControllerHarness({
		runtime,
		settings: {
			...DEFAULT_SETTINGS,
			enableTrayIcon: false,
			runInBackground: true,
		},
	});

	harness.controller.initialize();
	harness.windowManager.hideWindowsCalls = [];
	harness.backgroundSession.backgroundCurrentSessionCalls = 0;

	harness.backgroundSession.applyCloseInterceptionCalls[0]?.onCloseRequest();

	assert.deepEqual(harness.windowManager.hideWindowsCalls, [false]);
	assert.equal(harness.backgroundSession.backgroundCurrentSessionCalls, 0);
});

void test("TrayController closes the app when this vault owns every remaining window", () => {
	const available = createAvailableRuntime("darwin");
	const harness = createControllerHarness({ runtime: available.runtime });
	harness.windowManager.getWindowsValue = [available.currentWindow];

	harness.controller.initialize();
	harness.controller.closeVault();

	assert.equal(available.runtimeApp.quitCalls, 1);
	assert.equal(harness.trayService.destroyCalls, 1);
	assert.equal(harness.appLifecycle.destroyCalls, 1);
	assert.equal(harness.backgroundSession.destroyCalls, 1);
});

void test("TrayController destroys only the managed vault windows when other windows still exist", () => {
	const available = createAvailableRuntime("darwin");
	const otherWindow = new FakeWindow(42);
	available.allWindows.push(otherWindow);
	const harness = createControllerHarness({ runtime: available.runtime });
	harness.windowManager.getWindowsValue = [available.currentWindow];

	harness.controller.initialize();
	harness.controller.closeVault();

	assert.equal(available.runtimeApp.quitCalls, 0);
	assert.equal(available.currentWindow.isDestroyed(), true);
	assert.equal(otherWindow.isDestroyed(), false);
});

void test("TrayController unload tears down tray ownership and destroys the window manager", () => {
	const available = createAvailableRuntime("darwin");
	const harness = createControllerHarness({ runtime: available.runtime });

	harness.controller.initialize();
	assert.equal(harness.app.storage.has(TRAY_OWNER_STORAGE_KEY), true);

	harness.controller.unload();

	assert.equal(harness.app.storage.has(TRAY_OWNER_STORAGE_KEY), false);
	assert.equal(harness.trayService.destroyCalls, 1);
	assert.equal(harness.appLifecycle.destroyCalls, 1);
	assert.equal(harness.backgroundSession.destroyCalls, 1);
	assert.equal(harness.windowManager.destroyCalls, 1);
});

void test("TrayController reclaims tray ownership when a previous live owner disappears", () => {
	const available = createAvailableRuntime("darwin");
	const previousOwner = new FakeWindow(42);
	available.allWindows.push(previousOwner);
	const harness = createControllerHarness({ runtime: available.runtime });
	harness.app.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, {
		ownerWindowId: 42,
		schemaVersion: TRAY_OWNER_SCHEMA_VERSION,
		updatedAt: 1,
	});

	harness.controller.initialize();

	assert.equal(harness.trayService.refreshCalls[0]?.isOwner, false);
	assert.equal(
		(
			harness.app.storage.get(TRAY_OWNER_STORAGE_KEY) as
				| { ownerWindowId: number }
				| undefined
		)?.ownerWindowId,
		42,
	);

	available.allWindows.splice(available.allWindows.indexOf(previousOwner), 1);
	harness.windowManager.triggerTopologyChange();

	assert.equal(harness.trayService.refreshCalls.length, 2);
	assert.equal(harness.trayService.refreshCalls[1]?.isOwner, true);
	assert.equal(
		(
			harness.app.storage.get(TRAY_OWNER_STORAGE_KEY) as
				| { ownerWindowId: number }
				| undefined
		)?.ownerWindowId,
		11,
	);
});

void test("TrayController can recover from a tray creation failure on a later reconcile", () => {
	const available = createAvailableRuntime("darwin");
	const harness = createControllerHarness({ runtime: available.runtime });
	harness.trayService.nextResult = {
		error: new Error("tray failed"),
		ok: false,
	};

	harness.controller.initialize();
	assert.equal(harness.app.storage.has(TRAY_OWNER_STORAGE_KEY), false);

	harness.trayService.nextResult = { ok: true };
	harness.controller.applySettings({ ...DEFAULT_SETTINGS });

	assert.equal(harness.trayService.refreshCalls.length, 2);
	assert.equal(harness.trayService.refreshCalls[1]?.isOwner, true);
	assert.equal(
		(
			harness.app.storage.get(TRAY_OWNER_STORAGE_KEY) as
				| { ownerWindowId: number }
				| undefined
		)?.ownerWindowId,
		11,
	);
});

void test("TrayController shows runtime diagnostics built from current tray and lifecycle snapshots", () => {
	const available = createAvailableRuntime("darwin");
	const harness = createControllerHarness({ runtime: available.runtime });
	harness.trayService.snapshot = {
		...createEmptyTraySnapshot(),
		resolvedTrayIconPath: "/tmp/trayTemplate.png",
		trayBounds: { height: 16, width: 20, x: 1, y: 2 },
		trayCreated: true,
		trayIconEmpty: false,
		trayIconExists: true,
		trayIconMode: "file-template",
		trayIconTemplate: true,
		trayObjectCreated: true,
	};
	harness.backgroundSession.snapshot = {
		...createEmptyBackgroundLifecycleSnapshot(),
		closeInterceptionActive: true,
	};

	harness.controller.initialize();
	harness.noticeSink.notices.length = 0;

	harness.controller.showRuntimeDiagnostics();

	assert.deepEqual(harness.noticeSink.notices, [
		{
			message:
				"Bridge: host.remote | Platform: darwin | Obsidian: 1.10.3 | Sources: app=property | Tray: ready | Tray owner: 11 | Window: 11 | Tray icon: file-template | Tray path: /tmp/trayTemplate.png | Tray icon exists: true | Tray icon empty: false | Tray icon template: true | Tray bounds: 20x16@1,2 | Restore: tray | Close intercept: on | Fullscreen close pending: off | Fullscreen: off | Unload veto: off | Mode: full | Tray bridge is ready.",
			timeout: 12000,
		},
	]);
});
