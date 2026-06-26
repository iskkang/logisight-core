import { createFileRoute, Outlet } from "@tanstack/react-router";

import { HomeNav } from "@/components/home/HomeNav";
import { HomeFooter } from "@/components/home/HomeFooter";
import { InsightSubNav } from "@/components/insight/InsightSubNav";
import { RailRegionTabs } from "@/components/rail-page/RailRegionTabs";

// 철도 허브 레이아웃 — INSIGHT 서브탭(철도) + 지역 탭바(미주/유라시아/유럽) + <Outlet/>.
export const Route = createFileRoute("/rail")({
  component: RailLayout,
});

function RailLayout() {
  return (
    <div className="min-h-screen bg-[#070b16]">
      <HomeNav active="insight" />
      <InsightSubNav />
      <RailRegionTabs />
      <Outlet />
      <HomeFooter />
    </div>
  );
}
