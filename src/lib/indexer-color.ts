/*
    One stable hue per indexer, so a list of releases can be read by source at
    a glance.

    The indexers this deployment actually searches are pinned to hues that sit
    far apart: a plain hash of six names collides often enough that two of them
    would share a colour, which defeats the point. Anything else (an indexer
    added later) falls back to a hash, so it still gets a consistent colour
    across reloads and screens, just not a guaranteed-distinct one.

    Only the hue is returned. Lightness is chosen in CSS per theme, which is
    what keeps the chip above the contrast floor in both light and dark.
*/

const PINNED: Record<string, number> = {
    pornolab: 25,
    "the pirate bay": 215,
    knaben: 150,
    torrentdownload: 280,
    opensharing: 185,
    "torrent-pirat": 330,
    xxxtor: 55,
    xxxclub: 350,
    pornrips: 100,
    pornotorrent: 250,
    sosulki: 305,
    torrentio: 130,
    zilean: 75,
    "kickasstorrents.ws": 5
};

export function indexerHue(name: string): number {
    const key = name.trim().toLowerCase();
    const pinned = PINNED[key];

    if (pinned !== undefined) return pinned;

    // FNV-1a: tiny, and stable across runs, unlike anything seeded.
    let hash = 2166136261;

    for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) % 360;
}
