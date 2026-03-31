import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
	canHideAppIconSafely,
	canRecoverFromHiddenState,
	getRestorePathAvailability,
	getRuntimeMode,
} from "../src/tray/restore-policy";

void test("restore policy prefers an active tray or another live tray owner", () => {
	assert.equal(
		getRestorePathAvailability({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: true,
			trayOwnerWindowId: 5,
		}),
		"tray",
	);

	assert.equal(
		getRestorePathAvailability({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: false,
			trayOwnerWindowId: 9,
		}),
		"tray",
	);
});

void test("restore policy falls back to dock and then none", () => {
	assert.equal(
		getRestorePathAvailability({
			canUseDockRestore: true,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: false,
			trayOwnerWindowId: 5,
		}),
		"dock",
	);

	assert.equal(
		getRestorePathAvailability({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: false,
			trayOwnerWindowId: 5,
		}),
		"none",
	);
});

void test("restore policy exposes safe-hide and app-icon decisions", () => {
	const trayInput = {
		canUseDockRestore: false,
		currentWindowId: 5,
		runInBackground: true,
		runtimeAvailable: true,
		trayCreated: true,
		trayOwnerWindowId: 5,
	};
	const noneInput = {
		canUseDockRestore: false,
		currentWindowId: 5,
		runInBackground: true,
		runtimeAvailable: true,
		trayCreated: false,
		trayOwnerWindowId: 5,
	};

	assert.equal(canRecoverFromHiddenState(trayInput), true);
	assert.equal(canHideAppIconSafely(trayInput), true);
	assert.equal(canRecoverFromHiddenState(noneInput), false);
	assert.equal(canHideAppIconSafely(noneInput), false);
});

void test("runtime mode reflects bridge availability and safe-close fallbacks", () => {
	assert.equal(
		getRuntimeMode({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: false,
			trayCreated: false,
			trayOwnerWindowId: null,
		}),
		"bridge-unavailable",
	);

	assert.equal(
		getRuntimeMode({
			canUseDockRestore: true,
			currentWindowId: 5,
			runInBackground: false,
			runtimeAvailable: true,
			trayCreated: false,
			trayOwnerWindowId: null,
		}),
		"foreground-only",
	);

	assert.equal(
		getRuntimeMode({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: false,
			trayOwnerWindowId: null,
		}),
		"safe-close-disabled",
	);

	assert.equal(
		getRuntimeMode({
			canUseDockRestore: false,
			currentWindowId: 5,
			runInBackground: true,
			runtimeAvailable: true,
			trayCreated: true,
			trayOwnerWindowId: 5,
		}),
		"full",
	);
});
