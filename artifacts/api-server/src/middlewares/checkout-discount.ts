import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  authUsersTable,
  staffProfilesTable,
  staffPermissionsTable,
} from "@workspace/db";
import {
  CHECKOUT_DISCOUNT_PERMISSION,
  hasCheckoutDiscountGrant,
} from "../lib/checkout-discount-policy";

export async function canEditCheckoutDiscount(req: Request): Promise<boolean> {
  if (req.authKind === "email" && req.userId) {
    const [user] = await db
      .select()
      .from(authUsersTable)
      .where(eq(authUsersTable.id, req.userId));
    return (
      !!user?.isActive &&
      (user.tenantId ?? null) === (req.tenantId ?? null) &&
      hasCheckoutDiscountGrant(user.role)
    );
  }
  if (!req.staffId) return false;
  const [member] = await db
    .select()
    .from(staffProfilesTable)
    .where(eq(staffProfilesTable.id, req.staffId));
  if (!member?.isActive || (member.tenantId ?? null) !== (req.tenantId ?? null))
    return false;
  if (member.role === "owner") return true;
  const permissions = await db
    .select()
    .from(staffPermissionsTable)
    .where(
      and(
        eq(staffPermissionsTable.staffId, req.staffId),
        eq(staffPermissionsTable.resource, CHECKOUT_DISCOUNT_PERMISSION),
      ),
    );
  return permissions.some((permission) =>
    hasCheckoutDiscountGrant(member.role, permission.level),
  );
}
