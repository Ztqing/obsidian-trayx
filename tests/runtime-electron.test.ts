import * as assert from "node:assert/strict";
import { test } from "node:test";

import type {
	DesktopRuntimeEnvironment,
	ElectronBrowserWindowStatic,
	ElectronMenuStatic,
	ElectronNativeImage,
	ElectronNativeImageStatic,
	ElectronTrayConstructor,
	ElectronWindow,
} from "../src/runtime/electron";
import { createDesktopRuntime } from "../src/runtime/electron";
import { FakeApp, FakeWindow } from "./helpers/fakes";

class FakeNativeImage implements ElectronNativeImage {
	resize(): ElectronNativeImage {
		return this;
	}

	setTemplateImage(): void {}
}

function createNativeImageStatic(): ElectronNativeImageStatic {
	return {
		createFromDataURL: () => new FakeNativeImage(),
		createFromPath: () => new FakeNativeImage(),
	};
}

function createDarwinPathOnlyNativeImage(): Pick<ElectronNativeImageStatic, "createFromPath"> {
	return {
		createFromPath: () => new FakeNativeImage(),
	};
}

function createBridgeNamespace(
	currentWindow: ElectronWindow,
	overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
	const BrowserWindow: ElectronBrowserWindowStatic = {
		getAllWindows: () => [currentWindow],
	};
	const Menu: ElectronMenuStatic = {
		buildFromTemplate: () => ({}),
	};
	const Tray = class {
		destroy(): void {}
		on(): void {}
		popUpContextMenu(): void {}
		removeListener(): void {}
		setToolTip(): void {}
	} as unknown as ElectronTrayConstructor;
	const app = new FakeApp();

	return {
		app,
		getBuiltin: (name: string) => {
			if (name === "BrowserWindow") {
				return BrowserWindow;
			}
			if (name === "Menu") {
				return Menu;
			}
			return null;
		},
		getCurrentWindow: () => currentWindow,
		Tray,
		...overrides,
	};
}

function createEnvironment(options: {
	electronModule?: Record<string, unknown>;
	globalScope?: unknown;
	isDesktopApp?: boolean;
	modules?: Record<string, unknown>;
	platform?: DesktopRuntimeEnvironment["platform"];
}): DesktopRuntimeEnvironment {
	return {
		globalScope: options.globalScope,
		isDesktopApp: () => options.isDesktopApp ?? true,
		loadModule: (moduleName) => {
			if (moduleName === "electron") {
				if (options.electronModule) {
					return options.electronModule;
				}
				throw new Error("electron module missing");
			}

			const module = options.modules?.[moduleName];
			if (module !== undefined) {
				return module;
			}

			throw new Error(`${moduleName} missing`);
		},
		logWarn: () => {},
		platform: options.platform ?? "darwin",
	};
}

void test("createDesktopRuntime returns the desktop-only failure before loading Electron", () => {
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			isDesktopApp: false,
			platform: "darwin",
		}),
		),
	);

	assert.equal(runtime.reason, "TrayX is only available in the desktop app.");
	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "desktop-only");
	assert.equal(runtime.diagnostics.electronModuleLoaded, false);
});

void test("createDesktopRuntime reports Electron load failures through diagnostics", () => {
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			platform: "win32",
		}),
		),
	);

	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "electron-load-failed");
	assert.match(runtime.diagnostics.notes[0] ?? "", /electron module missing/);
});

void test("createDesktopRuntime prefers electron.remote over host.remote when @electron/remote is unavailable", () => {
	const currentWindow = new FakeWindow(21);
	const electronRemoteNamespace = createBridgeNamespace(currentWindow);
	const hostRemoteNamespace = createBridgeNamespace(new FakeWindow(31));
	const runtime = assertAvailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			electronModule: {
				nativeImage: createNativeImageStatic(),
				remote: electronRemoteNamespace,
			},
			globalScope: {
				electron: {
					remote: hostRemoteNamespace,
				},
			},
			platform: "darwin",
		}),
		),
	);

	assert.equal(runtime.diagnostics.bridgeKind, "electron.remote");
	assert.equal(runtime.currentWindow.id, 21);
});

void test("createDesktopRuntime classifies blocked bridge access as bridge-disabled", () => {
	const currentWindow = new FakeWindow(11);
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			electronModule: {
				nativeImage: createNativeImageStatic(),
				remote: null,
			},
			modules: {
				"@electron/remote": createBridgeNamespace(currentWindow, {
					getBuiltin: (name: string) => {
						throw new Error(`Blocked remote.getBuiltin('${name}')`);
					},
					getCurrentWindow: () => {
						throw new Error("Blocked remote.getCurrentWindow()");
					},
				}),
			},
			platform: "darwin",
		}),
		),
	);

	assert.equal(runtime.diagnostics.bridgeKind, "@electron/remote");
	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "bridge-disabled");
	assert.match(runtime.diagnostics.notes.join(" "), /Blocked remote\.getCurrentWindow\(\)/);
});

void test("createDesktopRuntime classifies generic disabled bridge errors as bridge-disabled", () => {
	const currentWindow = new FakeWindow(11);
	const disabledNamespace = createBridgeNamespace(currentWindow);
	Object.defineProperty(disabledNamespace, "Tray", {
		get(): never {
			throw new Error(
				"Access denied because remote access is disabled for this WebContents.",
			);
		},
	});
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
			createEnvironment({
				electronModule: {
					nativeImage: createNativeImageStatic(),
					remote: null,
				},
				modules: {
					"@electron/remote": disabledNamespace,
				},
				platform: "win32",
			}),
		),
	);

	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "bridge-disabled");
});

void test("createDesktopRuntime reports missing bridge capabilities when required APIs are absent", () => {
	const currentWindow = new FakeWindow(11);
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			electronModule: {
				nativeImage: createNativeImageStatic(),
				remote: null,
			},
			modules: {
				"@electron/remote": createBridgeNamespace(currentWindow, {
					Tray: undefined,
				}),
			},
			platform: "win32",
		}),
		),
	);

	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "bridge-missing-capabilities");
	assert.deepEqual(runtime.diagnostics.missingCapabilities, ["Tray"]);
});

void test("createDesktopRuntime rejects darwin nativeImage fallbacks without createFromPath", () => {
	const currentWindow = new FakeWindow(11);
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
			createEnvironment({
				electronModule: {
					nativeImage: {
						createFromDataURL: () => new FakeNativeImage(),
					},
					remote: null,
				},
				modules: {
					"@electron/remote": createBridgeNamespace(currentWindow, {
						nativeImage: {
							createFromDataURL: () => new FakeNativeImage(),
						},
					}),
				},
				platform: "darwin",
			}),
		),
	);

	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "bridge-missing-capabilities");
	assert.deepEqual(runtime.diagnostics.missingCapabilities, ["nativeImage"]);
});

void test("createDesktopRuntime uses the renderer nativeImage as a fallback when the bridge does not expose one", () => {
	const currentWindow = new FakeWindow(11);
	const rendererNativeImage = createDarwinPathOnlyNativeImage();
	const runtime = assertAvailableRuntime(
		createDesktopRuntime(
		createEnvironment({
			electronModule: {
				nativeImage: rendererNativeImage,
				remote: null,
			},
			modules: {
				"@electron/remote": createBridgeNamespace(currentWindow, {
					nativeImage: undefined,
				}),
			},
			platform: "darwin",
		}),
		),
	);

	assert.equal(runtime.diagnostics.capabilitySources.nativeImage, "renderer-fallback");
	assert.equal(runtime.nativeImage, rendererNativeImage);
});

void test("createDesktopRuntime rejects incomplete BrowserWindow proxies from the bridge", () => {
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
			createEnvironment({
				electronModule: {
					nativeImage: createNativeImageStatic(),
					remote: null,
				},
				modules: {
					"@electron/remote": {
						...createBridgeNamespace(new FakeWindow(21)),
						getCurrentWindow: () => ({
							destroy(): void {},
							hide(): void {},
							id: 21,
							on(): void {},
							removeListener(): void {},
							show(): void {},
							webContents: {
								on(): void {},
								removeListener(): void {},
							},
						}),
					},
				},
				platform: "darwin",
			}),
		),
	);

	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "bridge-missing-capabilities");
	assert.deepEqual(runtime.diagnostics.missingCapabilities, ["getCurrentWindow"]);
});

void test("createDesktopRuntime keeps @electron/remote as the bridge kind when the package is unavailable", () => {
	const runtime = assertUnavailableRuntime(
		createDesktopRuntime(
			createEnvironment({
				electronModule: {
					nativeImage: createNativeImageStatic(),
					remote: null,
				},
				modules: {},
				platform: "darwin",
			}),
		),
	);

	assert.equal(runtime.diagnostics.bridgeKind, "@electron/remote");
	assert.equal(runtime.diagnostics.failureReasonDescriptor?.key, "remote-package-unavailable");
});

function assertAvailableRuntime(
	runtime: ReturnType<typeof createDesktopRuntime>,
): Extract<ReturnType<typeof createDesktopRuntime>, { available: true }> {
	if (!runtime.available) {
		throw new Error("Expected an available desktop runtime.");
	}

	return runtime;
}

function assertUnavailableRuntime(
	runtime: ReturnType<typeof createDesktopRuntime>,
): Extract<ReturnType<typeof createDesktopRuntime>, { available: false }> {
	if (runtime.available) {
		throw new Error("Expected an unavailable desktop runtime.");
	}

	return runtime;
}
