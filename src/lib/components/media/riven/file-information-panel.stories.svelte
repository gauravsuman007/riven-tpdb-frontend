<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import FileInformationPanel from "./file-information-panel.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "media/riven/FileInformationPanel",
        component: FileInformationPanel,
        tags: ["autodocs"],
        args: {
            entries: [
                {
                    id: 1,
                    file_size: 15461882265,
                    original_filename:
                        "John.Wick.Chapter.4.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.DTS-HD.MA.7.1.mkv",
                    provider: "realdebrid",
                    ranking_profile_name: "4k_remux",
                    media_metadata: {
                        filename:
                            "John.Wick.Chapter.4.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.DTS-HD.MA.7.1.mkv",
                        duration: 8520,
                        bitrate: 45000000,
                        video: {
                            resolution_width: 3840,
                            resolution_height: 2160,
                            codec: "HEVC",
                            bit_depth: 10,
                            hdr_type: "HDR10",
                            frame_rate: 23.976
                        },
                        audio_tracks: [{ codec: "TrueHD", channels: 8, language: "en" }],
                        subtitle_tracks: [{ language: "en" }, { language: "fr" }],
                        quality_source: "BluRay",
                        is_remux: true,
                        container_format: ["mkv"]
                    }
                }
            ],
            fallbackMediaMetadata: undefined,
            selectedIndex: 0,
            onDeleteEntry: fn()
        }
    });
</script>

<Story name="SingleVersion" />

<Story
    name="MultipleVersions"
    args={{
        entries: [
            {
                id: 1,
                file_size: 15461882265,
                original_filename:
                    "John.Wick.Chapter.4.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.DTS-HD.MA.7.1.mkv",
                provider: "realdebrid",
                ranking_profile_name: "4k_remux",
                media_metadata: {
                    filename:
                        "John.Wick.Chapter.4.2023.2160p.UHD.BluRay.REMUX.HDR.HEVC.DTS-HD.MA.7.1.mkv",
                    duration: 8520,
                    bitrate: 45000000,
                    video: {
                        resolution_width: 3840,
                        resolution_height: 2160,
                        codec: "HEVC",
                        bit_depth: 10,
                        hdr_type: "HDR10",
                        frame_rate: 23.976
                    },
                    audio_tracks: [{ codec: "TrueHD", channels: 8, language: "en" }],
                    subtitle_tracks: [{ language: "en" }, { language: "fr" }],
                    quality_source: "BluRay",
                    is_remux: true,
                    container_format: ["mkv"]
                }
            },
            {
                id: 2,
                file_size: 4294967296,
                original_filename: "John.Wick.Chapter.4.2023.1080p.WEB-DL.x264.mkv",
                provider: "torbox",
                ranking_profile_name: "1080p_web",
                media_metadata: {
                    filename: "John.Wick.Chapter.4.2023.1080p.WEB-DL.x264.mkv",
                    duration: 8520,
                    bitrate: 8000000,
                    video: {
                        resolution_width: 1920,
                        resolution_height: 1080,
                        codec: "H264",
                        frame_rate: 23.976
                    },
                    audio_tracks: [{ codec: "AAC", channels: 2, language: "en" }],
                    quality_source: "WEB-DL",
                    container_format: ["mkv"]
                }
            }
        ]
    }} />

<Story
    name="MinimalFields"
    args={{
        entries: [{ id: 3, original_filename: "movie.mkv" }],
        fallbackMediaMetadata: undefined
    }} />
