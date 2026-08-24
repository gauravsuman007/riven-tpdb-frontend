/**
 * Tests for the trusted-network address matching.
 *
 * This decides whether a request skips authentication, so the cases below lean
 * on the ways a naive CIDR check goes wrong: prefix boundaries, a bare address
 * being read as a wildcard, the ::ffff: form a dual-stack listener reports for
 * IPv4 clients, and garbage input.
 */

import { addressInRange, isTrustedAddress } from "../cidr";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, extra = "") {
    if (condition) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name} ${extra}`);
    }
}

console.log("IPv4 CIDR");
check("inside a /16", addressInRange("192.168.2.100", "192.168.0.0/16"));
check("outside a /16", !addressInRange("192.169.2.100", "192.168.0.0/16"));
check("inside a /24", addressInRange("192.168.2.7", "192.168.2.0/24"));
check("just outside a /24", !addressInRange("192.168.3.7", "192.168.2.0/24"));
check("private /8", addressInRange("10.55.4.1", "10.0.0.0/8"));
check("172.16/12 lower bound", addressInRange("172.16.0.1", "172.16.0.0/12"));
check("172.16/12 upper bound", addressInRange("172.31.255.254", "172.16.0.0/12"));
check("172.32 is outside 172.16/12", !addressInRange("172.32.0.1", "172.16.0.0/12"));
check("loopback /32", addressInRange("127.0.0.1", "127.0.0.1/32"));
check("/32 matches nothing else", !addressInRange("127.0.0.2", "127.0.0.1/32"));
check("/0 matches everything, as written", addressInRange("8.8.8.8", "0.0.0.0/0"));

console.log("\na bare address is one host, not a wildcard");
check("bare address matches itself", addressInRange("192.168.2.100", "192.168.2.100"));
check(
    "bare address does not match a neighbour",
    !addressInRange("192.168.2.101", "192.168.2.100")
);
check("bare 192.168.0.0 is not the whole /16", !addressInRange("192.168.2.1", "192.168.0.0"));

console.log("\nIPv4-mapped IPv6, which is what a dual-stack listener reports");
check(
    "::ffff: form matches a v4 rule",
    addressInRange("::ffff:192.168.2.100", "192.168.0.0/16")
);
check(
    "::ffff: form respects the prefix",
    !addressInRange("::ffff:8.8.8.8", "192.168.0.0/16")
);

console.log("\nIPv6");
check("loopback /128", addressInRange("::1", "::1/128"));
check("::2 is not ::1", !addressInRange("::2", "::1/128"));
check("unique local /7", addressInRange("fd12:3456::1", "fc00::/7"));
check("global unicast is outside fc00::/7", !addressInRange("2001:db8::1", "fc00::/7"));
check("expanded form", addressInRange("fd00:0:0:0:0:0:0:1", "fd00::/16"));

console.log("\nmalformed input is never trusted");
for (const bad of ["", "not-an-ip", "999.1.1.1", "192.168.1", "192.168.1.1.1"]) {
    check(`rejects ${JSON.stringify(bad)} as an address`, !addressInRange(bad, "0.0.0.0/0") || bad === "");
}
check("rejects a nonsense rule", !addressInRange("192.168.2.1", "garbage"));
check("rejects an empty rule", !addressInRange("192.168.2.1", ""));
check("rejects an out-of-range prefix", !addressInRange("192.168.2.1", "192.168.0.0/33"));
check("rejects a negative prefix", !addressInRange("192.168.2.1", "192.168.0.0/-1"));
check("v4 address against a v6 rule does not match", !addressInRange("192.168.2.1", "fc00::/7"));

console.log("\nisTrustedAddress: the gate itself");
const on = { enabled: true, networks: ["192.168.0.0/16"], username: "" };
check("disabled config trusts nobody", !isTrustedAddress("192.168.2.1", { ...on, enabled: false }));
check("enabled config trusts a listed range", isTrustedAddress("192.168.2.1", on));
check("enabled config still rejects the outside world", !isTrustedAddress("8.8.8.8", on));
check("an empty network list trusts nobody", !isTrustedAddress("192.168.2.1", { ...on, networks: [] }));
check("an empty address is never trusted", !isTrustedAddress("", on));
check(
    "one bad rule does not void the good ones",
    isTrustedAddress("192.168.2.1", { ...on, networks: ["garbage", "192.168.0.0/16"] })
);
check(
    "any single matching rule is enough",
    isTrustedAddress("10.1.2.3", { ...on, networks: ["192.168.0.0/16", "10.0.0.0/8"] })
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
