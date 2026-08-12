import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OverviewData, TenantDetailData, TenantPeople } from "./types";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;


const fetcher = async (url: string, options: RequestInit = {}) => {
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
};

export function useAdminMe() {
  return useQuery({
    queryKey: adminQueryKeys.me,
    queryFn: () => fetcher(`${API}/platform/me`),
    retry: false,
  });
}

export function useAdminOverview() {
  return useQuery<OverviewData>({
    queryKey: adminQueryKeys.overview,
    queryFn: () => fetcher(`${API}/platform/overview`),
  });
}

export function useAdminTenantDetail(id: string) {
  return useQuery<TenantDetailData>({
    queryKey: adminQueryKeys.tenantDetail(id),
    queryFn: () => fetcher(`${API}/platform/tenants/${id}/detail`),
    enabled: !!id,
  });
}

export function useAdminTenantUsers(id: string) {
  return useQuery<TenantPeople>({
    queryKey: adminQueryKeys.users(id),
    queryFn: () => fetcher(`${API}/platform/tenants/${id}/users`),
    enabled: !!id,
  });
}

export function useAdminPricing() {
  return useQuery({
    queryKey: adminQueryKeys.pricing,
    queryFn: () => fetcher(`${API}/platform/settings`),
  });
}

export function useAdminBackups() {
  return useQuery({
    queryKey: adminQueryKeys.backups,
    queryFn: () => fetcher(`${API}/platform/backups`),
  });
}

export function useAdminAudit() {
  return useQuery({
    queryKey: adminQueryKeys.audit,
    queryFn: () => fetcher(`${API}/platform/audit?limit=100`),
  });
}
