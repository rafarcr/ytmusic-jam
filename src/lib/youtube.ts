import type { SearchHit } from "./types";

type FlexRun = { text?: string };
type FlexColumn = {
  musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: FlexRun[] } };
};
type SearchItem = {
  musicResponsiveListItemRenderer?: {
    playlistItemData?: { videoId?: string };
    flexColumns?: FlexColumn[];
  };
};
type SearchSection = {
  musicShelfRenderer?: { contents?: SearchItem[] };
};

const SONG_FILTER = "EgWKAQIIAWoKEAMQCRAEEAMQBBAF";

export async function searchSongs(query: string): Promise<SearchHit[]> {
  const response = await fetch("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://music.youtube.com",
      Referer: "https://music.youtube.com/",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20241127.01.00",
          hl: "pt",
          gl: "BR",
        },
      },
      query,
      params: SONG_FILTER,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`YouTube Music respondeu ${response.status}`);

  const payload = (await response.json()) as {
    contents?: {
      tabbedSearchResultsRenderer?: {
        tabs?: Array<{
          tabRenderer?: {
            content?: { sectionListRenderer?: { contents?: SearchSection[] } };
          };
        }>;
      };
    };
  };

  const sections =
    payload.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents ?? [];

  const hits: SearchHit[] = [];
  for (const section of sections) {
    for (const item of section.musicShelfRenderer?.contents ?? []) {
      const hit = parseHit(item);
      if (!hit) continue;
      hits.push(hit);
      if (hits.length >= 8) return hits;
    }
  }
  return hits;
}

function parseHit(item: SearchItem): SearchHit | null {
  const renderer = item.musicResponsiveListItemRenderer;
  const videoId = renderer?.playlistItemData?.videoId;
  if (!renderer || !videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const columns = renderer.flexColumns ?? [];
  const title =
    columns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text?.trim() ?? "";
  if (!title) return null;

  const meta = columns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
  const parts: string[] = [];
  let duration = "";
  for (const run of meta) {
    const text = run.text?.trim() ?? "";
    if (!text || text === "•") continue;
    if (/^\d+:\d{2}(?::\d{2})?$/.test(text)) {
      duration = text;
      continue;
    }
    parts.push(text);
  }

  return {
    videoId,
    title,
    artist: parts[0] ?? "",
    album: parts[1] ?? "",
    duration,
  };
}
