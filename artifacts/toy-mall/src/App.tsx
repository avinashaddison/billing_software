import { Switch, Route, Router as WouterRouter, useLocation, useSearch, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { SnowOverlay } from "@/components/effects/SnowOverlay";
import { CartProvider } from "@/contexts/cart-context";
import { useEffect }           from "react";
import { useRealtime }         from "@/hooks/use-realtime";
import { useOwnerIdle } from "@/hooks/use-owner-idle";
import { useAuth, usePermission, useCanCreateProducts } from "@/hooks/use-auth";
import { useStoreSettings }    from "@/lib/store-info";
import { type ResourceKey } from "@/lib/permissions";
import NotFound from "@/pages/not-found";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Dashboard      from "@/pages/Dashboard";
import Products       from "@/pages/Products";
import ProductsNew    from "@/pages/ProductsNew";
import ProductsEntry  from "@/pages/ProductsEntry";
import ProductDetail  from "@/pages/ProductDetail";
import BulkSalePrice  from "@/pages/BulkSalePrice";
import Scan           from "@/pages/Scan";
import Logs           from "@/pages/Logs";
import TodayOut       from "@/pages/TodayOut";
import StockAlert     from "@/pages/StockAlert";
import Analytics      from "@/pages/Analytics";
import ProductReport  from "@/pages/ProductReport";
import Profile        from "@/pages/Profile";
import Bill           from "@/pages/Bill";
import Billing        from "@/pages/Billing";
import Suppliers      from "@/pages/Suppliers";
import SupplierReport from "@/pages/SupplierReport";
import StockCheck from "@/pages/StockCheck";
import Customers      from "@/pages/Customers";
import Report         from "@/pages/Report";
import Labels         from "@/pages/Labels";
import Categories     from "@/pages/Categories";
import Deals          from "@/pages/Deals";
import Login          from "@/pages/Login";
import StaffManagement from "@/pages/StaffManagement";
import Checkout        from "@/pages/Checkout";
import SettingsPage    from "@/pages/Settings";
import AdminPage       from "@/pages/admin/index";
import Landing         from "@/pages/Landing";
import Legal           from "@/pages/Legal";
import Developers      from "@/pages/Developers";

/**
 * Global 401 guard. The API now enforces authentication server-side, so a
 * stale / expired / revoked session returns 401 on protected /api routes.
 * Without this the SPA would show a broken, empty page instead of bouncing
 * the user back to the login screen.
 *
 * Scope is deliberately narrow: it only reacts to 401s on protected /api
 * calls, and only when we currently believe we're logged in — so login,
 * platform-admin, and the auth-probe (/auth/me) requests never trigger a
 * spurious logout/redirect loop.
 */
function AuthFetchGuard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const generation = useAuth.getState().sessionGeneration;
      const response = await original(...args);
      try {
        if (response.status === 401) {
          const input = args[0];
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input instanceof Request
                  ? input.url
                  : "";
          const isApi = url.includes("/api/");
          const isExempt =
            url.includes("/api/auth/login") || // login + login-email
            url.includes("/api/auth/me") ||    // session probe on boot
            url.includes("/api/platform/");    // vendor /admin console
          if (isApi && !isExempt && useAuth.getState().isLoggedIn
            && useAuth.getState().sessionGeneration === generation) {
            useAuth.getState().logout();
            setLocation("/login");
          }
        }
      } catch {
        /* never let the guard break a real request */
      }
      return response;
    };
    return () => { window.fetch = original; };
  }, [setLocation]);
  return null;
}

/**
 * Boot-time session reconciliation. The client persists `isLoggedIn` in
 * localStorage, but the real session lives in an httpOnly cookie. A deploy
 * that rotates SESSION_SECRET (or a server-side logout) invalidates that
 * cookie while the browser still believes it's logged in — which would
 * render the whole app shell against a dead session and crash on the first
 * 401. We probe /api/auth/me once on boot and, ONLY on a definitive 401,
 * drop the client session so the router cleanly sends the user to /login.
 * Network errors are ignored so a brief blip never logs anyone out.
 */
function SessionSync() {
  useOwnerIdle();
  useEffect(() => {
    const { isLoggedIn, staffId: probedStaffId } = useAuth.getState();
    if (!isLoggedIn) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    let cancelled = false;
    /* Every verdict below is about the session that was signed in when the
       probe STARTED. If the user logged out — or out and back in as someone
       else — while it was in flight, the answer describes a session that no
       longer exists; acting on it would log out a fresh login or paste one
       account's permissions onto another. */
    const sameSession = () => {
      const s = useAuth.getState();
      return s.isLoggedIn && s.staffId === probedStaffId;
    };
    (async () => {
      try {
        const r = await fetch(`${base}/api/auth/me`);
        if (cancelled || !sameSession()) return;
        if (r.status === 401) { useAuth.getState().logout(); return; }
        if (r.ok) {
          /* Client `isLoggedIn` means a COMPLETED staff (PIN) session for the
             persisted staff id. If the cookie only carries the pre-PIN email
             step (kind:"email"), any other shape, or a DIFFERENT staff
             account, the persisted login is stale — drop it so the user
             re-selects staff + PIN instead of running one account's screens
             against another account's cookie. */
          const me = await r.json().catch(() => null);
          if (cancelled || !sameSession()) return;
          if (me?.kind !== "pin" || me.id !== probedStaffId) { useAuth.getState().logout(); return; }
          /* Same session, but the grants may have moved on since the PIN
             login that seeded the persisted map (owner edited them, or a
             release introduced a new permission key that the server has
             since backfilled). Adopt the server's map — it is what every
             write gate will actually be checked against. */
          if (me.permissions && typeof me.permissions === "object") {
            useAuth.getState().syncPermissions(me.permissions);
          }
        }
      } catch { /* offline / transient — keep the session as-is */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  // One-shot: pull settings from the server so they persist across devices
  // and survive browser cache clears.
  const hydrate = useStoreSettings((s) => s.hydrateFromServer);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return <>{children}</>;
}

function AccessRestricted({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-6" data-testid="access-restricted">
      <div className="text-5xl">🔒</div>
      <div>
        <p className="text-xl font-black text-foreground">Access Restricted</p>
        <p className="text-sm text-muted-foreground mt-1">
          {hint ?? "You don't have permission to view this page."}<br />
          Ask the owner to grant you access.
        </p>
      </div>
    </div>
  );
}

/** Render page only if user has required access level, else show blocked screen */
function Protected({ resource, children, allowToday = false, allowReceipt = false }: {
  resource: ResourceKey; children: React.ReactNode; allowToday?: boolean; allowReceipt?: boolean;
}) {
  const level = usePermission(resource);
  const todayLevel = usePermission("todayBilling");
  const checkoutLevel = usePermission("scan");
  if (level === "none" && !(allowToday && todayLevel === "write")
    && !(allowReceipt && checkoutLevel === "write")) return <AccessRestricted />;
  if (["reports", "productReports", "analytics", "customers"].includes(resource) && todayLevel !== "write") {
    return <AccessRestricted hint="This page includes live sales. Ask the owner to enable Today's Bills & Totals." />;
  }
  return <>{children}</>;
}

/* New Product is gated on the ability to CREATE (products: write OR
   productEntry: write — the server's gate on POST /products), not on merely
   being able to browse the catalog. Read-only staff used to reach the whole
   form and only learn at Save that they had no permission. */
function ProtectedProductsNew() {
  const canCreate = useCanCreateProducts();
  /* The form reads `?barcode=` into its defaultValues once, at mount. A
     query-only navigation (second unknown-code toast, history back/forward)
     keeps the same route and would therefore keep the FIRST code in the
     field while the URL names the second. A different barcode is a new
     creation intent, so remount the form for it. */
  const barcodeParam = new URLSearchParams(useSearch()).get("barcode") ?? "";
  if (!canCreate) {
    return <AccessRestricted hint="Adding products needs the Product Entry permission (or Write access to Products)." />;
  }
  return <ProductsNew key={barcodeParam} />;
}

function Router() {
  const { isLoggedIn } = useAuth();
  const [location] = useLocation();

  /* Vendor platform admin — handles its own auth, full-screen, no AppLayout. */
  if (location === "/admin") return <AdminPage />;

  /* "/" is the public marketing landing page. Logged-in users skip past it
     into the app dashboard so the landing doesn't waste their tap. */
  if (location === "/") {
    if (isLoggedIn) return <Redirect to="/dashboard" />;
    return <Landing />;
  }

  /* Login screen — public, no AppLayout. */
  if (location === "/login") return <Login />;

  /* Public legal pages — required for payment-provider onboarding. */
  if (location === "/terms")   return <Legal doc="terms" />;
  if (location === "/privacy") return <Legal doc="privacy" />;
  if (location === "/refund")  return <Legal doc="refund" />;

  /* Public API reference — keys are issued by the vendor from /admin. */
  if (location === "/developers") return <Developers />;

  /* Everything below requires auth. */
  if (!isLoggedIn) return <Redirect to="/login" />;

  return (
    <Switch>
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/dashboard"    component={() => <Protected resource="dashboard"><Dashboard /></Protected>} />
            <Route path="/products"     component={() => <Protected resource="products"><Products /></Protected>} />
            <Route path="/products/new" component={ProtectedProductsNew} />
            <Route path="/products/bulk-sale-price" component={() => <Protected resource="products"><BulkSalePrice /></Protected>} />
            <Route path="/stock-entry" component={() => <Protected resource="stockEntry"><ProductsEntry /></Protected>} />
            <Route path="/product"      component={() => <Protected resource="products"><ProductDetail /></Protected>} />
            <Route path="/scan"         component={() => <Protected resource="scan"><Scan /></Protected>} />
            <Route path="/logs"         component={() => <Protected resource="logs"><Logs /></Protected>} />
            <Route path="/today-out"    component={() => <Protected resource="logs"><TodayOut /></Protected>} />
            <Route path="/stock-alert"  component={() => <Protected resource="stockAlert"><StockAlert /></Protected>} />
            <Route path="/analytics"    component={() => <Protected resource="analytics"><Analytics /></Protected>} />
            <Route path="/product-report" component={() => <Protected resource="productReports"><ProductReport /></Protected>} />
            <Route path="/profile"      component={Profile} />
            <Route path="/billing"      component={() => <Protected resource="billing" allowToday><Billing /></Protected>} />
            <Route path="/bill/:id"     component={() => <Protected resource="billing" allowToday allowReceipt><Bill /></Protected>} />
            <Route path="/suppliers"    component={() => <Protected resource="suppliers"><Suppliers /></Protected>} />
            <Route path="/suppliers/report" component={() => <Protected resource="suppliers"><SupplierReport /></Protected>} />
            <Route path="/suppliers/stock-check" component={() => <Protected resource="suppliers"><StockCheck /></Protected>} />
            <Route path="/customers"    component={() => <Protected resource="customers"><Customers /></Protected>} />
            <Route path="/report"       component={() => <Protected resource="reports"><Report /></Protected>} />
            <Route path="/labels"       component={() => <Protected resource="labels"><Labels /></Protected>} />
            <Route path="/categories"   component={() => <Protected resource="categories"><Categories /></Protected>} />
            <Route path="/deals"        component={() => <Protected resource="deals"><Deals /></Protected>} />
            <Route path="/staff"        component={() => <Protected resource="staff"><StaffManagement /></Protected>} />
            <Route path="/checkout"     component={() => <Protected resource="scan"><Checkout /></Protected>} />
            <Route path="/settings"     component={() => <Protected resource="settings"><SettingsPage /></Protected>} />
            <Route                      component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RealtimeProvider>
              <AuthFetchGuard />
              <SessionSync />
              <SnowOverlay />
              <Router />
            </RealtimeProvider>
          </WouterRouter>
        </CartProvider>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
