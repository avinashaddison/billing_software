import { sql, type SQL } from "drizzle-orm";
import { categoriesTable, productsTable } from "@workspace/db";
import { tenantWhere } from "./tenant";

export interface CategoryDiscountPolicy {
  productId: string;
  category: string;
  checkoutDiscountEnabled: boolean;
  cataloguePrice: number;
}
export class CategoryDiscountError extends Error {
  status = 400;
  code = "CATEGORY_DISCOUNT_DISABLED";
}
export const productIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rows = <T>(result: unknown): T[] =>
  ((result as { rows?: T[] }).rows ?? result) as T[];

export async function categoryDiscountPolicies(
  execute: (query: SQL) => Promise<unknown>,
  tenantId: string | null | undefined,
  ids: string[],
  lock = false,
): Promise<CategoryDiscountPolicy[]> {
  if (!ids.length) return [];
  if (ids.some(id => !productIdPattern.test(id))) throw new CategoryDiscountError("Invalid product selection");
  const products = rows<{id:string;category:string;price:string;sale_price:string|null}>(await execute(sql`
    SELECT id, category, price, sale_price FROM products
    WHERE id IN (${sql.join(ids.map(id=>sql`${id}::uuid`),sql`,`)})
      AND ${tenantWhere(productsTable.tenantId,tenantId)} AND deleted_at IS NULL`));
  if (!products.length) return [];
  const names = [...new Set(products.map(p=>p.category))];
  const categories = rows<{name:string;tenant_id:string|null;checkout_discount_enabled:boolean}>(await execute(sql`
    SELECT name, tenant_id, checkout_discount_enabled FROM categories
    WHERE name IN (${sql.join(names.map(name=>sql`${name}`),sql`,`)})
      AND ${tenantWhere(categoriesTable.tenantId,tenantId)}
    ORDER BY id ${lock ? sql`FOR SHARE` : sql``}`));
  return products.map(p=>{
    const category = categories.find(c=>c.name===p.category && (c.tenant_id??null)===(tenantId??null))
      ?? categories.find(c=>c.name===p.category);
    return {productId:p.id,category:p.category,checkoutDiscountEnabled:category?.checkout_discount_enabled ?? true,
      cataloguePrice:Number(p.sale_price ?? p.price)};
  });
}

export function assertCategoryDiscounts(
  items: {productId:string;price:number;discountValue?:number}[],
  policies: CategoryDiscountPolicy[],
): void {
  const byId = new Map(policies.map(p=>[p.productId,p]));
  for (const item of items) {
    const policy = byId.get(item.productId);
    if (policy && !policy.checkoutDiscountEnabled &&
      ((item.discountValue ?? 0)>0 || item.price < policy.cataloguePrice-0.005))
      throw new CategoryDiscountError(`Item discounts are turned off for ${policy.category}. Remove the item's extra discount before billing.`);
  }
}
