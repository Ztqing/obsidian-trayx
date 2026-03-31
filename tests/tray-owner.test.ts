import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
	TRAY_OWNER_STORAGE_KEY,
	claimTrayOwnership,
	createTrayOwnerSnapshot,
	releaseTrayOwnership,
	syncTrayOwnership,
} from "../src/tray/owner";
import { FakeStorageApp } from "./helpers/fakes";

void test("syncTrayOwnership claims the current window when no owner is stored", () => {
	const storage = new FakeStorageApp();

	const snapshot = syncTrayOwnership(storage, 5, new Set([5]), () => 1234);

	assert.deepEqual(snapshot, {
		currentWindowId: 5,
		isTrayOwner: true,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: 5,
	});
	assert.deepEqual(storage.loadLocalStorage(TRAY_OWNER_STORAGE_KEY), {
		ownerWindowId: 5,
		schemaVersion: 1,
		updatedAt: 1234,
	});
});

void test("syncTrayOwnership preserves a live previous owner from another window", () => {
	const storage = new FakeStorageApp();
	storage.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, {
		ownerWindowId: 7,
		schemaVersion: 1,
		updatedAt: 1111,
	});

	const snapshot = syncTrayOwnership(storage, 5, new Set([5, 7]), () => 2222);

	assert.deepEqual(snapshot, {
		currentWindowId: 5,
		isTrayOwner: false,
		previousTrayOwnerDetected: true,
		trayOwnerWindowId: 7,
	});
	assert.deepEqual(storage.loadLocalStorage(TRAY_OWNER_STORAGE_KEY), {
		ownerWindowId: 7,
		schemaVersion: 1,
		updatedAt: 1111,
	});
});

void test("syncTrayOwnership replaces a stale owner with the current window", () => {
	const storage = new FakeStorageApp();
	storage.saveLocalStorage(TRAY_OWNER_STORAGE_KEY, {
		ownerWindowId: 7,
		schemaVersion: 1,
		updatedAt: 1111,
	});

	const snapshot = syncTrayOwnership(storage, 5, new Set([5]), () => 2222);

	assert.deepEqual(snapshot, {
		currentWindowId: 5,
		isTrayOwner: true,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: 5,
	});
	assert.deepEqual(storage.loadLocalStorage(TRAY_OWNER_STORAGE_KEY), {
		ownerWindowId: 5,
		schemaVersion: 1,
		updatedAt: 2222,
	});
});

void test("releaseTrayOwnership only clears storage when the current window owns the tray", () => {
	const storage = new FakeStorageApp();
	const ownedSnapshot = claimTrayOwnership(storage, 5, () => 1234);

	const released = releaseTrayOwnership(storage, ownedSnapshot);

	assert.deepEqual(released, {
		currentWindowId: 5,
		isTrayOwner: false,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: null,
	});
	assert.equal(storage.loadLocalStorage(TRAY_OWNER_STORAGE_KEY), null);

	const untouched = releaseTrayOwnership(storage, createTrayOwnerSnapshot(9));
	assert.deepEqual(untouched, {
		currentWindowId: 9,
		isTrayOwner: false,
		previousTrayOwnerDetected: false,
		trayOwnerWindowId: null,
	});
});
