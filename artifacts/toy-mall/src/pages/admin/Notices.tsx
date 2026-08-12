import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminNotices, useAdminOverview, adminMutate, adminQueryKeys } from "./api";
import { NoticeRow, NoticeLevel } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Megaphone, Info, AlertTriangle, ShieldAlert,
  Loader2, Trash2, Power, PowerOff,
  Calendar, Building2, Search
} from "lucide-react";

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
        className={`flex items-center justify-between min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50 transition-colors"}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        <span className={value === "all" ? "font-bold text-destructive flex items-center gap-2" : "font-medium flex items-center gap-2"}>
          <Building2 className={`w-4 h-4 ${value === 'all' ? 'text-destructive' : 'text-muted-foreground'}`} />
          {value === "all" ? "Global Broadcast (All Shops)" : selected?.name || "Select shop..."}
        </span>
        <Search className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none max-h-80 flex flex-col">
            <div className="flex items-center border-b px-3 shrink-0">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input 
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" 
                placeholder="Search shops..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-1 flex-1">
              <div 
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-2 pr-2 text-sm outline-none hover:bg-destructive/10 hover:text-destructive font-bold text-destructive transition-colors mb-1"
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
              >
                <Megaphone className="w-4 h-4 mr-2" /> Global Broadcast (All Shops)
              </div>
              <div className="h-px bg-border my-1" />
              {filtered.map(shop => (
                <div
                  key={shop.id}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-2 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => { onChange(shop.id); setOpen(false); setSearch(""); }}
                >
                  {shop.name}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No shops found.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const LEVEL_STYLES: Record<NoticeLevel, { bg: string, border: string, text: string, icon: React.ElementType, badge: string }> = {
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    icon: Info,
    badge: "bg-blue-500/10 text-blue-600"
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    icon: AlertTriangle,
    badge: "bg-amber-500/10 text-amber-600"
  },
  critical: {
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
    icon: ShieldAlert,
    badge: "bg-destructive/10 text-destructive"
  }
};

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notices</h1>
        <p className="text-muted-foreground mt-1">Broadcast system messages to shop consoles</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: List */}
        <div className="lg:col-span-2 space-y-4">
          {noticesError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-medium">Could not load notices</p>
              <p className="mt-1 text-sm text-muted-foreground">{(noticesError as Error)?.message ?? "Unknown error"}</p>
            </div>
          ) : noticesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl w-full" />)}
            </div>
          ) : sortedNotices.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-lg">No notices found</p>
                <p className="text-sm text-muted-foreground max-w-[300px] mt-2">
                  Broadcast messages to all shops, or send a specific message to a single shop. They will appear as banners in their console.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedNotices.map(notice => {
                const Icon = LEVEL_STYLES[notice.level].icon;
                const isGlobal = !notice.tenantId;
                
                const isFuture = notice.startsAt && new Date(notice.startsAt) > new Date();
                const statusNode = !notice.isActive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider border border-border">
                    Inactive
                  </span>
                ) : notice.isLive ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase tracking-wider flex items-center gap-1 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 uppercase tracking-wider border border-amber-500/20">
                    {isFuture ? "Scheduled" : "Window Passed"}
                  </span>
                );

                return (
                  <Card key={notice.id} className={`overflow-hidden transition-colors ${!notice.isActive ? 'opacity-70' : ''}`}>
                    <div className={`h-1.5 w-full ${notice.level === 'critical' ? 'bg-destructive' : notice.level === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${notice.level === 'critical' ? 'text-destructive' : notice.level === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold truncate">{notice.title}</h3>
                              {statusNode}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{notice.body}</p>
                            
                            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-muted-foreground font-medium">
                              <span className={`flex items-center gap-1.5 ${isGlobal ? 'text-destructive font-bold' : ''}`}>
                                <Building2 className="w-3.5 h-3.5" />
                                {isGlobal ? "Global Broadcast (All Shops)" : notice.shopName}
                              </span>
                              
                              {(notice.startsAt || notice.endsAt) && (
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {notice.startsAt ? formatDate(notice.startsAt) : 'Now'} 
                                  <span className="text-muted-foreground/50">→</span>
                                  {notice.endsAt ? formatDate(notice.endsAt) : 'Forever'}
                                </span>
                              )}
                              
                              {notice.createdBy && (
                                <span className="text-muted-foreground/60">&middot; by {notice.createdBy}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant={notice.isActive ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleToggle(notice)}
                            disabled={!!processingId}
                          >
                            {processingId === notice.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : notice.isActive ? (
                              <><PowerOff className="w-4 h-4 mr-2" /> Turn Off</>
                            ) : (
                              <><Power className="w-4 h-4 mr-2" /> Turn On</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(notice)}
                            disabled={!!processingId}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Create Form */}
        <div className="lg:col-span-1 sticky top-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-primary" /> Create Notice
              </CardTitle>
              <CardDescription>Compose a new message</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <ShopPicker 
                  shops={shops} 
                  value={tenantId} 
                  onChange={setTenantId} 
                  disabled={isSubmitting || overviewLoading} 
                />
                {tenantId === "all" && (
                  <div className="mt-2 bg-destructive/10 text-destructive p-2.5 rounded-md border border-destructive/20 text-xs font-semibold flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <p>Global broadcasts interrupt every active user on the platform. Use cautiously.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'warning', 'critical'] as NoticeLevel[]).map(l => {
                    const active = level === l;
                    const S = LEVEL_STYLES[l];
                    const Icon = S.icon;
                    return (
                      <div
                        key={l}
                        onClick={() => !isSubmitting && setLevel(l)}
                        className={`cursor-pointer rounded-md border p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'} ${active ? `${S.border} ${S.bg} ring-1 ring-ring` : 'border-input'}`}
                      >
                        <Icon className={`w-4 h-4 ${active ? S.text : 'text-muted-foreground'}`} />
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? S.text : 'text-muted-foreground'}`}>{l}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input 
                  placeholder="e.g. Scheduled Maintenance" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message Body</label>
                <textarea 
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="The message that will appear in their console..."
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Starts At (Optional)</label>
                  <Input 
                    type="datetime-local" 
                    value={startsAt} 
                    onChange={e => setStartsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Ends At (Optional)</label>
                  <Input 
                    type="datetime-local" 
                    value={endsAt} 
                    onChange={e => setEndsAt(e.target.value)} 
                    disabled={isSubmitting}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Banner Preview</label>
                <div className={`p-4 rounded-lg border ${LEVEL_STYLES[level].border} ${LEVEL_STYLES[level].bg}`}>
                  <div className="flex gap-3">
                    {React.createElement(LEVEL_STYLES[level].icon, { className: `w-5 h-5 shrink-0 mt-0.5 ${LEVEL_STYLES[level].text}` })}
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className={`font-semibold text-sm ${LEVEL_STYLES[level].text}`}>{title || "Notice Title"}</h4>
                      <p className={`text-sm opacity-90 whitespace-pre-wrap break-words min-h-[2.5rem] ${LEVEL_STYLES[level].text}`}>
                        {body || "The notice body will appear here..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-2" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                Publish Notice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-5 h-5" /> Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete this notice?</p>
            {deleteTarget && (
              <div className="mt-3 p-3 bg-muted rounded-md text-sm font-medium border">
                {deleteTarget.title}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              This action cannot be undone. If the notice is currently live, it will immediately disappear from shop consoles.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Notice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
