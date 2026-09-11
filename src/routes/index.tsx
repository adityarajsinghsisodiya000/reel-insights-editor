import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { InsightsProvider } from "@/lib/insights-store";
import { InsightsScreen } from "@/components/insights/InsightsScreen";
import { DesktopFrame } from "@/components/insights/DesktopFrame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Insights Editor" },
      {
        name: "description",
        content:
          "Design realistic Reel insights mockups: edit every stat, percentage, chart point and thumbnail directly on a mobile-first screen.",
      },
      { property: "og:title", content: "Insights Editor" },
      {
        name: "theme-color",
        content: "#0a0a0a",
      },
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
    <ClientOnly fallback={<div className="min-h-screen w-full max-w-[440px] mx-auto bg-[#0C1013]" />}>
      <InsightsProvider>
        <DesktopFrame>
          <InsightsScreen />
        </DesktopFrame>
      </InsightsProvider>
    </ClientOnly>
  );
}
