import { createFileRoute } from "@tanstack/react-router";
import { InsightsProvider } from "@/lib/insights-store";
import { InsightsScreen } from "@/components/insights/InsightsScreen";
import { DesktopFrame } from "@/components/insights/DesktopFrame";

export const Route = createFileRoute("/")({
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
