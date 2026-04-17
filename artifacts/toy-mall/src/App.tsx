import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { CartProvider } from "@/contexts/cart-context";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

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
            <Router />
          </WouterRouter>
        </CartProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
