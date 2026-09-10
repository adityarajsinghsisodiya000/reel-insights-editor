import { createFileRoute } from "@tanstack/react-router";
import { InsightsProvider } from "@/lib/insights-store";
import { InsightsScreen } from "@/components/insights/InsightsScreen";
import { DesktopFrame } from "@/components/insights/DesktopFrame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Insights Editor — Editable Reel Insights Mockup" },
      {
        name: "description",
        content:
          "Design realistic Reel insights mockups: edit every stat, percentage, chart point and thumbnail directly on a mobile-first screen.",
      },
      { property: "og:title", content: "Insights Editor — Editable Reel Insights Mockup" },
      {
        property: "og:description",
        content:
          "A mobile-first visual editor for Reel insights screens. Hold the ⋯ button to edit any number, label, chart or image.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0a0a0a" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <InsightsProvider>
      <DesktopFrame>
        <InsightsScreen />
      </DesktopFrame>
    </InsightsProvider>
  );
}
