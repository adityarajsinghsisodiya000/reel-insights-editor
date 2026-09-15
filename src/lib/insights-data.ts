export type NamedPct = { id: string; name: string; percentage: number };
export type ChartPoint = { time: number; value: number };
export type ChartGraph = {
  xAxis: {
    start: number;
    end: number;
    tickInterval: number;
    format: "time" | "date" | "number";
    unit?: string;
  };
  yAxis: { min: number; max: number; tickInterval: number; unit?: string };
  points: ChartPoint[];
};
export type Row = { id: string; label: string; value: string };
export type ImpactRow = {
  id: string;
  icon: "skip" | "share" | "like" | "save" | "repost" | "comment";
  label: string;
  value: string;
  trend: string;
};

export type DateRange = { start: string; end: string };

export type InsightsData = {
  headerTitle: string;
  reelMedia: string | null;
  interactions: Row[];
  tabLabels: { overview: string; engagement: string; audience: string };
  overview: {
    summaryTitle: string;
    stats: Row[];
    viewsOverTimeTitle: string;
    filters: string[];
    activeFilter: number;
    viewsGraph: ChartGraph;
    viewsDateRange: DateRange;
    legend: [string, string];
    impactTitle: string;
    impactSubtitle: string;
    impactRows: ImpactRow[];
    watchTitle: string;
    watchGraph: ChartGraph;
    watchDateRange: DateRange;
    sourcesTitle: string;
    sources: NamedPct[];
    adTitle: string;
    adCta: string;
  };
  engagement: {
    actionsTitle: string;
    actions: Row[];
    interactionsTitle: string;
    interactionRows: Row[];
    likedTitle: string;
    likedGraph: ChartGraph;
    likedDateRange: DateRange;
  };
  audience: {
    whoTitle: string;
    who: NamedPct[];
    detailsTitle: string;
    categories: string[];
    activeCategory: number;
    age: NamedPct[];
    country: NamedPct[];
    gender: NamedPct[];
  };
};

const id = (p: string, i: number) => `${p}-${i}`;

export const defaultData: InsightsData = {
  headerTitle: "Reel insights",
  reelMedia: null,
  interactions: [
    { id: "likes", label: "Likes", value: "15" },
    { id: "comments", label: "Comments", value: "0" },
    { id: "reposts", label: "Reposts", value: "2" },
    { id: "shares", label: "Shares", value: "0" },
    { id: "saves", label: "Saves", value: "1" },
  ],
  tabLabels: { overview: "Overview", engagement: "Engagement", audience: "Audience" },
  overview: {
    summaryTitle: "Summary",
    stats: [
      { id: "views", label: "Views", value: "3,441" },
      { id: "viewers", label: "Viewers", value: "2,461" },
      { id: "awt", label: "Average watch time", value: "4s" },
      { id: "follows", label: "Follows", value: "0" },
    ],
    viewsOverTimeTitle: "Views over time",
    filters: ["All", "Followers", "Non-followers"],
    activeFilter: 0,
    viewsDateRange: { start: "2025-09-04", end: "2025-09-06" },
    viewsGraph: {
      xAxis: { start: 0, end: 19, tickInterval: 1, format: "number" },
      yAxis: { min: 0, max: 6000, tickInterval: 2000 },
      points: [
        { time: 0, value: 0 },
        { time: 1, value: 200 },
        { time: 2, value: 900 },
        { time: 3, value: 1100 },
        { time: 4, value: 1000 },
        { time: 5, value: 1450 },
        { time: 6, value: 1900 },
        { time: 7, value: 1750 },
        { time: 8, value: 2050 },
        { time: 9, value: 2500 },
        { time: 10, value: 3450 },
        { time: 11, value: 2350 },
        { time: 12, value: 3600 },
        { time: 13, value: 3350 },
        { time: 14, value: 3300 },
        { time: 15, value: 3450 },
        { time: 16, value: 3550 },
        { time: 17, value: 3800 },
        { time: 18, value: 3700 },
        { time: 19, value: 3300 },
      ],
    },
    legend: ["This reel", "Your typical reel"],
    impactTitle: "What impacts your views",
    impactSubtitle: "Rates are listed in order of importance to reach.",
    impactRows: [
      { id: id("imp", 0), icon: "skip", label: "Skip rate", value: "62.8%", trend: "Lower" },
      { id: id("imp", 1), icon: "share", label: "Share rate", value: "0%", trend: "Lower" },
      { id: id("imp", 2), icon: "like", label: "Like rate", value: "0.4%", trend: "Higher" },
      { id: id("imp", 3), icon: "save", label: "Save rate", value: "0.03%", trend: "Higher" },
      { id: id("imp", 4), icon: "repost", label: "Repost rate", value: "0.1%", trend: "Higher" },
      { id: id("imp", 5), icon: "comment", label: "Comment rate", value: "0.0%", trend: "Typical" },
    ],
    watchTitle: "How long people watched your reel",
    watchDateRange: { start: "0:00", end: "0:09" },
    watchGraph: {
      xAxis: { start: 0, end: 22, tickInterval: 1, format: "number" },
      yAxis: { min: 0, max: 100, tickInterval: 50, unit: "%" },
      points: [
        { time: 0, value: 100 },
        { time: 1, value: 92 },
        { time: 2, value: 88 },
        { time: 3, value: 70 },
        { time: 4, value: 66 },
        { time: 5, value: 63 },
        { time: 6, value: 60 },
        { time: 7, value: 62 },
        { time: 8, value: 58 },
        { time: 9, value: 47 },
        { time: 10, value: 45 },
        { time: 11, value: 44 },
        { time: 12, value: 40 },
        { time: 13, value: 38 },
        { time: 14, value: 36 },
        { time: 15, value: 35 },
        { time: 16, value: 30 },
        { time: 17, value: 28 },
        { time: 18, value: 27 },
        { time: 19, value: 22 },
        { time: 20, value: 12 },
        { time: 21, value: 6 },
        { time: 22, value: 4 },
      ],
    },
    sourcesTitle: "Top sources of views",
    sources: [
      { id: "s0", name: "Reels tab", percentage: 72.9 },
      { id: "s1", name: "Explore", percentage: 11.3 },
      { id: "s2", name: "Profile", percentage: 3.5 },
      { id: "s3", name: "Feed", percentage: 1.6 },
    ],
    adTitle: "Ad",
    adCta: "Boost this reel",
  },
  engagement: {
    actionsTitle: "Actions after viewing",
    actions: [
      { id: "fl", label: "Follows", value: "0" },
      { id: "pv", label: "Profile visits", value: "69" },
    ],
    interactionsTitle: "Interactions",
    interactionRows: [
      { id: "e-likes", label: "Likes", value: "15" },
      { id: "e-comments", label: "Comments", value: "0" },
      { id: "e-reposts", label: "Reposts", value: "2" },
      { id: "e-shares", label: "Shares", value: "0" },
      { id: "e-saves", label: "Saves", value: "1" },
    ],
    likedTitle: "When people liked your reel",
    likedDateRange: { start: "0:00", end: "0:09" },
    likedGraph: {
      xAxis: { start: 0, end: 14, tickInterval: 1, format: "number" },
      yAxis: { min: 0, max: 10, tickInterval: 5, unit: "%" },
      points: [
        { time: 0, value: 0.4 },
        { time: 1, value: 4.7 },
        { time: 2, value: 0.5 },
        { time: 3, value: 6.8 },
        { time: 4, value: 0.6 },
        { time: 5, value: 0.3 },
        { time: 6, value: 1.2 },
        { time: 7, value: 0.6 },
        { time: 8, value: 0.5 },
        { time: 9, value: 5.1 },
        { time: 10, value: 0.6 },
        { time: 11, value: 0.7 },
        { time: 12, value: 1 },
        { time: 13, value: 0.6 },
        { time: 14, value: 0.2 },
      ],
    },
  },
  audience: {
    whoTitle: "Who viewed your reel",
    who: [
      { id: "w0", name: "Followers", percentage: 0.4 },
      { id: "w1", name: "Non-followers", percentage: 99.6 },
    ],
    detailsTitle: "Audience details",
    categories: ["Age", "Country", "Gender"],
    activeCategory: 1,
    age: [
      { id: "a0", name: "13-17", percentage: 3.2 },
      { id: "a1", name: "18-24", percentage: 34.7 },
      { id: "a2", name: "25-34", percentage: 37.1 },
      { id: "a3", name: "35-44", percentage: 15.4 },
      { id: "a4", name: "45-54", percentage: 6.1 },
      { id: "a5", name: "55+", percentage: 3.5 },
    ],
    country: [
      { id: "c0", name: "United States", percentage: 41.3 },
      { id: "c1", name: "Canada", percentage: 27.4 },
      { id: "c2", name: "Czech Republic", percentage: 5.8 },
      { id: "c3", name: "Sweden", percentage: 3.7 },
      { id: "c4", name: "Finland", percentage: 1.8 },
    ],
    gender: [
      { id: "g0", name: "Men", percentage: 78.4 },
      { id: "g1", name: "Women", percentage: 20.9 },
      { id: "g2", name: "Not specified", percentage: 0.7 },
    ],
  },
};

export const cloneDefaults = (): InsightsData =>
  JSON.parse(JSON.stringify(defaultData)) as InsightsData;
