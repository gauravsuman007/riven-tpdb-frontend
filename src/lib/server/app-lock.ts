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

/**
 * Which surface a request belongs to.
 *
 * "frontend" is the UI and this app's own routes; "backend" is the proxied
 * Riven API. They lock independently because they protect different things:
 * hiding what is on screen is the usual want, and cutting off the API as well
 * is a separate, stricter decision.
 */
export type LockScope = "frontend" | "backend";

export interface LockState {
    enabled: boolean;
    hasPin: boolean;
    timeoutMinutes: number;
    lastActiveAt: Date;
    lockFrontend: boolean;
    lockBackend: boolean;
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
            lastActiveAt: new Date(),
            lockFrontend: true,
            lockBackend: false
        };
    }

    return {
        enabled: record.enabled && !!record.pinHash,
        hasPin: !!record.pinHash,
        timeoutMinutes: record.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES,
        lastActiveAt: record.lastActiveAt,
        lockFrontend: record.lockFrontend,
        lockBackend: record.lockBackend
    };
}

/**
 * Whether this user's session should be showing the lock screen.
 *
 * Returns false when no PIN is set, which is what makes the whole feature
 * inert until someone opts in -- there is no state in which this can lock a
 * user out of an app they never configured.
 */
export function isLocked(userId: string | undefined, scope: LockScope = "frontend"): boolean {
    if (!userId) return false;

    const state = getLockState(userId);

    if (!state.enabled) return false;

    // A scope that was not selected is never locked, even once the idle clock
    // has run out. This is what makes "lock the screen but leave the API
    // alone" -- the common case -- a real configuration rather than a
    // half-applied one.
    if (scope === "frontend" && !state.lockFrontend) return false;
    if (scope === "backend" && !state.lockBackend) return false;

    const idleMs = Date.now() - state.lastActiveAt.getTime();

    return idleMs >= state.timeoutMinutes * 60_000;
}

/** Whether anything at all would lock, used to decide if the client guard runs. */
export function anyScopeLocks(userId: string | undefined): boolean {
    if (!userId) return false;

    const state = getLockState(userId);

    return state.enabled && (state.lockFrontend || state.lockBackend);
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

export function setPin(
    userId: string,
    pin: string,
    timeoutMinutes: number,
    scopes?: { lockFrontend?: boolean; lockBackend?: boolean }
): void {
    if (!PIN_PATTERN.test(pin)) throw new Error("PIN must be exactly four digits");

    const minutes = Math.max(1, Math.min(240, Math.floor(timeoutMinutes) || DEFAULT_TIMEOUT_MINUTES));
    const now = new Date();

    // Undefined means "leave as it is" on an update, so a caller changing only
    // the PIN cannot silently reset which surfaces are covered. On insert the
    // column defaults apply.
    const scopeFields = {
        ...(scopes?.lockFrontend === undefined ? {} : { lockFrontend: scopes.lockFrontend }),
        ...(scopes?.lockBackend === undefined ? {} : { lockBackend: scopes.lockBackend })
    };

    db.insert(appLock)
        .values({
            userId,
            pinHash: encode(pin),
            enabled: true,
            timeoutMinutes: minutes,
            lastActiveAt: now,
            lockFrontend: scopes?.lockFrontend ?? true,
            lockBackend: scopes?.lockBackend ?? false
        })
        .onConflictDoUpdate({
            target: appLock.userId,
            // lastActiveAt is reset too: setting a PIN should not leave you
            // instantly locked out by an idle clock from before it existed.
            set: {
                pinHash: encode(pin),
                enabled: true,
                timeoutMinutes: minutes,
                lastActiveAt: now,
                ...scopeFields
            }
        })
        .run();
}

/**
 * Change which surfaces are covered, without retyping the PIN.
 *
 * A no-op when no PIN exists: the scopes are meaningless on their own, and
 * writing a row for a user who never configured a lock would make
 * `getLockState` report a configuration that does not exist.
 */
export function setScopes(
    userId: string,
    scopes: { lockFrontend?: boolean; lockBackend?: boolean }
): boolean {
    const record = row(userId);

    if (!record?.pinHash) return false;

    db.update(appLock)
        .set({
            ...(scopes.lockFrontend === undefined ? {} : { lockFrontend: scopes.lockFrontend }),
            ...(scopes.lockBackend === undefined ? {} : { lockBackend: scopes.lockBackend })
        })
        .where(eq(appLock.userId, userId))
        .run();

    return true;
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
