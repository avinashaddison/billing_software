import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { PwaInstallPrompt } from "@/components/ui/PwaInstallPrompt";
import { SnowOverlay } from "@/components/effects/SnowOverlay";
import { CartProvider } from "@/contexts/cart-context";
import { useEffect }           from "react";
import { useRealtime }         from "@/hooks/use-realtime";
import { useAuth, usePermission } from "@/hooks/use-auth";
import { useStoreSettings }    from "@/lib/store-info";
import { type ResourceKey } from "@/lib/permissions";
import NotFound from "@/pages/not-found";

import Dashboard      from "@/pages/Dashboard";
import Products       from "@/pages/Products";
import ProductsNew    from "@/pages/ProductsNew";
import ProductDetail  from "@/pages/ProductDetail";
import Scan           from "@/pages/Scan";
import Logs           from "@/pages/Logs";
import Profile        from "@/pages/Profile";
import Bill           from "@/pages/Bill";
import Billing        from "@/pages/Billing";
import Suppliers      from "@/pages/Suppliers";
import Customers      from "@/pages/Customers";
import Report         from "@/pages/Report";
import Labels         from "@/pages/Labels";
import Categories     from "@/pages/Categories";
import Deals          from "@/pages/Deals";
import Login          from "@/pages/Login";
import StaffManagement from "@/pages/StaffManagement";
import Checkout        from "@/pages/Checkout";
import SettingsPage    from "@/pages/Settings";
import AdminPage       from "@/pages/Admin";
import Landing         from "@/pages/Landing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  // One-shot: pull settings from the server so they persist across devices
  // and survive browser cache clears.
  const hydrate = useStoreSettings((s) => s.hydrateFromServer);
  useEffect(() => { void hydrate(); }, [hydrate]);
  return <>{children}</>;
}

/** Render page only if user has required access level, else show blocked screen */
function Protected({ resource, children }: { resource: ResourceKey; children: React.ReactNode }) {
  const level = usePermission(resource);
  if (level === "none") {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-6">
        <div className="text-5xl">🔒</div>
        <div>
          <p className="text-xl font-black text-foreground">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-1">
            You don't have permission to view this page.<br />
            Ask the owner to grant you access.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
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

  /* Everything below requires auth. */
  if (!isLoggedIn) return <Redirect to="/login" />;

  return (
    <Switch>
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/dashboard"    component={() => <Protected resource="dashboard"><Dashboard /></Protected>} />
            <Route path="/products"     component={() => <Protected resource="products"><Products /></Protected>} />
            <Route path="/products/new" component={() => <Protected resource="products"><ProductsNew /></Protected>} />
            <Route path="/product"      component={() => <Protected resource="products"><ProductDetail /></Protected>} />
            <Route path="/scan"         component={() => <Protected resource="scan"><Scan /></Protected>} />
            <Route path="/logs"         component={() => <Protected resource="logs"><Logs /></Protected>} />
            <Route path="/profile"      component={Profile} />
            <Route path="/billing"      component={() => <Protected resource="billing"><Billing /></Protected>} />
            <Route path="/bill/:id"     component={() => <Protected resource="billing"><Bill /></Protected>} />
            <Route path="/suppliers"    component={() => <Protected resource="suppliers"><Suppliers /></Protected>} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RealtimeProvider>
              <SnowOverlay />
              <Router />
              <PwaInstallPrompt />
            </RealtimeProvider>
          </WouterRouter>
        </CartProvider>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
