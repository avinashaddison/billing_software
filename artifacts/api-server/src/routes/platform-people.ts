/**
 * Platform-admin control over WHO can get into a shop.
 *
 * The vendor gets asked two things constantly: "my staff forgot their PIN"
 * and "my staff is locked out". Neither could be answered from the admin
 * panel before — the vendor had to go into the database.
 *
 * A note on the obvious missing feature: there is deliberately no endpoint
 * that reveals an existing PIN or password. Both are bcrypt hashes, so the
 * plaintext genuinely is not recoverable — not by this panel, not by anyone.
 * The answer to "what is their PIN" is "set a new one and tell them", which
 * is what these routes do.
 *
 * Every write is scoped by tenant on the row being changed, so a staff id
 * belonging to shop B can never be modified through shop A's URL.
 */

import { Router, type IRouter } from "express";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { db, authUsersTable, staffProfilesTable, authSessionsTable, tenantsTable } from "@workspace/db";
import { recordAudit } from "../lib/audit";
import { requirePlatformAdmin } from "../middlewares/platform-admin";
import { clientMeta, createSession } from "../lib/sessions";
import { TENANT_COOKIE_NAME, signTenantCookie, tenantCookieOptions } from "../middlewares/tenant";

const router: IRouter = Router();

/** Matches routes/staff.ts so the PIN login path verifies these the same way. */
const PIN_ROUNDS = 10;
/** Matches routes/auth.ts + routes/platform.ts for email passwords. */
const PASSWORD_ROUNDS = 12;

/** Unbiased 4-digit PIN, zero-padded ("0042" is a valid PIN). */
function generatePin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

function isFourDigits(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}$/.test(v);
}

function isValidPassword(v: unknown): v is string {
  return typeof v === "string" && v.length >= 8 && v.length <= 128;
}

/* ───── POST /api/platform/tenants/:id/staff/:staffId/pin ─────────────
 *
 * Set a new PIN for one staff member. Body: { pin?: "1234" } — omit it and
 * a random one is generated. The plaintext comes back in the response ONCE
 * so the vendor can read it out to the shop; it is never stored in the clear
 * and never written to the audit log.
 *
 * Resetting also clears any lockout, since "forgot the PIN" and "locked out
 * from guessing it" are the same phone call.
 */
router.post("/platform/tenants/:id/staff/:staffId/pin", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const staffId = String(req.params.staffId);
  const supplied = req.body?.pin;

  if (supplied != null && supplied !== "" && !isFourDigits(supplied)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }
  const pin = isFourDigits(supplied) ? supplied : generatePin();

  try {
    /* Tenant predicate sits on the row being written, so a staff id from
       another shop simply does not match and comes back as 404. */
    const [member] = await db
      .select({ id: staffProfilesTable.id, name: staffProfilesTable.name })
      .from(staffProfilesTable)
      .where(and(eq(staffProfilesTable.id, staffId), eq(staffProfilesTable.tenantId, tenantId)));
    if (!member) {
      res.status(404).json({ error: "Staff member not found in this shop" });
      return;
    }

    await db
      .update(staffProfilesTable)
      .set({ pin: await bcrypt.hash(pin, PIN_ROUNDS), failedAttempts: 0, lockedUntil: null })
      .where(and(eq(staffProfilesTable.id, member.id), eq(staffProfilesTable.tenantId, tenantId)));

    void recordAudit({
      action:       "tenant.staff_pin_reset",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      /* staff name only — the PIN itself must never reach the audit log */
      metadata:     { staffId: member.id, staffName: member.name, generated: !isFourDigits(supplied) },
    });

    res.json({ ok: true, staffId: member.id, staffName: member.name, pin });
  } catch {
    res.status(500).json({ error: "Failed to set a new PIN" });
  }
});

/* ───── POST /api/platform/tenants/:id/staff/:staffId/unlock ─────────
 * Clear a wrong-PIN lockout without changing the PIN. */
router.post("/platform/tenants/:id/staff/:staffId/unlock", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const staffId = String(req.params.staffId);
  try {
    const updated = await db
      .update(staffProfilesTable)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(and(eq(staffProfilesTable.id, staffId), eq(staffProfilesTable.tenantId, tenantId)))
      .returning({ id: staffProfilesTable.id, name: staffProfilesTable.name });
    if (updated.length === 0) {
      res.status(404).json({ error: "Staff member not found in this shop" });
      return;
    }
    void recordAudit({
      action:       "tenant.staff_unlock",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { staffId, staffName: updated[0].name },
    });
    res.json({ ok: true, staffName: updated[0].name });
  } catch {
    res.status(500).json({ error: "Failed to unlock this staff member" });
  }
});

/* ───── PATCH /api/platform/tenants/:id/staff/:staffId ───────────────
 * Turn one staff member's access on or off. Body: { isActive: boolean } */
router.patch("/platform/tenants/:id/staff/:staffId", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const staffId = String(req.params.staffId);
  const isActive = req.body?.isActive;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be true or false" });
    return;
  }

  try {
    const updated = await db
      .update(staffProfilesTable)
      .set({ isActive })
      .where(and(eq(staffProfilesTable.id, staffId), eq(staffProfilesTable.tenantId, tenantId)))
      .returning({ id: staffProfilesTable.id, name: staffProfilesTable.name });
    if (updated.length === 0) {
      res.status(404).json({ error: "Staff member not found in this shop" });
      return;
    }
    void recordAudit({
      action:       isActive ? "tenant.staff_enabled" : "tenant.staff_disabled",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { staffId, staffName: updated[0].name },
    });
    res.json({ ok: true, staffName: updated[0].name, isActive });
  } catch {
    res.status(500).json({ error: "Failed to update this staff member" });
  }
});

/* ───── PATCH /api/platform/tenants/:id/users/:userId ─────────────────
 * Turn one email login on or off. Body: { isActive: boolean }
 *
 * Refuses to switch off the last active owner: that leaves a shop nobody can
 * administer, looking "active" the whole time. Suspending the shop is the
 * intended way to cut a shop off, and it is reversible in one click.
 */
router.patch("/platform/tenants/:id/users/:userId", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const userId = String(req.params.userId);
  const isActive = req.body?.isActive;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be true or false" });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      /* Lock this shop's active owner logins before deciding anything.
         Read-then-write would let two simultaneous requests each switch off
         a different owner while both still see the other as active, ending
         with a shop nobody can administer. Locking in a fixed id order makes
         concurrent attempts queue up instead of deadlocking each other. */
      const activeOwners = await tx
        .select({ id: authUsersTable.id })
        .from(authUsersTable)
        .where(
          and(
            eq(authUsersTable.tenantId, tenantId),
            eq(authUsersTable.role, "owner"),
            eq(authUsersTable.isActive, true),
          ),
        )
        .orderBy(authUsersTable.id)
        .for("update");

      const [target] = await tx
        .select({
          id:       authUsersTable.id,
          email:    authUsersTable.email,
          role:     authUsersTable.role,
          isActive: authUsersTable.isActive,
        })
        .from(authUsersTable)
        .where(and(eq(authUsersTable.id, userId), eq(authUsersTable.tenantId, tenantId)));
      if (!target) return { kind: "missing" as const };

      /* Only a switch-off of the one remaining active owner is refused;
         re-disabling an already-inactive login is a harmless no-op. */
      const wouldStrandShop =
        !isActive && target.isActive && target.role === "owner" &&
        activeOwners.every((o) => o.id === target.id);
      if (wouldStrandShop) return { kind: "last-owner" as const };

      await tx
        .update(authUsersTable)
        .set({ isActive, updatedAt: new Date() })
        .where(and(eq(authUsersTable.id, target.id), eq(authUsersTable.tenantId, tenantId)));
      return { kind: "ok" as const, email: target.email, role: target.role };
    });

    if (outcome.kind === "missing") {
      res.status(404).json({ error: "Login not found in this shop" });
      return;
    }
    if (outcome.kind === "last-owner") {
      res.status(400).json({
        error: "This is the shop's only active owner login. Switching it off would leave nobody able to run the shop — suspend the shop instead.",
      });
      return;
    }

    void recordAudit({
      action:       isActive ? "tenant.user_enabled" : "tenant.user_disabled",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { userId, email: outcome.email, role: outcome.role },
    });
    res.json({ ok: true, email: outcome.email, isActive });
  } catch {
    res.status(500).json({ error: "Failed to update this login" });
  }
});

/* ───── POST /api/platform/tenants/:id/users/:userId/password ─────────
 * Reset the password of ONE specific login. The older
 * /tenants/:id/owner-password route always targets the earliest-created
 * owner; this one lets the vendor fix a named account instead.
 */
router.post("/platform/tenants/:id/users/:userId/password", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  const userId = String(req.params.userId);
  const password = req.body?.password;

  if (!isValidPassword(password)) {
    res.status(400).json({ error: "Password must be 8–128 characters" });
    return;
  }

  try {
    const [target] = await db
      .select({ id: authUsersTable.id, email: authUsersTable.email })
      .from(authUsersTable)
      .where(and(eq(authUsersTable.id, userId), eq(authUsersTable.tenantId, tenantId)));
    if (!target) {
      res.status(404).json({ error: "Login not found in this shop" });
      return;
    }

    await db
      .update(authUsersTable)
      .set({ passwordHash: await bcrypt.hash(password, PASSWORD_ROUNDS), updatedAt: new Date() })
      .where(and(eq(authUsersTable.id, target.id), eq(authUsersTable.tenantId, tenantId)));

    void recordAudit({
      action:       "tenant.user_password_reset",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { userId: target.id, email: target.email },
    });
    res.json({ ok: true, email: target.email });
  } catch {
    res.status(500).json({ error: "Failed to reset this password" });
  }
});

/* ───── POST /api/platform/tenants/:id/signout-all ───────────────────
 *
 * Kick every device belonging to this shop off immediately.
 *
 * Switching a login off stops the NEXT sign-in; it does not touch a phone
 * that is already signed in and holding a year-long cookie. For a stolen
 * phone or a sacked manager that distinction is the whole problem, so this
 * revokes the session rows themselves — requireAuth checks them on every
 * request, so access dies within one request.
 *
 * Sessions are matched by tenant AND by subject id, because legacy rows from
 * before tenanting carry a NULL tenant_id and would otherwise survive.
 */
router.post("/platform/tenants/:id/signout-all", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  try {
    const [shop] = await db
      .select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!shop) { res.status(404).json({ error: "Shop not found" }); return; }

    const [staffIds, userIds] = await Promise.all([
      db.select({ id: staffProfilesTable.id }).from(staffProfilesTable).where(eq(staffProfilesTable.tenantId, tenantId)),
      db.select({ id: authUsersTable.id }).from(authUsersTable).where(eq(authUsersTable.tenantId, tenantId)),
    ]);
    const subjects = [...staffIds.map((r) => r.id), ...userIds.map((r) => r.id)];

    const revoked = await db
      .update(authSessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(
          isNull(authSessionsTable.revokedAt),
          subjects.length > 0
            ? or(eq(authSessionsTable.tenantId, tenantId), inArray(authSessionsTable.subjectId, subjects))
            : eq(authSessionsTable.tenantId, tenantId),
        ),
      )
      .returning({ id: authSessionsTable.id });

    void recordAudit({
      action:       "tenant.sessions_revoked",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { devices: revoked.length },
    });
    res.json({ ok: true, shopName: shop.name, devices: revoked.length });
  } catch {
    res.status(500).json({ error: "Failed to sign those devices out" });
  }
});

/** A support session is deliberately short — it is for looking at a problem
 *  right now, not a standing key to someone else's shop. */
const VIEW_AS_MINUTES = 60;

/* ───── POST /api/platform/tenants/:id/view-as ───────────────────────
 *
 * Open the shop's own app as the vendor, READ-ONLY.
 *
 * Three things make this safe to point at a live, trading shop:
 *   1. the cookie carries a signed `ro` claim that no client can forge;
 *   2. a gate rejects every non-GET request carrying that claim, so nothing
 *      can be created, edited or deleted while viewing;
 *   3. it expires on its own after an hour, and the session row is visible in
 *      the shop's own device list as "Vendor support" rather than pretending
 *      to be the owner's phone.
 */
router.post("/platform/tenants/:id/view-as", requirePlatformAdmin, async (req, res): Promise<void> => {
  const tenantId = String(req.params.id);
  try {
    const [shop] = await db
      .select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable)
      .where(eq(tenantsTable.id, tenantId));
    if (!shop) { res.status(404).json({ error: "Shop not found" }); return; }

    /* requireAuth validates the subject against the database, so the session
       has to belong to a real, active account in this shop. Prefer an owner
       login; fall back to any active staff profile for shops that only ever
       used PINs. */
    const [owner] = await db
      .select({ id: authUsersTable.id, email: authUsersTable.email })
      .from(authUsersTable)
      .where(and(
        eq(authUsersTable.tenantId, tenantId),
        eq(authUsersTable.role, "owner"),
        eq(authUsersTable.isActive, true),
      ))
      .orderBy(authUsersTable.createdAt);

    let subjectKind: "email" | "pin" = "email";
    let subjectId = owner?.id ?? "";
    let asLabel = owner?.email ?? "";

    if (!owner) {
      const [staff] = await db
        .select({ id: staffProfilesTable.id, name: staffProfilesTable.name })
        .from(staffProfilesTable)
        .where(and(eq(staffProfilesTable.tenantId, tenantId), eq(staffProfilesTable.isActive, true)))
        .orderBy(staffProfilesTable.createdAt);
      if (!staff) {
        res.status(400).json({ error: "This shop has no active account to view it through" });
        return;
      }
      subjectKind = "pin";
      subjectId = staff.id;
      asLabel = staff.name;
    }

    const { userAgent, ip } = clientMeta(req);
    const sid = await createSession({
      tenantId,
      subjectKind,
      subjectId,
      /* Shown in the shop's own devices list — never disguised as their phone. */
      userAgent: `Vendor support (read-only) · ${req.platformActor!.email} · ${userAgent ?? "unknown"}`.slice(0, 400),
      ip,
    });

    res.cookie(
      TENANT_COOKIE_NAME,
      signTenantCookie({
        tenantId,
        staffId:   subjectKind === "pin" ? subjectId : null,
        userId:    subjectKind === "email" ? subjectId : null,
        kind:      subjectKind,
        sessionId: sid,
        readOnly:  true,
      }),
      { ...tenantCookieOptions(), maxAge: VIEW_AS_MINUTES * 60 * 1000 },
    );

    void recordAudit({
      action:       "tenant.viewed_as",
      actorId:      req.platformActor!.id,
      actorEmail:   req.platformActor!.email,
      targetTenant: tenantId,
      ip:           req.ip,
      metadata:     { as: asLabel, subjectKind, minutes: VIEW_AS_MINUTES },
    });

    res.json({ ok: true, shopName: shop.name, as: asLabel, minutes: VIEW_AS_MINUTES });
  } catch {
    res.status(500).json({ error: "Failed to open that shop" });
  }
});

/* ───── POST /api/platform/view-as/exit — end the support session ───── */
router.post("/platform/view-as/exit", requirePlatformAdmin, async (req, res): Promise<void> => {
  try {
    /* Revoke the row as well as dropping the cookie, so a copy of the cookie
       taken during the session is dead too. */
    if (req.sessionId) {
      await db
        .update(authSessionsTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessionsTable.id, req.sessionId), isNull(authSessionsTable.revokedAt)));
    }
    res.clearCookie(TENANT_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to close the support session" });
  }
});

export default router;
