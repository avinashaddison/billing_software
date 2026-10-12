import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { CartItem } from "@/contexts/cart-context";

const BASE = import.meta.env.BASE_URL.replace(/\/$/,"");
export interface ManagedCategory {
  id:string;name:string;emoji:string;skuCode:string;checkoutDiscountEnabled:boolean;
  productCount:number;totalStock:number;createdAt:string;
}
export function useManagedCategories() {
  const staffId=useAuth(s=>s.staffId),generation=useAuth(s=>s.sessionGeneration);
  return useQuery<ManagedCategory[]>({
    queryKey:["categories",staffId,generation],staleTime:0,refetchInterval:15000,refetchOnWindowFocus:true,
    queryFn:async()=>{
      const r=await fetch(`${BASE}/api/categories`,{credentials:"include",cache:"no-store"});
      if(!r.ok)throw new Error("Could not load available categories. Please retry.");
      const data=await r.json();
      if(!Array.isArray(data))throw new Error("Could not load available categories. Please retry.");
      return data;
    },
  });
}
interface Policy {productId:string;category:string;checkoutDiscountEnabled:boolean;discountBlockReason?:string}
export function useCategoryDiscounts(items:CartItem[]) {
  const staffId=useAuth(s=>s.staffId), generation=useAuth(s=>s.sessionGeneration);
  const ids=[...new Set(items.filter(i=>!i.isManual).map(i=>i.productId))].sort();
  const query=useQuery<Policy[]>({
    queryKey:["checkout-category-discounts",staffId,generation,ids],
    enabled:ids.length>0,staleTime:0,refetchInterval:15000,refetchOnWindowFocus:true,
    queryFn:async()=>{
      const r=await fetch(`${BASE}/api/checkout/category-discounts?ids=${encodeURIComponent(ids.join(","))}`,{credentials:"include",cache:"no-store"});
      if(!r.ok)throw new Error("Could not check category / supplier discount settings. Retry before applying an item discount.");
      const data=await r.json();
      if(!Array.isArray(data))throw new Error("Could not check category discount settings.");
      return data;
    },
  });
  const ready=ids.length===0 || (query.data!==undefined && !query.isError);
  const byId=new Map(query.data?.map(p=>[p.productId,p]));
  const allowed=(id:string)=>ready && byId.get(id)?.checkoutDiscountEnabled===true;
  const validate=()=>{
    for(const item of items){
      if(item.isManual || !((item.discountPercent??0)>0 || (item.discountAmount??0)>0))continue;
      if(!ready)return "Could not check category / supplier discount settings. Retry before billing discounted items.";
      if(!allowed(item.productId))return `Item discounts are off for ${byId.get(item.productId)?.discountBlockReason??byId.get(item.productId)?.category??item.name}. Remove this item's extra discount before billing.`;
    }
    return null;
  };
  const blockReason=(id:string)=>byId.get(id)?.discountBlockReason;
  return {...query,ready,allowed,validate,blockReason};
}
