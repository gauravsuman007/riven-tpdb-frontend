/**
 * CIDR matching for the trusted-network login bypass.
 *
 * Kept free of SvelteKit imports so it can be exercised directly: this code
 * decides whether a request skips authentication, and a rule that is only ever
 * tested through a running server is a rule that is not really tested.
 */

export type LocalAccessConfig = {
    enabled: boolean;
    networks: string[];
    username: string;
};

/** Expand an IPv4 dotted quad to a 32-bit integer, or null if it is not one. */
function ipv4ToInt(address: string): number | null {
    const parts = address.split(".");
    if (parts.length !== 4) return null;

    let value = 0;

    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const octet = Number(part);
        if (octet > 255) return null;
        value = value * 256 + octet;
    }

    return value;
}

/** Expand an IPv6 address to its 16 bytes, or null if it is not one. */
function ipv6ToBytes(address: string): Uint8Array | null {
    // An IPv4-mapped address (::ffff:192.168.1.5) is what a dual-stack listener
    // reports for a plain IPv4 client, so it has to resolve to the IPv4 bytes
    // or every rule written as a v4 CIDR would silently never match.
    const embedded = address.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
    let text = address;

    if (embedded) {
        const v4 = ipv4ToInt(embedded[2]);
        if (v4 === null) return null;
        const hex = v4.toString(16).padStart(8, "0");
        text = `${embedded[1]}${hex.slice(0, 4)}:${hex.slice(4)}`;
    }

    if (!/^[0-9a-fA-F:]+$/.test(text)) return null;

    const halves = text.split("::");
    if (halves.length > 2) return null;

    const parse = (part: string) =>
        part.length ? part.split(":").map((group) => parseInt(group, 16)) : [];

    const head = parse(halves[0]);
    const tail = halves.length === 2 ? parse(halves[1]) : [];

    if (head.some(Number.isNaN) || tail.some(Number.isNaN)) return null;

    const groups =
        halves.length === 2
            ? [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail]
            : head;

    if (groups.length !== 8 || groups.some((g) => g < 0 || g > 0xffff)) return null;

    const bytes = new Uint8Array(16);
    groups.forEach((group, i) => {
        bytes[i * 2] = group >> 8;
        bytes[i * 2 + 1] = group & 0xff;
    });

    return bytes;
}

/** Whether `address` falls inside `rule`, which is a CIDR or a bare address. */
export function addressInRange(address: string, rule: string): boolean {
    const [network, prefixText] = rule.trim().split("/");
    if (!network) return false;

    const clientV4 = ipv4ToInt(stripV4Mapping(address));
    const ruleV4 = ipv4ToInt(network);

    if (clientV4 !== null && ruleV4 !== null) {
        // A bare address is a single host, which is /32 -- not "match anything".
        const prefix = prefixText === undefined ? 32 : Number(prefixText);
        if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
        if (prefix === 0) return true;

        // Shifting by 32 is a no-op in JS, hence the /0 case above.
        const mask = (0xffffffff << (32 - prefix)) >>> 0;
        return (clientV4 & mask) >>> 0 === (ruleV4 & mask) >>> 0;
    }

    const clientV6 = ipv6ToBytes(address);
    const ruleV6 = ipv6ToBytes(network);

    if (clientV6 && ruleV6) {
        const prefix = prefixText === undefined ? 128 : Number(prefixText);
        if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return false;

        for (let bit = 0; bit < prefix; bit += 8) {
            const byte = bit >> 3;
            const bits = Math.min(8, prefix - bit);
            const mask = (0xff << (8 - bits)) & 0xff;
            if ((clientV6[byte] & mask) !== (ruleV6[byte] & mask)) return false;
        }

        return true;
    }

    return false;
}

/** Drop the ::ffff: prefix a dual-stack listener puts on IPv4 clients. */
function stripV4Mapping(address: string): string {
    const match = address.match(/^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i);
    return match ? match[1] : address;
}

/** Whether this client address is covered by any configured range. */
export function isTrustedAddress(address: string, config: LocalAccessConfig): boolean {
    if (!config.enabled || !address) return false;
    return config.networks.some((rule) => rule && addressInRange(address, rule));
}
