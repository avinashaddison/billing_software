import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminNotices, useAdminOverview, adminMutate, adminQueryKeys } from "./api";
import { NoticeRow, NoticeLevel } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trash2, Search, Loader2 } from "lucide-react";
import {
  PageHeader, SectionLabel, Panel, Rows, Tag, EmptyState, LoadError, Notice, type Tone
} from "./ui";

interface ShopPickerProps {
  shops: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

function ShopPicker({ shops, value, onChange, disabled }: ShopPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return shops.filter(x => x.name.toLowerCase().includes(s));
  }, [shops, search]);

  const selected = value === "all" ? null : shops.find(x => x.id === value);

  return (
    <div className="relative">
      <div 
        className={`flex items-center justify-between h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className={value === "all" ? "font-medium text-destructive" : "truncate"}>
          {value === "all" ? "Global broadcast (All shops)" : selected?.name || "Select shop..."}
        </span>
        <Search className="h-3.5 w-3.5 opacity-50 shrink-0 ml-2" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full z-50 rounded-md border bg-popover text-popover-foreground outline-none max-h-60 flex flex-col overflow-hidden">
            <div className="flex items-center border-b px-3 shrink-0">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              <input 
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" 
                placeholder="Search shops..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-1 flex-1">
              <div 
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-destructive/10 hover:text-destructive font-medium text-destructive transition-colors mb-1"
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
              >
                Global broadcast (All shops)
              </div>
              <div className="h-px bg-border my-1 mx-2" />
              {filtered.map(shop => (
                <div
                  key={shop.id}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-muted transition-colors"
                  onClick={() => { onChange(shop.id); setOpen(false); setSearch(""); }}
                >
                  {shop.name}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">No shops found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const formatDate = (iso: string) => {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
};

export default function Notices() {
  const queryClient = useQueryClient();
  const { data: noticesData, isLoading: noticesLoading, error: noticesError } = useAdminNotices();
  const { data: overviewData, isLoading: overviewLoading } = useAdminOverview();
  
  const shops = overviewData?.shops || [];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<NoticeLevel>("info");
  const [tenantId, setTenantId] = useState<string>("all");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [deleteTarget, setDeleteTarget] = useState<NoticeRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmit = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    
    if (t.length < 2 || t.length > 120) { toast.error("Title must be between 2 and 120 characters"); return; }
    if (b.length < 2 || b.length > 2000) { toast.error("Body must be between 2 and 2000 characters"); return; }
    
    let startISO: string | undefined;
    let endISO: string | undefined;
    
    if (startsAt) startISO = new Date(startsAt).toISOString();
    if (endsAt) endISO = new Date(endsAt).toISOString();
    
    if (startISO && endISO && new Date(endISO) <= new Date(startISO)) {
      toast.error("End date must be after start date");
      return;
    }
    
    setIsSubmitting(true);
    const tid = toast.loading("Publishing notice...");
    try {
      await adminMutate("POST", "/platform/notices", {
        title: t,
        body: b,
        level,
        tenantId: tenantId === "all" ? null : tenantId,
        startsAt: startISO,
        endsAt: endISO
      });
      toast.success("Notice published successfully", { id: tid });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.notices });
      setTitle("");
      setBody("");
      setLevel("info");
      setTenantId("all");
      setStartsAt("");
      setEndsAt("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create notice", { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (notice: NoticeRow) => {
    if (processingId) return;
    setProcessingId(notice.id);
    const newStatus = !notice.isActive;
    try {
      await adminMutate("PATCH", `/platform/notices/${notice.id}`, { isActive: newStatus });
      toast.success(`Notice ${newStatus ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.notices });
    } catch (err: any) {
      toast.error(err.message || "Failed to update notice status");
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const tid = toast.loading("Deleting notice...");
    try {
      await adminMutate("DELETE", `/platform/notices/${deleteTarget.id}`);
      toast.success("Notice deleted", { id: tid });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.notices });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notice", { id: tid });
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedNotices = useMemo(() => {
    if (!noticesData?.notices) return [];
    return [...noticesData.notices].sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [noticesData]);

  if (noticesLoading || overviewLoading) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Notices" meta="Broadcast system messages to shop consoles" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-lg lg:col-span-3" />
          <Skeleton className="h-64 rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (noticesError) {
    return (
      <div className="animate-in fade-in duration-300">
        <PageHeader title="Notices" meta="Broadcast system messages to shop consoles" />
        <LoadError message={(noticesError as Error)?.message} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-12">
      <PageHeader title="Notices" meta="Broadcast system messages to shop consoles" />

      <div className="mt-10 grid lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3">
          <SectionLabel>Notice history</SectionLabel>
          <Panel>
            {sortedNotices.length === 0 ? (
              <EmptyState title="No notices" hint="Broadcast messages to all shops, or send a specific message to a single shop." />
            ) : (
              <Rows>
                {sortedNotices.map(notice => {
                  const isGlobal = !notice.tenantId;
                  const isFuture = notice.startsAt && new Date(notice.startsAt) > new Date();

                  let statusTone: Tone = "neutral";
                  let statusLabel = "Inactive";
                  if (!notice.isActive) { statusTone = "neutral"; statusLabel = "Inactive"; }
                  else if (notice.isLive) { statusTone = "positive"; statusLabel = "Live now"; }
                  else { statusTone = "warn"; statusLabel = isFuture ? "Scheduled" : "Passed"; }

                  let levelTone: Tone = "neutral";
                  if (notice.level === "warning") levelTone = "warn";
                  if (notice.level === "critical") levelTone = "danger";

                  return (
                    <div key={notice.id} className={`p-4 transition-colors ${!notice.isActive ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium">{notice.title}</span>
                            <Tag tone={statusTone}>{statusLabel}</Tag>
                            <Tag tone={levelTone}>{notice.level}</Tag>
                          </div>
                          <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap break-words">{notice.body}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            <span>{isGlobal ? "Global broadcast" : notice.shopName}</span>
                            {(notice.startsAt || notice.endsAt) && (
                              <>
                                <span>·</span>
                                <span>{notice.startsAt ? formatDate(notice.startsAt) : 'Now'} → {notice.endsAt ? formatDate(notice.endsAt) : 'Forever'}</span>
                              </>
                            )}
                            {notice.createdBy && (
                              <>
                                <span>·</span>
                                <span className="normal-case tracking-normal">by {notice.createdBy}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => handleToggle(notice)}
                            disabled={!!processingId}
                          >
                            {notice.isActive ? "Turn off" : "Turn on"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => setDeleteTarget(notice)}
                            disabled={!!processingId}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Rows>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <SectionLabel>Compose notice</SectionLabel>
          <Panel>
            <div className="p-4 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Target audience</label>
                <ShopPicker 
                  shops={shops} 
                  value={tenantId} 
                  onChange={setTenantId} 
                  disabled={isSubmitting || overviewLoading} 
                />
                {tenantId === "all" && (
                  <div className="mt-2">
                    <Notice tone="danger">Global broadcasts interrupt every active user. Use cautiously.</Notice>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Urgency level</label>
                <div className="flex flex-wrap gap-2">
                  {(['info', 'warning', 'critical'] as NoticeLevel[]).map(l => (
                    <button
                      key={l}
                      onClick={() => !isSubmitting && setLevel(l)}
                      className={`h-8 rounded-md px-3 text-[11px] font-medium uppercase tracking-[0.14em] border transition-colors ${
                        level === l ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Title</label>
                <Input 
                  placeholder="e.g. Scheduled maintenance" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Message</label>
                <textarea 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="The message that will appear in their console..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Starts at</span>
                    <span className="font-normal opacity-70 tracking-normal capitalize">Optional</span>
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={startsAt} 
                    onChange={e => setStartsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="rounded-md text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Ends at</span>
                    <span className="font-normal opacity-70 tracking-normal capitalize">Optional</span>
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={endsAt} 
                    onChange={e => setEndsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="rounded-md text-[13px]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Publish notice
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-destructive">Confirm deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">Are you sure you want to delete this notice?</p>
            {deleteTarget && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md text-[13px] border">
                {deleteTarget.title}
              </div>
            )}
            <p className="text-[13px] text-muted-foreground mt-4">
              This action cannot be undone. If the notice is currently live, it will immediately disappear from shop consoles.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
