import { useState } from "react";
import { BookOpen, NotebookPen, Landmark } from "lucide-react";
import { DailyBookProvider, PendingBanner } from "@/components/daily-book/shared";
import { NotesPanel } from "@/components/daily-book/NotesPanel";
import { MoneyPanel } from "@/components/daily-book/MoneyPanel";

export default function DailyBook() {
  const [tab, setTab] = useState<"notes" | "money">("notes");
  return (
    <DailyBookProvider>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 pb-28 md:pb-8">
        <h1 className="text-2xl font-black flex items-center gap-2"><BookOpen className="w-6 h-6 text-amber-500" /> Daily Book</h1>
        <PendingBanner />
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-muted/70 sticky top-0 z-10 backdrop-blur">
          <button type="button" onClick={() => setTab("notes")} data-testid="tab-notes"
            className={`h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${tab === "notes" ? "bg-amber-500 text-white shadow" : "text-muted-foreground"}`}><NotebookPen className="w-4 h-4" /> Notes & Plans</button>
          <button type="button" onClick={() => setTab("money")} data-testid="tab-money"
            className={`h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${tab === "money" ? "bg-emerald-600 text-white shadow" : "text-muted-foreground"}`}><Landmark className="w-4 h-4" /> Money Khata</button>
        </div>
        <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {tab === "notes" ? <NotesPanel /> : <MoneyPanel />}
        </div>
      </div>
    </DailyBookProvider>
  );
}
