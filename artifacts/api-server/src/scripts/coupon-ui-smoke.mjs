// Render the real UI with local fixtures. No browser credentials or API calls.
import esbuild from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const frontend = fileURLToPath(new URL("../../../toy-mall/", import.meta.url));
const fixtures = {
  "@/hooks/use-auth": `
    export const useAuth=()=>({role:globalThis.couponSmokeRole,
      permissions:Object.fromEntries(["dashboard","products","stockEntry","scan","billing","logs","staff"].map(x=>[x,"write"]))});
    export const useCanCreateProducts=()=>true;`,
  "@/contexts/cart-context": "export const useCart=()=>({count:0,total:0});",
  "@/lib/utils": 'export const cn=(...xs)=>xs.filter(Boolean).join(" ");',
  wouter: `
    import React from "react";
    export const useLocation=()=>["/coupons",()=>{}];
    export const Link=({href,children,...props})=>React.createElement("a",{href,...props},children);`,
  "@workspace/api-client-react": `
    export const getListCouponsQueryKey=()=>["/api/coupons"];
    export const useCreateCoupon=()=>({isPending:false});
    export const useUpdateCoupon=()=>({isPending:false});
    export const useListCoupons=opts=>{
      if(opts.query.retry!==false)throw Error("Refresh failure must be visible immediately");
      return {data:[{id:"fixture",code:"TM-FIXTURE123",discountType:"percent",discountValue:10,
        maxUses:2,usedCount:1,remainingUses:1,isActive:true,expiresAt:null,createdAt:new Date().toISOString()}],
        isLoading:false,isError:true,isFetching:false,refetch:()=>{}};
    };`,
  "@tanstack/react-query": "export const useQueryClient=()=>({invalidateQueries:()=>{}});",
  sonner: "export const toast={success:()=>{},error:()=>{}};",
};
const result = await esbuild.build({
  stdin: {
    contents: `
      import React from "react";
      import {renderToStaticMarkup} from "react-dom/server";
      import {BottomNav} from "./src/components/layout/BottomNav";
      import Coupons from "./src/pages/Coupons";
      import assert from "node:assert/strict";
      globalThis.couponSmokeRole="owner";
      let nav=renderToStaticMarkup(React.createElement(BottomNav));
      assert(nav.includes('href="/coupons"'));
      assert(nav.includes('data-testid="nav-coupons"'));
      globalThis.couponSmokeRole="staff";
      nav=renderToStaticMarkup(React.createElement(BottomNav));
      assert(!nav.includes('href="/coupons"'));
      globalThis.couponSmokeRole="owner";
      const page=renderToStaticMarkup(React.createElement(Coupons));
      assert(page.includes("Usage counts may be out of date"));
      assert(page.includes("button-retry-coupons"));
      assert(!page.includes("TM-FIXTURE123"));
      console.log("UI smoke passed: owner mobile link, staff exclusion, failed-refresh warning and retry without stale usage rows.");`,
    resolveDir: frontend,
    loader: "tsx",
  },
  jsx: "automatic",
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  plugins: [{
    name: "local-fixtures",
    setup(build) {
      build.onResolve({ filter: /.*/ }, ({ path }) =>
        Object.hasOwn(fixtures, path) ? { path, namespace: "fixture" } : null);
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) =>
        ({ contents: fixtures[path], loader: "js", resolveDir: frontend }));
    },
  }],
});
new Function("require", "module", "exports", result.outputFiles[0].text)(
  createRequire(import.meta.url), { exports: {} }, {},
);
delete globalThis.couponSmokeRole;
