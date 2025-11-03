export type RedditPost = {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  permalink: string;
  url: string;
  createdUtc: number;
};

const REDDIT_BASE = "https://www.reddit.com";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "trend-brief/1.0 (by github.com/agent)"
    },
    // Reddit sometimes blocks if referrer leaks; avoid sending cookies etc
    cache: "no-store",
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`Reddit fetch failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchSubredditNew(subreddit: string, limit: number = 50): Promise<RedditPost[]> {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/new.json?limit=${Math.min(
    Math.max(limit, 1),
    100
  )}`;
  type Listing = {
    data: { children: Array<{ data: any }> };
  };
  const data = await fetchJson<Listing>(url);
  const posts: RedditPost[] = data.data.children
    .map((c) => c.data)
    .filter((d) => !d.stickied && !d.locked)
    .map((d) => ({
      id: String(d.id),
      subreddit: String(d.subreddit),
      title: String(d.title || ""),
      selftext: String(d.selftext || ""),
      permalink: String(d.permalink || ""),
      url: String(d.url || ""),
      createdUtc: Number(d.created_utc || 0)
    }));
  return posts;
}

export async function fetchMultipleSubreddits(subreddits: string[], perSubreddit: number = 50): Promise<RedditPost[]> {
  const promises = subreddits.map((s) => fetchSubredditNew(s, perSubreddit).catch(() => []));
  const results = await Promise.all(promises);
  return results.flat();
}
