import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminNotices, useAdminOverview, adminMutate, adminQueryKeys } from "./api";
import { NoticeRow, NoticeLevel } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Search, Loader2 } from "lucide-react";
import {
  PageHeader, SectionLabel, Panel, Rows, Tag, EmptyState, LoadError, Notice, type Tone, PanelSkeleton, formatDateTime
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
      <button 
        type="button"
        className={`flex w-full items-center justify-between h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-300"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className={value === "all" ? "font-bold text-red-600" : "truncate text-gray-900 font-semibold"}>
          {value === "all" ? "Global broadcast (All shops)" : selected?.name || "Select shop..."}
        </span>
        <Search className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1.5 w-full z-50 rounded-xl border border-gray-100 bg-white shadow-lg outline-none max-h-64 flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-gray-100 px-3 shrink-0 bg-gray-50/80">
              <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
              <input 
                className="flex h-10 w-full bg-transparent py-2 text-[13px] text-gray-900 outline-none placeholder:text-gray-400 font-medium" 
                placeholder="Search shops..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-1.5 flex-1">
              <button 
                type="button"
                className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 px-2.5 text-[13px] outline-none hover:bg-red-50 hover:text-red-700 font-bold text-red-600 transition-colors mb-1 text-left"
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
              >
                Global broadcast (All shops)
              </button>
              <div className="h-px bg-gray-100 my-1 mx-2" />
              {filtered.map(shop => (
                <button
                  key={shop.id}
                  type="button"
                  className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 px-2.5 text-[13px] font-semibold text-gray-700 outline-none hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
                  onClick={() => { onChange(shop.id); setOpen(false); setSearch(""); }}
                >
                  {shop.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-4 text-center text-[12px] text-gray-400 font-medium">No shops found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
      <div className="animate-in fade-in duration-300 pb-12">
        <PageHeader title="Notices" meta="Broadcast system messages to shop consoles" />
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SectionLabel>Notice history</SectionLabel>
            <PanelSkeleton rows={4} />
          </div>
          <div className="lg:col-span-2">
            <SectionLabel>Compose notice</SectionLabel>
            <PanelSkeleton rows={6} />
          </div>
        </div>
      </div>
    );
  }

  if (noticesError || (!noticesData && !noticesLoading)) {
    return (
      <div className="animate-in fade-in duration-300 pb-12">
        <PageHeader title="Notices" meta="Broadcast system messages to shop consoles" />
        <LoadError 
          message={(noticesError as Error)?.message || "Failed to load notices"} 
          onRetry={() => queryClient.invalidateQueries({ queryKey: adminQueryKeys.notices })} 
        />
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
                    <div key={notice.id} className={`p-5 transition-colors ${!notice.isActive ? 'opacity-60 bg-gray-50/50' : 'bg-white hover:bg-gray-50/30'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-bold text-gray-900">{notice.title}</span>
                            <Tag tone={statusTone}>{statusLabel}</Tag>
                            <Tag tone={levelTone}>{notice.level}</Tag>
                          </div>
                          <p className="mt-2 text-[13px] leading-relaxed text-gray-600 whitespace-pre-wrap break-words">{notice.body}</p>
                          <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                            <span className={isGlobal ? "text-violet-600 font-bold" : ""}>{isGlobal ? "Global broadcast" : notice.shopName}</span>
                            {(notice.startsAt || notice.endsAt) && (
                              <>
                                <span className="opacity-50">·</span>
                                <span>{notice.startsAt ? formatDateTime(notice.startsAt) : 'Now'} → {notice.endsAt ? formatDateTime(notice.endsAt) : 'Forever'}</span>
                              </>
                            )}
                            {notice.createdBy && (
                              <>
                                <span className="opacity-50">·</span>
                                <span className="normal-case tracking-normal font-medium text-gray-500" title={notice.createdBy}>
                                  by <span className="truncate max-w-[150px] inline-block align-bottom">{notice.createdBy}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-0.5">
                          <Button
                            variant={notice.isActive ? "outline" : "default"}
                            size="sm"
                            className={`h-8 text-[11px] px-3 font-semibold ${notice.isActive ? 'text-gray-600 hover:text-gray-900 focus-visible:ring-violet-500/40' : 'bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-violet-500/40'}`}
                            onClick={() => handleToggle(notice)}
                            disabled={!!processingId}
                          >
                            {notice.isActive ? "Turn off" : "Turn on"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors rounded-lg focus-visible:ring-violet-500/40"
                            onClick={() => setDeleteTarget(notice)}
                            disabled={!!processingId}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
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
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Target audience</label>
                <ShopPicker 
                  shops={shops} 
                  value={tenantId} 
                  onChange={setTenantId} 
                  disabled={isSubmitting || overviewLoading} 
                />
                {tenantId === "all" && (
                  <div className="mt-3">
                    <Notice tone="danger">Global broadcasts interrupt every active user. Use cautiously.</Notice>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Urgency level</label>
                <div className="flex flex-wrap gap-2">
                  {(['info', 'warning', 'critical'] as NoticeLevel[]).map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => !isSubmitting && setLevel(l)}
                      className={`h-9 rounded-lg px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-1 ${
                        level === l 
                          ? 'bg-gray-900 text-white shadow-sm ring-1 ring-gray-900' 
                          : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:ring-gray-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Title</label>
                <Input 
                  placeholder="e.g. Scheduled maintenance" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 rounded-lg text-[13px] focus-visible:ring-violet-500/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Message</label>
                <textarea 
                  className="flex min-h-[120px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 resize-y shadow-sm"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="The message that will appear in their console..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    <span>Starts at</span>
                    <span className="font-semibold opacity-70 tracking-normal capitalize">Optional</span>
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={startsAt} 
                    onChange={e => setStartsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="h-10 rounded-lg text-[13px] focus-visible:ring-violet-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
                    <span>Ends at</span>
                    <span className="font-semibold opacity-70 tracking-normal capitalize">Optional</span>
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={endsAt} 
                    onChange={e => setEndsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="h-10 rounded-lg text-[13px] focus-visible:ring-violet-500/40"
                  />
                </div>
              </div>

              <div className="pt-3">
                <Button className="w-full font-semibold rounded-lg h-10" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Publish notice
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold text-red-600">Confirm deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[13px] text-gray-700">Are you sure you want to delete this notice?</p>
            {deleteTarget && (
              <div className="mt-3 p-3 bg-red-50/50 rounded-xl text-[13px] font-medium border border-red-100 text-gray-900">
                {deleteTarget.title}
              </div>
            )}
            <p className="text-[12px] text-gray-500 mt-4 leading-relaxed">
              This action cannot be undone. If the notice is currently live, it will immediately disappear from shop consoles.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="font-semibold">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="font-semibold rounded-lg">
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Delete notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
