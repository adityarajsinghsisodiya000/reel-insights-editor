import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NamedPct } from "./insights-data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with commas (e.g., 5000 → "5,000")
 */
export function formatWithCommas(value: string): string {
  if (value.trim() === "") return "";
  const num = Number(value.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(num)) return value;
  const parts = num.toString().split(".");
  parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * When one percentage in a group changes, redistribute the remainder
 * proportionally among the other items so the total always = 100.
 */
export function redistributePercentages<T extends { percentage: number }>(
  items: T[],
  changedIdx: number,
  newVal: number,
): T[] {
  const clamped = Math.max(0, Math.min(100, newVal));
  const result = items.map((it) => ({ ...it }));

  result[changedIdx]!.percentage = Math.round(clamped * 10) / 10;

  const othersTotal = 100 - result[changedIdx]!.percentage;

  const oldOthersSum = items.reduce(
    (sum, it, i) => (i === changedIdx ? sum : sum + it.percentage),
    0,
  );

  if (oldOthersSum === 0) {
    const share = othersTotal / (items.length - 1 || 1);
    for (let i = 0; i < result.length; i++) {
      if (i !== changedIdx) result[i]!.percentage = Math.round(share * 10) / 10;
    }
  } else {
    let runningSum = 0;
    for (let i = 0; i < result.length; i++) {
      if (i === changedIdx) continue;
      const isLast =
        i ===
        result.reduce(
          (last, it, j) => (j !== changedIdx ? j : last),
          0,
        );
      if (isLast) {
        result[i]!.percentage =
          Math.round((othersTotal - runningSum) * 10) / 10;
      } else {
        const raw = (items[i]!.percentage / oldOthersSum) * othersTotal;
        result[i]!.percentage = Math.round(raw * 10) / 10;
        runningSum += result[i]!.percentage;
      }
    }
  }

  return result;
}

/**
 * Redistribute percentages and sort descending by percentage.
 * Used for country/age/gender where order matters.
 */
export function redistributeAndSort(
  items: NamedPct[],
  changedIdx: number,
  newVal: number,
): NamedPct[] {
  const redistributed = redistributePercentages(items, changedIdx, newVal);
  return [...redistributed].sort((a, b) => b.percentage - a.percentage);
}

/**
 * Seeded pseudo-random number generator (mulberry32)
 */
function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate realistic Instagram-like graph points based on total views.
 * Each views value produces a unique shape with growth trend, dips, and peaks.
 */
export function generateGraphPoints(viewsTotal: number, count = 20): { time: number; value: number }[] {
  const rng = seededRandom(Math.round(viewsTotal));
  const points: { time: number; value: number }[] = [];

  // Generate random weights with upward bias
  const weights: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < count; i++) {
    // Upward trend: later points tend to be higher
    const trend = 0.3 + (i / (count - 1)) * 0.7;
    // Random variation
    const noise = 0.3 + rng() * 1.4;
    // Occasional dips (20% chance)
    const dip = rng() < 0.2 ? 0.3 + rng() * 0.4 : 1;
    const w = trend * noise * dip;
    weights.push(w);
    totalWeight += w;
  }

  // Normalize weights so sum = viewsTotal
  for (let i = 0; i < count; i++) {
    points.push({
      time: i,
      value: Math.round((weights[i]! / totalWeight) * viewsTotal),
    });
  }

  // First point is always 0 (reel just posted)
  points[0] = { time: 0, value: 0 };

  return points;
}
