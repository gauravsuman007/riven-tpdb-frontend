/**
 * The app PIN: state, verification, and the "is it locked right now" rule.
 *
 * See `schema/app-lock.ts` for what this is and is not. In short: a
 * lockscreen, not an auth factor.
 *
 * The important design point is that locking is decided and ENFORCED on the
 * server (`hooks.server.ts` redirects a locked session to /lock before any
 * page load runs), so a locked browser is never sent the content it is
 * hiding. A client-side overlay alone would leave the data in the DOM, one
 * devtools panel -- or one slow paint -- away from being read.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

import { db } from "./db";
import { appLock } from "./schema";

/** Four digits, exactly. Enforced here so every caller agrees on the shape. */
export const PIN_PATTERN = /^\d{4}$/;

const DEFAULT_TIMEOUT_MINUTES = 10;

export interface LockState {
    enabled: boolean;
    hasPin: boolean;
    timeoutMinutes: number;
    lastActiveAt: Date;
}

function hashPin(pin: string, salt: string): string {
    // scrypt with the default cost. Four digits is a 10,000-entry space, so
    // this cannot resist an offline attack and is not meant to -- it stops a
    // casual read of the database, a backup or a log from handing over a code
    // that gets typed in front of other people.
    return scryptSync(pin, salt, 32).toString("hex");
}

function encode(pin: string): string {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${hashPin(pin, salt)}`;
}

function matches(pin: string, stored: string | null): boolean {
    if (!stored) return false;

    const [salt, expected] = stored.split(":");

    if (!salt || !expected) return false;

    const actual = hashPin(pin, salt);

    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, which would turn a malformed row into a 500.
    if (actual.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function row(userId: string) {
    return db.select().from(appLock).where(eq(appLock.userId, userId)).get();
}

export function getLockState(userId: string): LockState {
    const record = row(userId);

    if (!record) {
        return {
            enabled: false,
            hasPin: false,
            timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
            lastActiveAt: new Date()
        };
    }

    return {
        enabled: record.enabled && !!record.pinHash,
        hasPin: !!record.pinHash,
        timeoutMinutes: record.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES,
        lastActiveAt: record.lastActiveAt
    };
}

/**
 * Whether this user's session should be showing the lock screen.
 *
 * Returns false when no PIN is set, which is what makes the whole feature
 * inert until someone opts in -- there is no state in which this can lock a
 * user out of an app they never configured.
 */
export function isLocked(userId: string | undefined): boolean {
    if (!userId) return false;

    const state = getLockState(userId);

    if (!state.enabled) return false;

    const idleMs = Date.now() - state.lastActiveAt.getTime();

    return idleMs >= state.timeoutMinutes * 60_000;
}

/**
 * Record that a person did something, or that playback advanced.
 *
 * NOT called from ordinary request handling. Riven's pages poll constantly --
 * the dashboard, the event stream, progress reporting -- so a clock driven by
 * requests would never run down and the lock would never engage. Only the
 * explicit beacon and playback progress call this.
 */
export function recordActivity(userId: string | undefined): void {
    if (!userId) return;

    const now = new Date();

    db.insert(appLock)
        .values({ userId, lastActiveAt: now })
        .onConflictDoUpdate({ target: appLock.userId, set: { lastActiveAt: now } })
        .run();
}

/** Locks immediately, without waiting for the timeout. */
export function lockNow(userId: string): void {
    const past = new Date(0);

    db.insert(appLock)
        .values({ userId, lastActiveAt: past })
        .onConflictDoUpdate({ target: appLock.userId, set: { lastActiveAt: past } })
        .run();
}

export function setPin(userId: string, pin: string, timeoutMinutes: number): void {
    if (!PIN_PATTERN.test(pin)) throw new Error("PIN must be exactly four digits");

    const minutes = Math.max(1, Math.min(240, Math.floor(timeoutMinutes) || DEFAULT_TIMEOUT_MINUTES));
    const now = new Date();

    db.insert(appLock)
        .values({ userId, pinHash: encode(pin), enabled: true, timeoutMinutes: minutes, lastActiveAt: now })
        .onConflictDoUpdate({
            target: appLock.userId,
            // lastActiveAt is reset too: setting a PIN should not leave you
            // instantly locked out by an idle clock from before it existed.
            set: { pinHash: encode(pin), enabled: true, timeoutMinutes: minutes, lastActiveAt: now }
        })
        .run();
}

export function clearPin(userId: string): void {
    db.insert(appLock)
        .values({ userId, pinHash: null, enabled: false, lastActiveAt: new Date() })
        .onConflictDoUpdate({
            target: appLock.userId,
            set: { pinHash: null, enabled: false, lastActiveAt: new Date() }
        })
        .run();
}

/** Verify a PIN and, on success, start the idle clock again. */
export function unlock(userId: string, pin: string): boolean {
    const record = row(userId);

    if (!record || !matches(pin, record.pinHash)) return false;

    recordActivity(userId);

    return true;
}
