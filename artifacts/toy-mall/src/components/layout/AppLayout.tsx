import { BottomNav } from "./BottomNav";
import { SideNav }   from "./SideNav";
import { useOnline }  from "@/hooks/use-online";
import { useCart }    from "@/contexts/cart-context";
import { WifiOff }   from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isOnline = useOnline();
  const { count } = useCart();

  return (
    <div className="flex min-h-[100dvh] bg-muted/30">
      <SideNav />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-red-600 text-white text-xs font-bold py-2 px-4 text-center z-50">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            No internet connection — billing data may not sync
          </div>
        )}

        {/*
          Mobile bottom padding:
          - Base: 64px (h-16) for the bottom nav
          - +48px (pb-12) when cart strip is visible (count > 0)
          Desktop: no padding needed (side nav, no bottom nav)
        */}
        <main className={`flex-1 w-full max-w-md mx-auto md:max-w-none md:pb-0 ${count > 0 ? "pb-32" : "pb-20"}`}>
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
