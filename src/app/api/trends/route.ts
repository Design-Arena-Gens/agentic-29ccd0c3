import { NextResponse } from "next/server";
import { fetchMultipleSubreddits } from "@/lib/reddit";
import { analyzeFrustrations } from "@/lib/analyze";

const DEFAULT_SUBREDDITS = [
  "Ultralight",
  "MechanicalKeyboards",
  "OneBag",
  "HeadphoneAdvice",
  "Ergonomics"
];

export const revalidate = 0; // no cache

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subsRaw = searchParams.get("subs");
  const perSub = Number(searchParams.get("limit") || "50");
  const subreddits = (subsRaw ? subsRaw.split(",") : DEFAULT_SUBREDDITS).map((s) => s.trim()).filter(Boolean);

  try {
    const posts = await fetchMultipleSubreddits(subreddits, perSub);
    const brief = analyzeFrustrations(posts, subreddits);
    return NextResponse.json(brief, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate trend brief" }, { status: 500 });
  }
}
