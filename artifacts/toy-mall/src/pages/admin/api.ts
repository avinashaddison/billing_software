import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OverviewData, TenantDetailData, TenantPeople, MoneyData, NoticeRow, HealthData } from "./types";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;


export const adminFetch = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (!res.ok) {
    let err = "Network error";
    try {
      const data = await res.json();
      if (data.error) err = data.error;
    } catch {}
    throw new Error(err);
  }
  return res.json();
};

export const adminQueryKeys = {
  me: ["admin", "me"],
  overview: ["admin", "overview"],
  tenantDetail: (id: string) => ["admin", "tenant", id],
  users: (id: string) => ["admin", "tenant", id, "users"],
  pricing: ["admin", "pricing"],
  backups: ["admin", "backups"],
  audit: ["admin", "audit"],
  money: ["admin", "money"],
  notices: ["admin", "notices"],
  health: ["admin", "health"],
};

export function useAdminMe() {
  return useQuery({
    queryKey: adminQueryKeys.me,
    queryFn: () => adminFetch(`${API}/platform/me`),
    retry: false,
  });
}

export function useAdminOverview() {
  return useQuery<OverviewData>({
    queryKey: adminQueryKeys.overview,
    queryFn: () => adminFetch(`${API}/platform/overview`),
  });
}

export function useAdminTenantDetail(id: string) {
  return useQuery<TenantDetailData>({
    queryKey: adminQueryKeys.tenantDetail(id),
    queryFn: () => adminFetch(`${API}/platform/tenants/${id}/detail`),
    enabled: !!id,
  });
}

export function useAdminTenantUsers(id: string) {
  return useQuery<TenantPeople>({
    queryKey: adminQueryKeys.users(id),
    queryFn: () => adminFetch(`${API}/platform/tenants/${id}/users`),
    enabled: !!id,
  });
}

export function useAdminPricing() {
  return useQuery({
    queryKey: adminQueryKeys.pricing,
    queryFn: () => adminFetch(`${API}/platform/settings`),
  });
}

export function useAdminBackups() {
  return useQuery({
    queryKey: adminQueryKeys.backups,
    queryFn: () => adminFetch(`${API}/platform/backups`),
  });
}

export function useAdminAudit() {
  return useQuery({
    queryKey: adminQueryKeys.audit,
    queryFn: () => adminFetch(`${API}/platform/audit?limit=100`),
  });
}

export function useAdminMoney() {
  return useQuery<MoneyData>({
    queryKey: adminQueryKeys.money,
    queryFn: () => adminFetch(`${API}/platform/payments`),
  });
}

export function useAdminNotices() {
  return useQuery<{ notices: NoticeRow[] }>({
    queryKey: adminQueryKeys.notices,
    queryFn: () => adminFetch(`${API}/platform/notices`),
  });
}

export function useAdminHealth() {
  return useQuery<HealthData>({
    queryKey: adminQueryKeys.health,
    queryFn: () => adminFetch(`${API}/platform/health`),
    refetchInterval: 30_000,
  });
}

/** POST/PATCH/DELETE helper for the admin console. */
export function adminMutate(method: string, path: string, body?: unknown) {
  return adminFetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
