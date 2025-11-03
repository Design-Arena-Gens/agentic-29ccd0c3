"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Trend = {
  phrase: string;
  score: number;
  count: number;
  examples: Array<{ subreddit: string; title: string; permalink: string }>;
};

type TrendBrief = {
  generatedAt: string;
  subreddits: string[];
  topTrends: Trend[];
  bySubreddit: Record<string, { topTrends: Trend[]; sampleSize: number }>;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<TrendBrief | null>(null);
  const [customSubs, setCustomSubs] = useState("");

  const effectiveSubs = useMemo(() => {
    const base = ["Ultralight", "MechanicalKeyboards", "OneBag", "HeadphoneAdvice", "Ergonomics"];
    if (!customSubs.trim()) return base;
    const parts = customSubs.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts : base;
  }, [customSubs]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/trends?subs=${encodeURIComponent(effectiveSubs.join(","))}&limit=50`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as TrendBrief;
      setBrief(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load trends");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Consumer Frustrations ? Ranked Trend Brief</h1>
          <p>Scanning five niche subreddits in near?real?time. Edit subreddits below and refresh.</p>
          <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 560 }}>
            <input
              value={customSubs}
              onChange={(e) => setCustomSubs(e.target.value)}
              placeholder="Ultralight, MechanicalKeyboards, OneBag, HeadphoneAdvice, Ergonomics"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button onClick={load} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #333" }}>Refresh</button>
          </div>
        </div>

        {loading && <p style={{ color: "#666", marginTop: 24 }}>Loading trends?</p>}
        {error && <p style={{ color: "#b00020", marginTop: 24 }}>Error: {error}</p>}

        {brief && !loading && !error && (
          <div style={{ marginTop: 24, width: "100%" }}>
            <h2 style={{ margin: "16px 0" }}>Top Emerging Frustrations</h2>
            <ol style={{ paddingLeft: 18, display: "grid", gap: 12 }}>
              {brief.topTrends.slice(0, 10).map((t) => (
                <li key={t.phrase}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{t.phrase}</strong>
                    <span style={{ color: "#666" }}>score {t.score.toFixed(1)} ? {t.count} mentions</span>
                  </div>
                  {t.examples.length > 0 && (
                    <ul style={{ marginTop: 6, color: "#444" }}>
                      {t.examples.map((ex, idx) => (
                        <li key={idx}>
                          <span style={{ opacity: 0.8 }}>[r/{ex.subreddit}]</span> {ex.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>

            <h3 style={{ margin: "20px 0 8px" }}>By Subreddit</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {effectiveSubs.map((s) => (
                <div key={s} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>r/{s}</strong>
                    <span style={{ color: "#666", fontSize: 12 }}>sample: {brief.bySubreddit[s]?.sampleSize ?? 0}</span>
                  </div>
                  <ul style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {(brief.bySubreddit[s]?.topTrends ?? []).slice(0, 5).map((t) => (
                      <li key={`${s}-${t.phrase}`}>
                        <span style={{ fontWeight: 600 }}>{t.phrase}</span>
                        <span style={{ color: "#666" }}> ? {t.count} mentions</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 16, color: "#666" }}>Generated at {new Date(brief.generatedAt).toLocaleString()}</p>
          </div>
        )}
      </main>
    </div>
  );
}
