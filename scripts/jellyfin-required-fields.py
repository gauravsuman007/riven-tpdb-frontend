#!/usr/bin/env python3
"""
Audit our Jellyfin-compatible responses against what the client ACTUALLY requires.

Why this exists: the OpenAPI spec is NOT the authority here -- its `required`
arrays are almost entirely empty, so it will happily tell you a response is
fine when a real client rejects it. jellyfin-android deserializes with
kotlinx.serialization via jellyfin-sdk-kotlin, where a field is required iff
the generated data class declares it WITHOUT a default. A missing key throws
MissingFieldException and aborts playback with no useful client-side error --
which cost a long debugging session discovering one field at a time from
device logcat.

This reads the SDK's generated models directly and diffs them against live
responses, so the whole class of bug can be checked in one shot.

Usage:
    python3 scripts/jellyfin-required-fields.py <base-url> <api-key> [sdk-tag]

The SDK tag should match the `jellyfin-sdk` version in the client's
gradle/libs.versions.toml (v2.7.1 of the Android app used SDK v1.7.1).
"""
import json
import re
import subprocess
import sys
import urllib.request

SDK_REPO = "jellyfin/jellyfin-sdk-kotlin"
MODEL_DIR = "jellyfin-model/src/commonMain/kotlin-generated/org/jellyfin/sdk/model/api"
MODELS = [
    "MediaSourceInfo",
    "UserPolicy",
    "UserConfiguration",
    "DisplayPreferencesDto",
    "PlaybackInfoResponse",
    "UserDto",
    "BaseItemDto",
    "BaseItemDtoQueryResult",
    "AuthenticationResult",
    "PublicSystemInfo",
]


def fetch_model(name: str, tag: str) -> str:
    """Model source via gh, so this works against the API's auth and rate limits."""
    return subprocess.run(
        ["gh", "api", f"repos/{SDK_REPO}/contents/{MODEL_DIR}/{name}.kt?ref={tag}",
         "-H", "Accept: application/vnd.github.raw"],
        capture_output=True, text=True, check=True,
    ).stdout


def required_fields(source: str) -> list[str]:
    """Serialised names of every property declared without a default."""
    match = re.search(r"public data class \w+\s*\(", source)
    if not match:
        return []

    depth, body = 1, []
    for char in source[match.end():]:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                break
        body.append(char)

    return [
        prop.group(1)
        for prop in re.finditer(
            r'@SerialName\("([^"]+)"\)\s*(?:@[^\n]*\s*)*public val \w+:\s*'
            r"([^,\n]+?)(\s*=\s*[^,\n]+)?,?\s*(?=@SerialName|\Z)",
            "".join(body),
        )
        if prop.group(3) is None
    ]


def get(base: str, path: str, key: str, method: str = "GET") -> dict:
    request = urllib.request.Request(
        f"{base}{path}", method=method, headers={"X-Emby-Token": key}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2

    base, key = sys.argv[1].rstrip("/"), sys.argv[2]
    tag = sys.argv[3] if len(sys.argv) > 3 else "v1.7.1"

    required = {name: required_fields(fetch_model(name, tag)) for name in MODELS}

    user = get(base, "/Users/Me", key)
    items = get(base, "/Users/726976656e7470646200000000000002/Items?Limit=1", key)
    first = items["Items"][0]
    playback = get(base, f"/Items/{first['Id']}/PlaybackInfo", key, method="POST")

    checks = [
        ("UserDto", user),
        ("UserConfiguration", user.get("Configuration", {})),
        ("UserPolicy", user.get("Policy", {})),
        ("DisplayPreferencesDto", get(base, "/DisplayPreferences/usersettings", key)),
        ("PublicSystemInfo", get(base, "/System/Info/Public", key)),
        ("BaseItemDtoQueryResult", items),
        ("BaseItemDto", first),
        ("PlaybackInfoResponse", playback),
        ("MediaSourceInfo", playback["MediaSources"][0]),
    ]

    failed = False
    for name, payload in checks:
        missing = [field for field in required.get(name, []) if field not in payload]
        if missing:
            failed = True
        print(f"{name}: {'MISSING ' + str(missing) if missing else 'OK'}")

    print("\nGAPS REMAIN" if failed else "\nAll required fields present.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
