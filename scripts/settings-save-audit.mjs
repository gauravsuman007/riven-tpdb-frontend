/**
 * Does every settings tab actually save?
 *
 * This exists because the answer was once "none of them". Autosave died in
 * the client before a request was built -- `Event currentTarget is not an
 * HTMLFormElement` -- so no POST left the browser. Nothing server-side was
 * wrong, the backend logs no requests, and the page went on claiming
 * "changes save automatically". No unit test could see it: the bug lived in
 * the timing between a DOM event and an async task, and only a real browser
 * driving the real page reproduces that.
 *
 * So this is deliberately end-to-end and deliberately manual: it needs a
 * running instance, which CI does not have. Run it after touching the
 * settings form, the sjsf integration, or any of their dependencies.
 *
 *   node scripts/settings-save-audit.mjs http://<host>:<port>
 *
 * It edits one field per tab, waits for autosave, reloads, and asserts the
 * new value came back from the server -- then puts the value back the same
 * way. Only inert fields are touched.
 *
 * It asserts PERSISTENCE, not "a POST happened". Autosave coalesces
 * deliberately (a burst of typing is one request, and a save that starts
 * while another is in flight waits for it), so counting requests per edit
 * reports failures that are really just batching, and which tab it blames
 * changes from run to run. Whether the value is there after a reload is the
 * only question worth asking.
 *
 * TRAPS, all of which cost time when this was written:
 *  - `waitUntil: "networkidle"` never fires; the page holds a connection open.
 *  - Tab buttons are role="tab", not role="button".
 *  - Field ids are dot-separated (`root.tpdb.cache_max_size_mb`), so they
 *    must be matched with [id="..."] -- `#root.tpdb...` parses as classes.
 *  - Booleans are <button role="checkbox">, not <input>.
 *  - Reverting a text field to "" does NOT clear it: the empty value is
 *    dropped, and the old value survives. Numeric fields are used here
 *    partly for that reason.
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SETTLE_MS = 4000;

/** [tab label, field id, original, probe] -- inert fields only. */
const CASES = [
    ["General", "root.logging.rotation_mb", "10", "11"],
    ["Metadata", "root.tpdb.cache_max_size_mb", "250", "251"],
    ["Content", "root.content.brochure.pages_per_listing", "3", "4"],
    ["Scraping", "root.scraping.after_2", "2", "3"],
    ["Downloaders", "root.downloaders.movie_filesize_mb_min", "50", "51"],
    ["Library", "root.filesystem.library_profiles.example_kids.filter_rules.max_rating", "7.5", "7.4"],
    ["Plugins", "root.direct_scraping.results_per_site", "5", "6"]
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;

try {
    const page = await browser.newPage();
    let seen = [];

    page.on("response", (r) => {
        if (r.request().method() === "POST" && new URL(r.url()).pathname === "/settings") seen.push(r.status());
    });
    page.on("pageerror", (e) => seen.push(`PAGEERROR ${e}`));
    page.on("console", (m) => {
        if (m.type() === "error") seen.push(`CONSOLE ${m.text().slice(0, 120)}`);
    });

    await page.goto(`${BASE}/settings?tab=general`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(7000);

    /** Write a value, let autosave run, then reload and read it back. */
    const roundTrip = async (tab, id, value) => {
        seen = [];
        await page.locator(`[id="${id}"]`).fill(value);
        await page.locator("body").click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(SETTLE_MS);

        await page.goto(`${BASE}/settings?tab=${tab}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(7000);

        return {
            stored: await page.locator(`[id="${id}"]`).inputValue(),
            noise: seen.filter((s) => typeof s === "string")
        };
    };

    for (const [label, id, original, probe] of CASES) {
        const tab = label.toLowerCase();

        try {
            await page.getByRole("tab", { name: label, exact: true }).click();
            await page.waitForTimeout(700);

            const wrote = await roundTrip(tab, id, probe);
            const back = await roundTrip(tab, id, original);

            // Compared as numbers where both are numeric: the server
            // normalises (2 -> 2.0), and that is a correct save, not a
            // mismatch.
            const same = (a, b) =>
                Number.isNaN(Number(a)) || Number.isNaN(Number(b)) ? a === b : Number(a) === Number(b);

            const ok = same(wrote.stored, probe) && same(back.stored, original);

            if (!ok) failures++;
            console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(12)} ${id}`);

            if (!ok) {
                console.log(`        wrote ${probe} -> read back ${wrote.stored}`);
                console.log(`        restored ${original} -> read back ${back.stored}`);
            }

            for (const n of [...wrote.noise, ...back.noise]) console.log(`        ${n}`);
        } catch (err) {
            failures++;
            console.log(`ERROR ${label.padEnd(12)} ${String(err).split("\n")[0]}`);
        }
    }
} finally {
    await browser.close();
}

console.log(failures === 0 ? "\nAll tabs saved." : `\n${failures} tab(s) did not save.`);
process.exit(failures === 0 ? 0 : 1);
