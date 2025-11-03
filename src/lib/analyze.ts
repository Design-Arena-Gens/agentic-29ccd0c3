import Sentiment from "sentiment";
import type { RedditPost } from "@/lib/reddit";

export type Trend = {
  phrase: string;
  score: number;
  count: number;
  examples: Array<{ subreddit: string; title: string; permalink: string }>;
};

export type TrendBrief = {
  generatedAt: string;
  subreddits: string[];
  topTrends: Trend[];
  bySubreddit: Record<string, { topTrends: Trend[]; sampleSize: number }>;
};

const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","as","at","be","because","been","before","being","below","between","both","but","by","can","did","do","does","doing","down","during","each","few","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself","his","how","i","if","in","into","is","it","its","itself","let","me","more","most","my","myself","no","nor","not","of","off","on","once","only","or","other","our","ours","ourselves","out","over","own","same","she","should","so","some","such","than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too","under","until","up","very","was","we","were","what","when","where","which","while","who","whom","why","with","you","your","yours","yourself","yourselves"
]);

const FRUSTRATION_HINTS = [
  "issue","problem","broken","broke","can?t","cant","cannot","delay","late","shipping","warranty","return","refund","scam","fake","pain","hurt","uncomfortable","fit","sizing","noise","rattle","dirty","stuck","doesn?t","doesnt","won?t","wont","bad","worse","fail","failure","missing","lost","confusing","hard","difficult","crack","peel","scratch","battery","overheat","heat","cold","smell","odor","squeak","inconsistent","slow","lag","stutter","bug","glitch"
];

const sentiment = new Sentiment();

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const norm = normalize(text);
  return norm.split(" ").filter(Boolean);
}

function containsFrustrationHint(text: string): boolean {
  const t = normalize(text);
  return FRUSTRATION_HINTS.some((h) => t.includes(h));
}

function generatePhrases(tokens: string[], nMin = 1, nMax = 3): string[] {
  const phrases: string[] = [];
  const contentTokens = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i <= contentTokens.length - n; i++) {
      const phrase = contentTokens.slice(i, i + n).join(" ");
      if (phrase) phrases.push(phrase);
    }
  }
  return phrases;
}

function scoreTextNegativity(text: string): number {
  const res = sentiment.analyze(text);
  // Negative-only: clamp positive to 0
  return Math.max(0, -Math.min(0, res.score));
}

export function analyzeFrustrations(posts: RedditPost[], subreddits: string[]): TrendBrief {
  type Accum = {
    score: number;
    count: number;
    examples: Array<{ subreddit: string; title: string; permalink: string }>;
  };

  const globalMap = new Map<string, Accum>();
  const bySub = new Map<string, Map<string, Accum>>();

  for (const post of posts) {
    const text = `${post.title} ${post.selftext}`.trim();
    if (!text) continue;

    const neg = scoreTextNegativity(text);
    const hint = containsFrustrationHint(text);

    // Skip clearly neutral content to keep precision high
    if (!hint && neg < 1) continue;

    const tokens = tokenize(text);
    const phrases = generatePhrases(tokens, 1, 3);

    // Weight: base on negativity with small bonus for explicit hint
    const baseWeight = neg > 0 ? neg : 1;
    const weight = baseWeight * (hint ? 1.3 : 1.0);

    // For each phrase, accumulate
    const subMap = bySub.get(post.subreddit) ?? new Map<string, Accum>();
    if (!bySub.has(post.subreddit)) bySub.set(post.subreddit, subMap);

    // Limit examples to avoid huge payloads
    const addExample = (acc: Accum) => {
      if (acc.examples.length < 3) {
        acc.examples.push({ subreddit: post.subreddit, title: post.title, permalink: post.permalink });
      }
    };

    for (const p of phrases) {
      // Skip phrases that are too generic
      if (p.length < 4) continue;

      const g = globalMap.get(p) ?? { score: 0, count: 0, examples: [] };
      g.score += weight;
      g.count += 1;
      addExample(g);
      globalMap.set(p, g);

      const s = subMap.get(p) ?? { score: 0, count: 0, examples: [] };
      s.score += weight;
      s.count += 1;
      addExample(s);
      subMap.set(p, s);
    }
  }

  const normalizeAndRank = (m: Map<string, Accum>): Trend[] =>
    Array.from(m.entries())
      .map(([phrase, acc]) => ({ phrase, score: acc.score, count: acc.count, examples: acc.examples }))
      // Prioritize phrases with higher score, then frequency
      .sort((a, b) => (b.score - a.score) || (b.count - a.count))
      .slice(0, 25);

  const topTrends = normalizeAndRank(globalMap);

  const bySubreddit: Record<string, { topTrends: Trend[]; sampleSize: number }> = {};
  for (const s of subreddits) {
    const m = bySub.get(s) ?? new Map<string, Accum>();
    bySubreddit[s] = { topTrends: normalizeAndRank(m), sampleSize: Array.from(m.values()).reduce((a, v) => a + v.count, 0) };
  }

  return {
    generatedAt: new Date().toISOString(),
    subreddits,
    topTrends,
    bySubreddit
  };
}
