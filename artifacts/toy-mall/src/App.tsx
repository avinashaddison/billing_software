import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { CartProvider } from "@/contexts/cart-context";
import { useRealtime } from "@/hooks/use-realtime";
import NotFound from "@/pages/not-found";

import Dashboard     from "@/pages/Dashboard";
import Products      from "@/pages/Products";
import ProductsNew   from "@/pages/ProductsNew";
import ProductDetail from "@/pages/ProductDetail";
import Scan          from "@/pages/Scan";
import Logs          from "@/pages/Logs";
import Profile       from "@/pages/Profile";
import Bill          from "@/pages/Bill";
import Billing       from "@/pages/Billing";
import Suppliers     from "@/pages/Suppliers";
import Customers     from "@/pages/Customers";
import Report        from "@/pages/Report";
import Labels        from "@/pages/Labels";
import Categories    from "@/pages/Categories";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 1000 * 30,    // 30 s — SSE invalidates instantly anyway
    },
  },
});

/** Mounts the SSE real-time hook inside the QueryClient context */
function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useRealtime();
  return <>{children}</>;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"             component={Dashboard} />
        <Route path="/products"     component={Products} />
        <Route path="/products/new" component={ProductsNew} />
        <Route path="/product"      component={ProductDetail} />
        <Route path="/scan"         component={Scan} />
        <Route path="/logs"         component={Logs} />
        <Route path="/profile"      component={Profile} />
        <Route path="/billing"      component={Billing} />
        <Route path="/bill/:id"     component={Bill} />
        <Route path="/suppliers"    component={Suppliers} />
        <Route path="/customers"    component={Customers} />
        <Route path="/report"       component={Report} />
        <Route path="/labels"       component={Labels} />
        <Route path="/categories"   component={Categories} />
        <Route                      component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <RealtimeProvider>
              <Router />
            </RealtimeProvider>
          </WouterRouter>
        </CartProvider>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
