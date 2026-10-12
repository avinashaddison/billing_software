import type { CartItem, LineDiscountType } from "@/contexts/cart-context";

export function CategoryDiscountLoadError({retry,loading}:{retry:()=>void;loading:boolean}) {
  return <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs mb-3">
    Could not load category discount settings. Item discount edits are unavailable.{" "}
    <button type="button" disabled={loading} className="underline font-bold" onClick={retry}>Retry</button>
  </div>;
}

export function ItemDiscountEditor({item,ready,allowed,canEdit,onChange}:{
  item:Pick<CartItem,"productId"|"name"|"price"|"isManual"|"discountType"|"discountPercent"|"discountAmount">;
  ready:boolean;allowed:boolean;canEdit:boolean;
  onChange:(id:string,type:LineDiscountType,value:number)=>void;
}) {
  if(item.isManual)return null;
  const type=item.discountType??"percent";
  const value=type==="amount"?(item.discountAmount??0):(item.discountPercent??0);
  if(!ready || !allowed)return <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
    <span>{ready?"Item discounts turned off for this category":"Waiting for category discount settings…"}</span>
    {value>0 && <button type="button" className="underline font-bold text-amber-700" onClick={()=>onChange(item.productId,type,0)}>Remove saved discount</button>}
  </div>;
  return <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`item-discount-${item.productId}`}>
    <span className="text-[11px] font-bold uppercase text-muted-foreground">Item discount</span>
    <div className="inline-flex h-8 rounded-lg border overflow-hidden">
      {(["percent","amount"] as const).map(mode=><button key={mode} type="button" disabled={!canEdit}
        aria-label={mode==="percent"?"Percent discount":"Rupee discount"}
        className={`px-2.5 text-xs font-bold disabled:opacity-50 ${type===mode?"bg-amber-500 text-white":"bg-muted"}`}
        onClick={()=>onChange(item.productId,mode,mode==="percent"?(item.discountPercent??0):(item.discountAmount??0))}>{mode==="percent"?"%":"₹"}</button>)}
    </div>
    <input type="number" inputMode="decimal" min={0} max={type==="percent"?100:item.price} step="0.5"
      value={value===0?"":value} placeholder="0" disabled={!canEdit} aria-label={`Item discount for ${item.name}`}
      className="h-8 w-24 rounded-lg border bg-muted/30 px-2 font-bold text-xs disabled:opacity-50"
      onWheel={e=>e.currentTarget.blur()} onChange={e=>onChange(item.productId,type,Number.isFinite(e.currentTarget.valueAsNumber)?e.currentTarget.valueAsNumber:0)} />
    {value>0 && <button type="button" className="text-xs underline" onClick={()=>onChange(item.productId,type,0)}>Clear</button>}
    {!canEdit && <span className="text-[11px] text-muted-foreground">Owner permission is required to edit checkout discounts.</span>}
  </div>;
}
