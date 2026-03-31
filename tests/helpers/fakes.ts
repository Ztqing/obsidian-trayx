import type {
	ElectronApp,
	ElectronEventEmitter,
	ElectronWebContents,
	ElectronWindow,
	LoginItemSettings,
} from "../../src/runtime/electron";
import type { TrayXSettings } from "../../src/settings";
import type {
	SettingControlLike,
	SettingsContainerLike,
	ToggleControlLike,
} from "../../src/ui/settings-renderer";

type Listener = (...args: unknown[]) => void;

export class FakeEventEmitter implements ElectronEventEmitter {
	private readonly listeners = new Map<string, Set<Listener>>();

	on(eventName: string, listener: Listener): void {
		this.getListeners(eventName).add(listener);
	}

	once(eventName: string, listener: Listener): void {
		const onceListener: Listener = (...args: unknown[]) => {
			this.removeListener(eventName, onceListener);
			listener(...args);
		};
		this.on(eventName, onceListener);
	}

	removeListener(eventName: string, listener: Listener): void {
		this.listeners.get(eventName)?.delete(listener);
	}

	emit(eventName: string, ...args: unknown[]): void {
		for (const listener of this.listeners.get(eventName) ?? []) {
			listener(...args);
		}
	}

	listenerCount(eventName: string): number {
		return this.listeners.get(eventName)?.size ?? 0;
	}

	private getListeners(eventName: string): Set<Listener> {
		let listeners = this.listeners.get(eventName);
		if (!listeners) {
			listeners = new Set<Listener>();
			this.listeners.set(eventName, listeners);
		}

		return listeners;
	}
}

export class FakeWebContents extends FakeEventEmitter implements ElectronWebContents {}

export class FakeWindow extends FakeEventEmitter implements ElectronWindow {
	readonly webContents = new FakeWebContents();
	focusCount = 0;
	hideCount = 0;
	maximizeCount = 0;
	minimizeCount = 0;
	restoreCount = 0;
	setFullScreenCalls: boolean[] = [];
	setSimpleFullScreenCalls: boolean[] = [];
	showCount = 0;
	skipTaskbarStates: boolean[] = [];
	private destroyed = false;
	private focused = false;
	private maximized = false;
	private minimized = false;
	private simpleFullScreen = false;
	private fullScreen = false;
	private visible = true;

	constructor(readonly id: number) {
		super();
	}

	blur(): void {
		this.focused = false;
	}

	destroy(): void {
		this.destroyed = true;
		this.emit("closed");
	}

	focus(): void {
		this.focusCount += 1;
		this.focused = true;
		this.emit("focus");
	}

	hide(): void {
		this.hideCount += 1;
		this.visible = false;
	}

	isDestroyed(): boolean {
		return this.destroyed;
	}

	isFocused(): boolean {
		return this.focused;
	}

	isFullScreen(): boolean {
		return this.fullScreen;
	}

	isMaximized(): boolean {
		return this.maximized;
	}

	isMinimized(): boolean {
		return this.minimized;
	}

	isSimpleFullScreen(): boolean {
		return this.simpleFullScreen;
	}

	isVisible(): boolean {
		return this.visible;
	}

	maximize(): void {
		this.maximizeCount += 1;
		this.maximized = true;
	}

	minimize(): void {
		this.minimizeCount += 1;
		this.minimized = true;
		this.visible = true;
	}

	restore(): void {
		this.restoreCount += 1;
		this.minimized = false;
		this.visible = true;
	}

	setFullScreen(fullScreen: boolean): void {
		this.setFullScreenCalls.push(fullScreen);
		this.fullScreen = fullScreen;
	}

	setMaximized(maximized: boolean): void {
		this.maximized = maximized;
	}

	setMinimized(minimized: boolean): void {
		this.minimized = minimized;
	}

	setSimpleFullScreen(fullScreen: boolean): void {
		this.setSimpleFullScreenCalls.push(fullScreen);
		this.simpleFullScreen = fullScreen;
	}

	setSkipTaskbar(skip: boolean): void {
		this.skipTaskbarStates.push(skip);
	}

	setVisible(visible: boolean): void {
		this.visible = visible;
	}

	show(): void {
		this.showCount += 1;
		this.visible = true;
	}
}

export class FakeApp extends FakeEventEmitter implements ElectronApp {
	readonly dock = {
		hide: (): void => {
			this.dockHideCount += 1;
		},
		show: (): void => {
			this.dockShowCount += 1;
		},
	};
	dockHideCount = 0;
	dockShowCount = 0;
	exitCalls: number[] = [];
	hideCalls = 0;
	loginItemSettingsCalls: LoginItemSettings[] = [];
	quitCalls = 0;
	relaunchCalls = 0;
	showCalls = 0;

	exit(exitCode?: number): void {
		this.exitCalls.push(exitCode ?? 0);
	}

	hide(): void {
		this.hideCalls += 1;
	}

	quit(): void {
		this.quitCalls += 1;
	}

	relaunch(): void {
		this.relaunchCalls += 1;
	}

	setLoginItemSettings(settings: LoginItemSettings): void {
		this.loginItemSettingsCalls.push(settings);
	}

	show(): void {
		this.showCalls += 1;
	}
}

export class FakeStorageApp {
	readonly storage = new Map<string, unknown>();

	loadLocalStorage(key: string): unknown {
		return this.storage.get(key) ?? null;
	}

	saveLocalStorage(key: string, value: unknown): void {
		if (value === null) {
			this.storage.delete(key);
			return;
		}

		this.storage.set(key, value);
	}
}

export class FakePluginApp extends FakeStorageApp {
	readonly vault = {
		getName: (): string => "Demo Vault",
	};
}

export class FakeTimerController {
	private readonly timers = new Map<number, () => void>();
	private nextId = 1;

	setTimeout(callback: () => void): number {
		const id = this.nextId++;
		this.timers.set(id, callback);
		return id;
	}

	clearTimeout(timerId: number): void {
		this.timers.delete(timerId);
	}

	runAll(): void {
		for (const [timerId, callback] of [...this.timers.entries()]) {
			this.timers.delete(timerId);
			callback();
		}
	}

	pendingCount(): number {
		return this.timers.size;
	}
}

export class FakeDomWindow {
	private readonly listeners = new Set<(event: BeforeUnloadEventLike) => void>();

	addEventListener(
		eventName: "beforeunload",
		listener: (event: BeforeUnloadEventLike) => void,
	): void {
		if (eventName === "beforeunload") {
			this.listeners.add(listener);
		}
	}

	removeEventListener(
		eventName: "beforeunload",
		listener: (event: BeforeUnloadEventLike) => void,
	): void {
		if (eventName === "beforeunload") {
			this.listeners.delete(listener);
		}
	}

	dispatchBeforeUnload(event: BeforeUnloadEventLike): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	listenerCount(): number {
		return this.listeners.size;
	}
}

export interface BeforeUnloadEventLike {
	defaultPrevented: boolean;
	returnValue?: unknown;
	stopImmediatePropagationCalled: boolean;
	preventDefault(): void;
	stopImmediatePropagation(): void;
}

export function createBeforeUnloadEvent(): BeforeUnloadEventLike {
	return {
		defaultPrevented: false,
		stopImmediatePropagationCalled: false,
		preventDefault(): void {
			this.defaultPrevented = true;
		},
		stopImmediatePropagation(): void {
			this.stopImmediatePropagationCalled = true;
		},
	};
}

export interface FakeCommandRegistration {
	callback: () => void;
	id: string;
	name: string;
}

export class FakeCommandPlugin {
	readonly commands: FakeCommandRegistration[] = [];
	readonly calls: string[] = [];

	addCommand(command: FakeCommandRegistration): void {
		this.commands.push(command);
	}

	closeVault(): void {
		this.calls.push("closeVault");
	}

	hideVault(): void {
		this.calls.push("hideVault");
	}

	relaunchApp(): void {
		this.calls.push("relaunchApp");
	}

	showRuntimeDiagnostics(): void {
		this.calls.push("showRuntimeDiagnostics");
	}

	showVault(): void {
		this.calls.push("showVault");
	}

	toggleVaultVisibility(): void {
		this.calls.push("toggleVaultVisibility");
	}
}

export class FakeSettingsContainer implements SettingsContainerLike {
	emptyCalls = 0;

	empty(): void {
		this.emptyCalls += 1;
	}
}

export class FakeToggleControl implements ToggleControlLike {
	onChangeHandler: ((value: boolean) => Promise<void> | void) | null = null;
	value = false;

	onChange(callback: (value: boolean) => Promise<void> | void): this {
		this.onChangeHandler = callback;
		return this;
	}

	setValue(value: boolean): this {
		this.value = value;
		return this;
	}

	async trigger(value: boolean): Promise<void> {
		await this.onChangeHandler?.(value);
	}
}

export class FakeSettingControl implements SettingControlLike {
	description = "";
	name = "";
	readonly toggle = new FakeToggleControl();

	addToggle(configure: (toggle: ToggleControlLike) => void): this {
		configure(this.toggle);
		return this;
	}

	setDesc(description: string): this {
		this.description = description;
		return this;
	}

	setName(name: string): this {
		this.name = name;
		return this;
	}
}

export class FakeSettingFactory {
	readonly controls: FakeSettingControl[] = [];

	createSetting(_containerEl: SettingsContainerLike): SettingControlLike {
		const control = new FakeSettingControl();
		this.controls.push(control);
		return control;
	}
}

export class FakeSettingsPlugin {
	readonly settings: TrayXSettings;
	readonly updates: Array<{ key: keyof TrayXSettings; value: boolean }> = [];

	constructor(settings: TrayXSettings) {
		this.settings = settings;
	}

	async updateSetting<Key extends keyof TrayXSettings>(
		key: Key,
		value: TrayXSettings[Key],
	): Promise<void> {
		this.updates.push({ key, value });
		this.settings[key] = value;
	}
}

export class FakeNoticeSink {
	readonly notices: Array<{ message: string; timeout?: number }> = [];

	show(message: string, timeout?: number): void {
		this.notices.push({ message, timeout });
	}
}
