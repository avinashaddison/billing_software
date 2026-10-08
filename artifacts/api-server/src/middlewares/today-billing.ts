import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  staffProfilesTable,
  staffPermissionsTable,
  authUsersTable,
} from "@workspace/db";

export function hasTodayBillingGrant(
  role: string,
  level?: string | null,
): boolean {
  return role === "owner" || level === "write";
}

export function billingAccessFor(role: string, levels: Record<string, string>) {
  const owner = role === "owner";
  return {
    today: hasTodayBillingGrant(role, levels.todayBilling),
    history: owner || levels.billing === "read" || levels.billing === "write",
    checkout: owner || levels.scan === "write",
  };
}

/** Resolve from the database on EVERY request, never from browser state.
 * Revocation is immediate, and a grant in another tenant cannot authorize. */
export async function getBillingAccess(req: Request) {
  const none = billingAccessFor("staff", {});
  if (req.authKind === "email" && req.userId) {
    const [user] = await db
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.id, req.userId));
    return user?.isActive &&
      (user.tenantId ?? null) === (req.tenantId ?? null) &&
      (user.role === "owner" || user.role === "admin")
      ? billingAccessFor("owner", {})
      : none;
  }
  if (!req.staffId) return none;
  const [staff] = await db
    .select()
    .from(staffProfilesTable)
    .where(eq(staffProfilesTable.id, req.staffId));
  if (!staff?.isActive || (staff.tenantId ?? null) !== (req.tenantId ?? null))
    return none;
  if (staff.role === "owner") return billingAccessFor("owner", {});
  const permissions = await db
    .select()
    .from(staffPermissionsTable)
    .where(and(eq(staffPermissionsTable.staffId, staff.id)));
  return billingAccessFor(
    staff.role,
    Object.fromEntries(permissions.map((p) => [p.resource, p.level])),
  );
}

export async function canViewTodaysBilling(req: Request): Promise<boolean> {
  return (await getBillingAccess(req)).today;
}

export async function requireTodayBilling(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (await canViewTodaysBilling(req)) {
      next();
      return;
    }
    res
      .status(403)
      .json({
        error:
          "Ask the owner to allow Today's Bills & Totals in Staff Permissions.",
      });
  } catch {
    res
      .status(503)
      .json({
        error: "Unable to verify today's billing permission. Please retry.",
      });
  }
}

/** These reports/ledgers include current-day money and would bypass the
 * list's restriction. Checkout and individual own-receipt reads are excluded. */
export function isDailyMoneyRead(method: string, path: string): boolean {
  return (
    (method === "GET" || method === "HEAD") &&
    (/^\/(reports|customers|sales|receivables)(\/|$)/.test(path) ||
      path === "/dashboard/receivables" ||
      /^\/suppliers\/[^/]+\/report$/.test(path) ||
      /^\/products\/[^/]+\/timeline$/.test(path))
  );
}

export function dailyMoneyReadGate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isDailyMoneyRead(req.method, req.path)) {
    void requireTodayBilling(req, res, next);
    return;
  }
  next();
}
