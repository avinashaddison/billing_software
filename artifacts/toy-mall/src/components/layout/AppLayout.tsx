import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-muted/30 pb-20">
      <main className="max-w-md mx-auto w-full min-h-screen bg-background shadow-xl pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
