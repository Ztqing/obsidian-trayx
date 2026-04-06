import * as assert from "node:assert/strict";
import { test } from "node:test";

import type {
	ElectronApp,
	ElectronBrowserWindowStatic,
	ElectronMenuStatic,
	ElectronNativeImageStatic,
	ElectronTrayConstructor,
	ElectronWindow,
} from "../src/runtime/electron";
import {
	chooseBestFailure,
	createDiagnostics,
	createUnavailableProbe,
	isDisabledBridgeError,
	pickAvailableBridge,
	readBridgeBuiltin,
	readCapability,
	readCurrentWindow,
	readNativeImage,
	readOptionalBridgeBuiltin,
	resolveNativeImageCapability,
} from "../src/runtime/probe-helpers";

function createAvailableAttempt(id: number) {
	return {
		available: true as const,
		app: {} as ElectronApp,
		BrowserWindow: {} as ElectronBrowserWindowStatic,
		currentWindow: { id } as ElectronWindow,
		diagnostics: createDiagnostics({
			bridgeKind: "host.remote",
			electronModuleLoaded: true,
			failureReason: `available-${id}`,
			notes: [],
			platform: "darwin",
		}),
		Menu: {} as ElectronMenuStatic,
		nativeImage: {} as ElectronNativeImageStatic,
		Tray: class {} as unknown as ElectronTrayConstructor,
	};
}

void test("pickAvailableBridge preserves bridge precedence by returning the first available attempt", () => {
	const available = pickAvailableBridge([
		createUnavailableProbe("none", "darwin", { failureReason: "none", notes: [] }),
		createAvailableAttempt(1),
		createAvailableAttempt(2),
	]);

	assert.equal(available?.diagnostics.failureReason, "available-1");
});

void test("resolveNativeImageCapability prefers the bridge image and falls back to the renderer image", () => {
	const capabilitySources: Record<string, string> = {};
	const notes: string[] = [];
	const missingCapabilities: Array<"nativeImage"> = [];
	const bridgeNativeImage = {} as ElectronNativeImageStatic;
	const rendererNativeImage = {} as ElectronNativeImageStatic;

	assert.equal(
		resolveNativeImageCapability({
			capabilitySources,
			mainProcessNativeImage: bridgeNativeImage,
			missingCapabilities,
			notes,
			rendererNativeImage,
		}),
		bridgeNativeImage,
	);
	assert.equal(capabilitySources.nativeImage, "property");

	const fallbackSources: Record<string, string> = {};
	assert.equal(
		resolveNativeImageCapability({
			capabilitySources: fallbackSources,
			mainProcessNativeImage: undefined,
			missingCapabilities: [],
			notes: [],
			rendererNativeImage,
		}),
		rendererNativeImage,
	);
	assert.equal(fallbackSources.nativeImage, "renderer-fallback");

	assert.equal(
		readNativeImage(
			{
				createFromDataURL(): unknown {
					return {};
				},
			},
		) !== undefined,
		true,
	);
	assert.equal(
		readNativeImage(
			{
				createFromPath(): unknown {
					return {};
				},
			},
		),
		undefined,
	);
});

void test("chooseBestFailure prefers disabled bridges and then @electron/remote failures", () => {
	const disabled = createUnavailableProbe("host.remote", "darwin", {
		failureReason: "disabled",
		notes: ["Blocked remote.getCurrentWindow()"],
	});
	const remote = createUnavailableProbe("@electron/remote", "darwin", {
		failureReason: "remote",
		notes: [],
	});

	assert.equal(chooseBestFailure([remote, disabled]).diagnostics.failureReason, "disabled");
	assert.equal(
		chooseBestFailure([
			createUnavailableProbe("host.remote", "darwin", {
				failureReason: "host",
				notes: [],
			}),
			remote,
		]).diagnostics.failureReason,
		"remote",
	);
	assert.equal(
		isDisabledBridgeError("Tray: Access denied because remote access is disabled for this WebContents."),
		true,
	);
});

void test("probe helper readers annotate capability sources and missing diagnostics", () => {
	const notes: string[] = [];
	const missing: Array<"app" | "BrowserWindow" | "Menu" | "Tray" | "getCurrentWindow" | "nativeImage"> = [];
	const errors: string[] = [];
	const sources: Record<string, string> = {};

	const app = readCapability(
		"app",
		{ app: { ok: true } },
		(value): value is { ok: boolean } =>
			typeof value === "object" && value !== null && "ok" in value,
		notes,
		missing,
		errors,
		sources,
	);
	assert.deepEqual(app, { ok: true });
	assert.equal(sources.app, "property");

	const browserWindow = readBridgeBuiltin(
		"BrowserWindow",
		{
			getBuiltin: (name: string) => (name === "BrowserWindow" ? { window: true } : null),
		},
		(value): value is { window: boolean } =>
			typeof value === "object" && value !== null && "window" in value,
		notes,
		missing,
		errors,
		sources,
	);
	assert.deepEqual(browserWindow, { window: true });
	assert.equal(sources.BrowserWindow, "getBuiltin");

	const nativeImage = readOptionalBridgeBuiltin(
		"nativeImage",
		{
			getBuiltin: (name: string) =>
				name === "nativeImage"
					? {
							createFromDataURL(): unknown {
								return {};
							},
						}
					: null,
		},
		(value): value is ElectronNativeImageStatic =>
			typeof value === "object" &&
			value !== null &&
			typeof (value as ElectronNativeImageStatic).createFromDataURL === "function",
		errors,
		sources,
	);
	assert.ok(nativeImage);
	assert.equal(sources.nativeImage, "getBuiltin");

	const currentWindow = readCurrentWindow(
		{
			getCurrentWindow: () => ({ id: 5 }),
		},
		(value): value is ElectronWindow =>
			typeof value === "object" && value !== null && "id" in value,
		notes,
		missing,
		errors,
		sources,
	);
	assert.equal(currentWindow?.id, 5);

	const missingNotes: string[] = [];
	const missingCapabilities: typeof missing = [];
	const missingSources: Record<string, string> = {};
	const missingErrors: string[] = [];
	const missingResult = readCurrentWindow(
		{},
		(value): value is ElectronWindow => Boolean(value),
		missingNotes,
		missingCapabilities,
		missingErrors,
		missingSources,
	);
	assert.equal(missingResult, undefined);
	assert.deepEqual(missingCapabilities, ["getCurrentWindow"]);
	assert.equal(missingSources.getCurrentWindow, "missing");
	assert.match(missingNotes[0] ?? "", /getCurrentWindow is not available/);

	const invalidWindowNotes: string[] = [];
	const invalidWindowCapabilities: typeof missing = [];
	const invalidWindowSources: Record<string, string> = {};
	const invalidWindowErrors: string[] = [];
	const invalidWindow = readCurrentWindow(
		{
			getCurrentWindow: () => ({
				destroy(): void {},
				hide(): void {},
				id: 5,
				on(): void {},
				removeListener(): void {},
				show(): void {},
				webContents: {
					on(): void {},
					removeListener(): void {},
				},
			}),
		},
		(value): value is ElectronWindow =>
			typeof value === "object" &&
			value !== null &&
			typeof (value as ElectronWindow).focus === "function",
		invalidWindowNotes,
		invalidWindowCapabilities,
		invalidWindowErrors,
		invalidWindowSources,
	);
	assert.equal(invalidWindow, undefined);
	assert.deepEqual(invalidWindowCapabilities, ["getCurrentWindow"]);
	assert.equal(invalidWindowSources.getCurrentWindow, "missing");
});
