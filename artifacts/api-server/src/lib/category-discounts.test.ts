import { describe,it,expect,vi } from "vitest";
vi.mock("@workspace/db",async()=>await import("../../../../lib/db/src/schema"));
import { assertCategoryDiscounts,CategoryDiscountError } from "./category-discounts";

describe("category item discount policy",()=>{
  const productId="e0000000-0000-4000-8000-000000000004";
  const policy={productId,category:"STATIONERY",checkoutDiscountEnabled:false,cataloguePrice:100};
  it("allows full catalogue price in a disabled category",()=>{
    expect(()=>assertCategoryDiscounts([{productId,price:100}],[policy])).not.toThrow();
  });
  it("blocks explicit line discount even when price metadata is inconsistent",()=>{
    expect(()=>assertCategoryDiscounts([{productId,price:100,discountValue:10}],[policy])).toThrow(CategoryDiscountError);
  });
  it("blocks forged discounted price without client metadata",()=>{
    expect(()=>assertCategoryDiscounts([{productId,price:90}],[policy])).toThrow("STATIONERY");
  });
  it("does not disable catalogue promotions",()=>{
    expect(()=>assertCategoryDiscounts([{productId,price:80}],[{...policy,cataloguePrice:80}])).not.toThrow();
  });
  it("allows discounts in enabled categories",()=>{
    expect(()=>assertCategoryDiscounts([{productId,price:90,discountValue:10}],[{...policy,checkoutDiscountEnabled:true}])).not.toThrow();
  });
});
