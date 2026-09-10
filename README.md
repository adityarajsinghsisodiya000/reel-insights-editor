# Reel Insights Editor

A full-featured, editable Instagram Reel Insights mockup built as a Progressive Web App (PWA).

## Tech Stack

- **React 19** — UI library
- **TanStack Start** — Full-stack React framework (SSR + routing)
- **TanStack Router** — File-based routing
- **Tailwind CSS 4** — Utility-first styling
- **TypeScript** — Type-safe JavaScript
- **Vite** — Build tool & dev server
- **Lucide React** — SVG icons

## Features

### Overview Tab
- Editable summary cards (Views, Viewers, Average watch time, Follows)
- **Views over time** chart with dynamic Y-axis scaling based on Views value
- **Auto-comma formatting** — Views automatically format with commas (e.g., 5,000)
- **Viewers auto-calc** — Viewers = Views × 0.90 (10% less, automatic)
- **Date editing** — Chart date labels are editable in edit mode
- **What impacts your views** — Editable impact rows with icons and trends
- **How long people watched** — Retention chart with percentage over time
- **Top sources of views** — Progress bars with auto-redistribution (always sums to 100%)
- **Ad section** — Boost this reel CTA

### Engagement Tab
- **Actions after viewing** — Follows, Profile visits (synced with Overview stats)
- **Interactions** — Likes, Comments, Reposts, Shares, Saves (synced with root interaction icons)
- **When people liked your reel** — Likes over time chart with editable date range

### Audience Tab
- **Who viewed your reel** — Followers vs Non-followers progress bars
- **Audience details** — Age / Country / Gender category tabs
- **Country auto-adjust** — Changing any country percentage auto-redistributes others to sum to 100%, sorted descending
- **Redistribution** — Proportional percentage adjustment for all audience categories

### Editing Features
- **Edit mode** — Long-press to enter edit mode, tap any text to change it
- **Real-time sync** — Changes in Overview automatically reflect in Engagement
- **Chart date editing** — Edit start/end dates for all charts
- **Inline editing** — Tap any label or value to edit it directly

### PWA
- **Installable** — Add to Home Screen on mobile/desktop
- **Offline support** — Service worker caching
- **App-like experience** — Full screen, no browser bar

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:8080` in your browser.

## Build

```bash
npm run build
```

## License

MIT
