import { BottomNav } from "./BottomNav";
import { SideNav }   from "./SideNav";
import { useOnline }  from "@/hooks/use-online";
import { WifiOff }   from "lucide-react";
import { BulbLaari } from "@/components/ui/BulbLaari";
import { AppNotices } from "./AppNotices";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isOnline = useOnline();

  return (
    <div className="flex min-h-[100dvh] bg-muted/30">
      <SideNav />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="no-print flex items-center justify-center gap-2 bg-red-600 text-white text-xs font-bold py-2 px-4 text-center z-50">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            No internet connection — billing data may not sync
          </div>
        )}

        {/* ── Vendor notices + read-only support session ── */}
        <AppNotices />

        {/*
          Mobile bottom padding:
          - Base: 64px (h-16) for the bottom nav
          - +48px (pb-12) when cart strip is visible (count > 0)
          Desktop: no padding needed (side nav, no bottom nav)
        */}
        {/* pb-32 = 128px on mobile: 64px bottom nav + 48px cart strip + 16px breathing room.
            The strip is always mounted (opacity animated), so we always reserve its height. */}
        <main className="relative flex-1 w-full max-w-md mx-auto md:max-w-none pb-32 md:pb-0">
          {/* Festival bulb laari draped along the top of every page — lives
           * in the layout so it stays mounted across route changes (animation
           * never restarts) and individual pages don't need to know about it. */}
          <BulbLaari />
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
