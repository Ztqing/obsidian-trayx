import * as assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptyBackgroundLifecycleSnapshot } from "../src/lifecycle/background-session";
import {
	buildRuntimeDiagnosticsPayload,
	formatRuntimeDiagnosticsSummary,
	type RuntimeDiagnosticsPayload,
} from "../src/diagnostics/runtime-diagnostics";
import type { RuntimeDiagnostics } from "../src/runtime/electron";
import { createTrayOwnerSnapshot } from "../src/tray/owner";
import { createEmptyTraySnapshot } from "../src/tray/service";

void test("buildRuntimeDiagnosticsPayload combines runtime, owner, tray, and lifecycle snapshots", () => {
	const payload = buildRuntimeDiagnosticsPayload({
		appIconHidden: true,
		backgroundSnapshot: {
			...createEmptyBackgroundLifecycleSnapshot(),
			closeInterceptionActive: true,
			macUnloadVetoArmed: true,
		},
		isFullScreen: true,
		mode: "full",
		ownerSnapshot: {
			...createTrayOwnerSnapshot(5),
			isTrayOwner: true,
			trayOwnerWindowId: 5,
		},
		restoreBlocker: null,
		restorePath: "tray",
		runtimeDiagnostics: {
			bridgeKind: "host.remote",
			capabilitySources: { app: "property" },
			electronModuleLoaded: true,
			failureReason: "ok",
			hostVersion: "1.10.3",
			missingCapabilities: [],
			notes: [],
			platform: "darwin",
		},
		traySnapshot: {
			...createEmptyTraySnapshot(),
			resolvedTrayIconPath: "/tmp/trayTemplate.png",
			trayBounds: { height: 16, width: 16, x: 1, y: 2 },
			trayCreated: true,
			trayIconExists: true,
			trayIconMode: "file-template",
			trayIconTemplate: true,
			trayObjectCreated: true,
		},
	});

	assert.equal(payload.appIconHidden, true);
	assert.equal(payload.closeInterceptionActive, true);
	assert.equal(payload.isFullScreen, true);
	assert.equal(payload.trayCreated, true);
	assert.equal(payload.trayOwnerWindowId, 5);
	assert.equal(payload.restorePath, "tray");
});

void test("buildRuntimeDiagnosticsPayload exposes the full diagnostics contract", () => {
	const payload = buildRuntimeDiagnosticsPayload(createComprehensiveDiagnosticsOptions());

	assert.deepEqual(Object.keys(payload).sort(), [
		"appIconHidden",
		"bridgeKind",
		"capabilitySources",
		"closeInterceptionActive",
		"currentWindowId",
		"electronModuleLoaded",
		"failureReason",
		"hostVersion",
		"isFullScreen",
		"isTrayOwner",
		"macUnloadVetoArmed",
		"missingCapabilities",
		"mode",
		"notes",
		"pendingMacFullscreenBackground",
		"platform",
		"previousTrayOwnerDetected",
		"resolvedTrayIconPath",
		"restoreBlocker",
		"restorePath",
		"trayBounds",
		"trayCreated",
		"trayIconEmpty",
		"trayIconExists",
		"trayIconMode",
		"trayIconTemplate",
		"trayObjectCreated",
		"trayOwnerWindowId",
		"trayRefreshError",
	]);
});

void test("formatRuntimeDiagnosticsSummary reports core tray and restore state", () => {
	const summary = formatRuntimeDiagnosticsSummary(
		buildRuntimeDiagnosticsPayload({
			appIconHidden: false,
			backgroundSnapshot: {
				...createEmptyBackgroundLifecycleSnapshot(),
				pendingMacFullscreenBackground: true,
			},
			isFullScreen: false,
			mode: "safe-close-disabled",
			ownerSnapshot: {
				...createTrayOwnerSnapshot(7),
				previousTrayOwnerDetected: true,
				trayOwnerWindowId: 9,
			},
			restorePath: "none",
			restoreBlocker: "missing-tray-restore-path",
			runtimeDiagnostics: {
				bridgeKind: "@electron/remote",
				capabilitySources: { Tray: "property" },
				electronModuleLoaded: true,
				failureReason: "fallback",
				missingCapabilities: ["Menu"],
				notes: [],
				platform: "win32",
			},
			traySnapshot: {
				...createEmptyTraySnapshot(),
				lastTrayError: "tray failed",
				trayIconMode: "none",
			},
		}),
		false,
		"en",
	);

	assert.match(summary, /Bridge: @electron\/remote/);
	assert.match(summary, /Missing: Menu/);
	assert.match(summary, /Tray owner: 9/);
	assert.match(summary, /Tray error: tray failed/);
	assert.match(summary, /Restore: none/);
	assert.match(summary, /Restore blocker: missing-tray-restore-path/);
	assert.match(summary, /Mode: safe-close-disabled/);
	assert.match(summary, /fallback/);
});

void test("formatRuntimeDiagnosticsSummary includes all required diagnostics fields when present", () => {
	const summary = formatRuntimeDiagnosticsSummary(
		buildRuntimeDiagnosticsPayload(createComprehensiveDiagnosticsOptions()),
		true,
		"en",
	);

	assert.match(summary, /Bridge: host\.remote/);
	assert.match(summary, /Platform: darwin/);
	assert.match(summary, /Obsidian: 1\.10\.3/);
	assert.match(summary, /Missing: Menu, Tray/);
	assert.match(summary, /Sources: app=property, nativeImage=renderer-fallback/);
	assert.match(summary, /Tray: ready/);
	assert.match(summary, /Tray owner: 11/);
	assert.match(summary, /Window: 11/);
	assert.match(summary, /Tray icon: file-template/);
	assert.match(summary, /Tray path: \/tmp\/trayTemplate\.png/);
	assert.match(summary, /Tray icon exists: true/);
	assert.match(summary, /Tray icon empty: false/);
	assert.match(summary, /Tray icon template: true/);
	assert.match(summary, /Tray bounds: 20x18@4,8/);
	assert.match(summary, /Restore: tray/);
	assert.match(summary, /Close intercept: on/);
	assert.match(summary, /Fullscreen close pending: on/);
	assert.match(summary, /Fullscreen: on/);
	assert.match(summary, /Unload veto: on/);
	assert.match(summary, /Mode: full/);
	assert.match(summary, /Tray bridge is ready\./);
});

void test("formatRuntimeDiagnosticsSummary includes the tray template status when available", () => {
	const summary = formatRuntimeDiagnosticsSummary(
		buildRuntimeDiagnosticsPayload({
			appIconHidden: false,
			backgroundSnapshot: createEmptyBackgroundLifecycleSnapshot(),
			isFullScreen: false,
			mode: "full",
			ownerSnapshot: createTrayOwnerSnapshot(3),
			restorePath: "tray",
			runtimeDiagnostics: {
				bridgeKind: "host.remote",
				capabilitySources: {},
				electronModuleLoaded: true,
				failureReason: "ok",
				missingCapabilities: [],
				notes: [],
				platform: "darwin",
			},
			traySnapshot: {
				...createEmptyTraySnapshot(),
				trayCreated: true,
				trayIconMode: "file-template",
				trayIconTemplate: true,
			},
			restoreBlocker: null,
		}),
		true,
		"en",
	);

	assert.match(summary, /Tray icon template: true/);
});

void test("formatRuntimeDiagnosticsSummary localizes labels while preserving technical values", () => {
	const summary = formatRuntimeDiagnosticsSummary(
		buildRuntimeDiagnosticsPayload({
			appIconHidden: false,
			backgroundSnapshot: {
				...createEmptyBackgroundLifecycleSnapshot(),
				closeInterceptionActive: true,
				pendingMacFullscreenBackground: true,
			},
			isFullScreen: true,
			mode: "safe-close-disabled",
			ownerSnapshot: {
				...createTrayOwnerSnapshot(7),
				isTrayOwner: false,
				trayOwnerWindowId: 9,
			},
			restorePath: "none",
			restoreBlocker: "non-owner-window",
			runtimeDiagnostics: {
				bridgeKind: "@electron/remote",
				capabilitySources: { Tray: "property" },
				electronModuleLoaded: true,
				failureReason: "fallback",
				missingCapabilities: ["Menu"],
				notes: [],
				platform: "win32",
			},
			traySnapshot: {
				...createEmptyTraySnapshot(),
				trayCreated: false,
				trayIconMode: "none",
			},
		}),
		false,
		"zh",
	);

	assert.match(summary, /桥接: @electron\/remote/);
	assert.match(summary, /缺失能力: Menu/);
	assert.match(summary, /托盘: 未就绪/);
	assert.match(summary, /恢复路径: none/);
	assert.match(summary, /恢复阻塞原因: non-owner-window/);
	assert.match(summary, /关闭拦截: 开/);
	assert.match(summary, /模式: safe-close-disabled/);
	assert.match(summary, /fallback/);
});

void test("formatRuntimeDiagnosticsSummary localizes labels and status words without translating technical values", () => {
	const payload = buildRuntimeDiagnosticsPayload({
		...createComprehensiveDiagnosticsOptions(),
		mode: "safe-close-disabled",
		restorePath: "none",
		runtimeDiagnostics: {
			bridgeKind: "@electron/remote",
			capabilitySources: {
				Tray: "property",
				nativeImage: "renderer-fallback",
			},
			electronModuleLoaded: true,
			failureReason: "bridge failure",
			hostVersion: "1.10.3",
			missingCapabilities: ["Menu"],
			notes: [],
			platform: "win32",
		},
	});

	const summary = formatRuntimeDiagnosticsSummary(payload, false, "zh");

	assert.match(summary, /桥接: @electron\/remote/);
	assert.match(summary, /来源: Tray=property, nativeImage=renderer-fallback/);
	assert.match(summary, /恢复路径: none/);
	assert.match(summary, /模式: safe-close-disabled/);
	assert.match(summary, /关闭拦截: 开/);
	assert.match(summary, /全屏关闭待处理: 开/);
	assert.match(summary, /全屏: 开/);
	assert.match(summary, /卸载阻止: 开/);
	assert.match(summary, /bridge failure/);
});

void test("formatRuntimeDiagnosticsSummary marks non-owner windows and switches its tail message by runtime availability", () => {
	const payload = buildRuntimeDiagnosticsPayload({
		...createComprehensiveDiagnosticsOptions(),
		ownerSnapshot: {
			...createTrayOwnerSnapshot(7),
			isTrayOwner: false,
			previousTrayOwnerDetected: true,
			trayOwnerWindowId: 11,
		},
		runtimeDiagnostics: {
			bridgeKind: "@electron/remote",
			capabilitySources: {},
			electronModuleLoaded: true,
			failureReason: "raw failure",
			missingCapabilities: [],
			notes: [],
			platform: "win32",
		},
		restoreBlocker: "non-owner-window",
	});

	const unavailableSummary = formatRuntimeDiagnosticsSummary(payload, false, "en");
	assert.match(unavailableSummary, /Non-owner window/);
	assert.match(unavailableSummary, /raw failure/);

	const availableSummary = formatRuntimeDiagnosticsSummary(payload, true, "en");
	assert.doesNotMatch(availableSummary, /raw failure/);
	assert.match(availableSummary, /Tray bridge is ready\./);
});

function createComprehensiveDiagnosticsOptions(): {
	appIconHidden: boolean;
	backgroundSnapshot: ReturnType<typeof createEmptyBackgroundLifecycleSnapshot>;
	isFullScreen: boolean;
	mode: RuntimeDiagnosticsPayload["mode"];
	ownerSnapshot: ReturnType<typeof createTrayOwnerSnapshot>;
	restoreBlocker: RuntimeDiagnosticsPayload["restoreBlocker"];
	restorePath: RuntimeDiagnosticsPayload["restorePath"];
	runtimeDiagnostics: RuntimeDiagnostics;
	traySnapshot: ReturnType<typeof createEmptyTraySnapshot>;
} {
	return {
		appIconHidden: true,
		backgroundSnapshot: {
			...createEmptyBackgroundLifecycleSnapshot(),
			closeInterceptionActive: true,
			macUnloadVetoArmed: true,
			pendingMacFullscreenBackground: true,
		},
		isFullScreen: true,
		mode: "full",
		ownerSnapshot: {
			...createTrayOwnerSnapshot(11),
			isTrayOwner: true,
			trayOwnerWindowId: 11,
		},
		restoreBlocker: null,
		restorePath: "tray",
		runtimeDiagnostics: {
			bridgeKind: "host.remote",
			capabilitySources: {
				app: "property",
				nativeImage: "renderer-fallback",
			},
			electronModuleLoaded: true,
			failureReason: "bridge is ready",
			hostVersion: "1.10.3",
			missingCapabilities: ["Menu", "Tray"],
			notes: ["diagnostic note"],
			platform: "darwin",
		},
		traySnapshot: {
			...createEmptyTraySnapshot(),
			resolvedTrayIconPath: "/tmp/trayTemplate.png",
			trayBounds: { height: 18, width: 20, x: 4, y: 8 },
			trayCreated: true,
			trayIconEmpty: false,
			trayIconExists: true,
			trayIconMode: "file-template",
			trayIconTemplate: true,
			trayObjectCreated: true,
		},
	};
}
