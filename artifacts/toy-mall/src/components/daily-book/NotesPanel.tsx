import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Archive, ArchiveRestore, Search, ListTodo, StickyNote, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { dailyBookApi, istToday, type DailyNote, type NoteInput } from "@/lib/daily-book-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QueryGate, Empty, useDb, useNotes, inputCls, labelCls, fmtDate } from "./shared";

function NoteForm({ initial, submitLabel, onSubmit, resetOnOk }: {
  initial?: DailyNote; submitLabel: string; resetOnOk?: boolean;
  onSubmit: (input: NoteInput) => Promise<boolean>;
}) {
  const { blocked, busy } = useDb();
  const [content, setContent] = useState(initial?.content ?? "");
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? istToday());
  const [isTask, setIsTask] = useState(initial?.isTask ?? false);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const submit = async () => {
    if (!content.trim()) { toast.error("Write something first."); return; }
    if (!entryDate) { toast.error("Pick an entry date."); return; }
    const ok = await onSubmit({ content: content.trim(), entryDate, isTask, dueDate: isTask && dueDate ? dueDate : null });
    if (ok && resetOnOk) { setContent(""); setEntryDate(istToday()); setIsTask(false); setDueDate(""); }
  };
  return (
    <div className="space-y-3">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Quick note: order tiles from Raju, call the courier..."
        className={`${inputCls} h-auto py-2.5 resize-none`} data-testid="input-note-content" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="n-date">Entry date</label>
          <input id="n-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputCls} data-testid="input-note-date" />
        </div>
        <div>
          <label className={labelCls} htmlFor="n-due">Due date (optional)</label>
          <input id="n-due" type="date" value={dueDate} disabled={!isTask} onChange={(e) => setDueDate(e.target.value)} className={inputCls} data-testid="input-note-due" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 grid grid-cols-2 p-1 rounded-xl bg-muted/70 text-xs font-black">
          {([false, true] as const).map((t) => (
            <button key={String(t)} type="button" onClick={() => setIsTask(t)} data-testid={t ? "button-kind-task" : "button-kind-note"}
              className={`h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all ${isTask === t ? "bg-amber-500 text-white shadow" : "text-muted-foreground"}`}>
              {t ? <ListTodo className="w-3.5 h-3.5" /> : <StickyNote className="w-3.5 h-3.5" />}{t ? "Task" : "Note"}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void submit()} disabled={blocked} data-testid="button-save-note"
          className="h-11 px-5 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}{submitLabel}
        </button>
      </div>
    </div>
  );
}

type View = "today" | "pending" | "history";

export function NotesPanel() {
  const q = useNotes();
  const { run, blocked, recovered } = useDb();
  const [view, setView] = useState<View>("today");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [editing, setEditing] = useState<DailyNote | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  useEffect(() => { setEditing(null); }, [recovered]);
  const today = istToday();

  const notes = q.data;
  const counts = useMemo(() => ({
    today: (notes ?? []).filter((n) => inToday(n, today)).length,
    pending: (notes ?? []).filter((n) => n.isTask && !n.completed && !n.archived).length,
  }), [notes, today]);

  const list = useMemo(() => {
    const t = text.trim().toLowerCase();
    return (notes ?? []).filter((n) => {
      if (view === "today" && !inToday(n, today)) return false;
      if (view === "pending" && !(n.isTask && !n.completed && !n.archived)) return false;
      if (view === "history" && archivedOnly && !n.archived) return false;
      if (t && !n.content.toLowerCase().includes(t)) return false;
      if (date && n.entryDate !== date && n.dueDate !== date) return false;
      return true;
    }).sort((a, b) => view === "pending"
      ? (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
      : b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt));
  }, [notes, view, text, date, archivedOnly, today]);

  const patch = async (n: DailyNote, p: Parameters<typeof dailyBookApi.updateNote>[1], msg: string) => {
    setRowBusy(n.id);
    await run(() => dailyBookApi.updateNote(n, p), msg);
    setRowBusy(null);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300 mb-2">New note or task</p>
        <NoteForm key={`add-${recovered}`} submitLabel="Save" resetOnOk
          onSubmit={(input) => run(() => dailyBookApi.createNote(input), input.isTask ? "Task saved" : "Note saved")} />
      </section>

      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-muted/70">
        {([["today", "Today", counts.today], ["pending", "Pending", counts.pending], ["history", "History", null]] as const).map(([k, l, c]) => (
          <button key={k} type="button" onClick={() => setView(k)} data-testid={`tab-notes-${k}`}
            className={`h-10 rounded-xl text-xs font-black transition-all ${view === k ? "bg-card text-amber-700 dark:text-amber-300 shadow" : "text-muted-foreground"}`}>
            {l}{c !== null && c > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">{c}</span>}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search text" className={`${inputCls} pl-9`} data-testid="input-search-notes" />
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-40`} aria-label="Search by date" data-testid="input-search-note-date" />
        {(text || date) && <button type="button" onClick={() => { setText(""); setDate(""); }} className="px-3 rounded-xl border text-xs font-bold">Clear</button>}
      </div>
      {view === "history" && (
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <input type="checkbox" checked={archivedOnly} onChange={(e) => setArchivedOnly(e.target.checked)} data-testid="check-archived-only" /> Archived only
        </label>
      )}

      <QueryGate q={q} what="notes">
        {() => list.length === 0 ? (
          <Empty title={text || date ? "Nothing matches" : view === "today" ? "Nothing for today" : view === "pending" ? "No pending tasks" : "No history yet"}
            hint={text || date ? "Try a different word or date." : "Add a note or task above."} />
        ) : (
          <ul className="space-y-2">
            {list.map((n) => {
              const overdue = n.isTask && !n.completed && !n.archived && !!n.dueDate && n.dueDate < today;
              const b = rowBusy === n.id;
              return (
                <li key={n.id} data-testid={`row-note-${n.id}`}
                  className={`rounded-2xl border bg-card p-3 flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-300 ${n.archived ? "opacity-60" : ""} ${overdue ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-amber-400"}`}>
                  {n.isTask ? (
                    <button type="button" disabled={blocked} onClick={() => void patch(n, { completed: !n.completed }, n.completed ? "Task reopened" : "Task done")}
                      aria-label={n.completed ? "Reopen task" : "Mark done"} data-testid={`button-toggle-done-${n.id}`}
                      className={`w-9 h-9 shrink-0 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${n.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-amber-400 text-transparent hover:text-amber-400"}`}>
                      {b ? <Loader2 className="w-4 h-4 animate-spin text-current" /> : <Check className="w-4 h-4" />}
                    </button>
                  ) : <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center"><StickyNote className="w-4 h-4" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm whitespace-pre-wrap break-words ${n.completed ? "line-through text-muted-foreground" : "font-semibold"}`}>{n.content}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 text-[10px] font-black">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{fmtDate(n.entryDate)}</span>
                      {n.dueDate && <span className={`px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${overdue ? "bg-rose-500 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}><CalendarClock className="w-3 h-3" />{overdue ? "Overdue " : "Due "}{fmtDate(n.dueDate)}</span>}
                      {n.completed && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Done</span>}
                      {n.archived && <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Archived</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button type="button" disabled={blocked} onClick={() => setEditing(n)} aria-label="Edit" data-testid={`button-edit-note-${n.id}`}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-50"><Pencil className="w-3.5 h-3.5" /></button>
                    <button type="button" disabled={blocked} onClick={() => void patch(n, { archived: !n.archived }, n.archived ? "Restored" : "Archived")}
                      aria-label={n.archived ? "Restore" : "Archive"} data-testid={`button-archive-note-${n.id}`}
                      className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-50">
                      {n.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </QueryGate>

      {editing && (
        <Dialog open onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editing.isTask ? "task" : "note"}</DialogTitle>
              <DialogDescription>Changes save to this record only.</DialogDescription>
            </DialogHeader>
            <NoteForm key={`${editing.id}-${editing.version}`} initial={editing} submitLabel="Update"
              onSubmit={async (input) => {
                const ok = await run(() => dailyBookApi.updateNote(editing, input), "Saved");
                if (ok) setEditing(null);
                return ok;
              }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function inToday(n: DailyNote, today: string): boolean {
  if (n.archived) return false;
  if (n.entryDate === today) return true;
  return n.isTask && !n.completed && !!n.dueDate && n.dueDate <= today;
}
