import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-[100dvh] bg-muted/30">
      {/* Desktop side nav */}
      <SideNav />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: constrained container; Desktop: full width */}
        <main className="flex-1 w-full max-w-md mx-auto md:max-w-none pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  );
}
