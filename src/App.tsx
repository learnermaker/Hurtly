import { useEffect } from "react";
import { useRoute, type Route } from "./lib/route";
import { LogScreen } from "./screens/LogScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { RegionScreen } from "./screens/RegionScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

const TABS: { tab: Route["tab"]; label: string; icon: string }[] = [
  { tab: "log", label: "Log", icon: "M12 5v14M5 12h14" },
  { tab: "history", label: "History", icon: "M4 19V9M10 19V5M16 19v-7M22 19H2" },
  { tab: "report", label: "Report", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { tab: "settings", label: "Settings", icon: "M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4" },
];

export function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.tab, route.rest.join("/")]);

  let screen;
  if (route.tab === "history" && route.rest[0] === "region" && route.rest[1]) screen = <RegionScreen regionId={route.rest[1]} />;
  else if (route.tab === "history") screen = <HistoryScreen />;
  else if (route.tab === "report") screen = <ReportScreen />;
  else if (route.tab === "settings") screen = <SettingsScreen />;
  else screen = <LogScreen repeat={route.params.get("repeat")} />;

  return (
    <div className="app">
      <main className="screen">{screen}</main>
      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <a key={t.tab} href={`#/${t.tab}`} className={`tab${route.tab === t.tab ? " is-on" : ""}`} aria-current={route.tab === t.tab ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
