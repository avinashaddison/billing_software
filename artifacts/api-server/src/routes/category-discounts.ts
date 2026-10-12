import { Router } from "express";
import { db } from "@workspace/db";
import { requireRead } from "../middlewares/auth";
import { categoryDiscountPolicies, productIdPattern } from "../lib/category-discounts";

const router = Router();
router.get("/checkout/category-discounts",requireRead("scan"),async(req,res)=>{
  const ids = typeof req.query.ids==="string" ? [...new Set(req.query.ids.split(",").filter(Boolean))] : [];
  if (ids.length>200 || ids.some(id=>!productIdPattern.test(id))) {
    res.status(400).json({error:"Invalid product selection"});return;
  }
  res.setHeader("Cache-Control","no-store");
  const policies = await categoryDiscountPolicies(query=>db.execute(query),req.tenantId,ids);
  res.json(policies.map(({cataloguePrice:_,...policy})=>policy));
});
export default router;
