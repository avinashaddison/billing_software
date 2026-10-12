import { beforeAll,afterAll,describe,it,expect,vi } from "vitest";
import express from "express";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect,getTableConfig } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import { execFileSync } from "node:child_process";
import { mkdtempSync,readFileSync,rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir,userInfo } from "node:os";
import { once } from "node:events";
const fake=vi.hoisted(()=>({db:null as any,pool:null as pg.Pool|null}));
vi.mock("@workspace/db",async()=>{
  const schema=await import("../../../../lib/db/src/schema");
  return {...schema,db:{
    select:(...args:any[])=>fake.db.select(...args),
    execute:(...args:any[])=>fake.db.execute(...args),
    transaction:(...args:any[])=>fake.db.transaction(...args),
    insert:(...args:any[])=>fake.db.insert(...args),
    update:(...args:any[])=>fake.db.update(...args),
    delete:(...args:any[])=>fake.db.delete(...args),
  }};
});
vi.mock("../lib/telegram",()=>({sendSaleAlert:vi.fn(),sendLowStockAlert:vi.fn()}));
vi.mock("../lib/sse",()=>({broadcast:vi.fn()}));
vi.mock("../lib/audit",()=>({recordAudit:vi.fn(),tenantActor:vi.fn(()=>({}))}));
import * as schema from "../../../../lib/db/src/schema";
import { readOnlySessionGate } from "../middlewares/read-only-session";
import { createManualBillingAccessRouter } from "./manual-billing-access";
import billsRouter from "./bills";
import sharedCartRouter from "./shared-cart";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import suppliersRouter from "./suppliers";
import categoryDiscountsRouter from "./category-discounts";
import { generateAccessKey,encryptAccessKey,digest,normalizeKey,accessKeyDigest } from "../lib/manual-billing-access";
const root=mkdtempSync(join(tmpdir(),"manual-key-test-")),data=join(root,"data");
const browserFixture=process.env.MANUAL_BILLING_BROWSER_FIXTURE==="1";
const owner="fa129b40-544e-40ee-9122-af7d03982e49",staff="f36c15ad-fb2d-4b8c-a888-a4bca1682ed5",other="44e35236-54ed-49f4-b852-324beeb4e39d";
let server:ReturnType<ReturnType<typeof express>["listen"]>,base="",started=false,finishFixture:(()=>void)|undefined;
const app=express();app.use(express.json());
if(browserFixture)app.post("/__fixture/role",(req,res)=>{
  res.setHeader("Set-Cookie",`fixture_role=${req.body.role==="staff"?"staff":"owner"}; Path=/; HttpOnly; SameSite=Strict`);
  res.json({ok:true});
});
app.use((req,_res,next)=>{
  req.tenantId=req.get("X-Test-Tenant")==="legacy"?null:req.get("X-Test-Tenant")??"shop-a";
  const role=req.get("X-Test-Role")??(browserFixture?(req.get("Cookie")?.includes("fixture_role=staff")?"staff":"owner"):"staff");
  req.authKind="pin";req.staffId=role==="owner"?owner:role==="other"?other:staff;
  req.viewAsReadOnly=req.get("X-Test-Readonly")==="yes";next();
});
app.use("/api",readOnlySessionGate,createManualBillingAccessRouter(()=>"fixture-encryption-secret-never-used-live"),billsRouter,categoriesRouter,categoryDiscountsRouter,productsRouter,suppliersRouter);
if(browserFixture){
  app.use("/api",sharedCartRouter);
  app.use("/api",(req,res)=>{
    if(req.path==="/auth/me"){res.json({kind:"pin",id:req.staffId,role:req.staffId===owner?"owner":"staff",name:req.staffId===owner?"Fixture Owner":"Fixture Staff",permissions:{scan:"write",products:"read",stockLogs:"read",suppliers:"read",checkoutDiscount:"read"}});return;}
    if(req.path==="/auth/activity"||req.path==="/events"){res.status(204).end();return;}
    if(req.path==="/app/notices"){res.json({notices:[],viewAs:null});return;}
    if(req.path==="/settings"){res.json({});return;}
    if(req.path==="/held-bills"||req.path==="/auth/sessions"||req.path==="/staff"||req.path==="/suppliers"){res.json([]);return;}
    if(req.method!=="GET"){res.status(403).json({error:"Unrelated business writes are disabled in this isolated fixture"});return;}
    res.status(503).json({error:"Related reporting route is unavailable in this isolated fixture"});
  });
  app.post("/__fixture/finish",(_req,res)=>{res.json({stopping:true});finishFixture?.();});
  app.get("/__fixture/status",async(_req,res)=>res.json((await fake.pool!.query("SELECT id,bill_number,total_amount,created_by_staff_id FROM bills ORDER BY created_at")).rows));
  app.use(express.static(new URL("../../../toy-mall/dist/public",import.meta.url).pathname));
  app.get(/.*/,(_req,res)=>res.sendFile(new URL("../../../toy-mall/dist/public/index.html",import.meta.url).pathname));
}
app.use((_e:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(500).json({error:"Fixture server error"}));
async function request(path:string,body?:unknown,headers:Record<string,string>={},method?:string){
  const r=await fetch(`${base}/api${path}`,{method:method??(body===undefined?"GET":"POST"),headers:{"Content-Type":"application/json",...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:r.status,data:await r.json() as any};
}
async function fixtureKey(tenant:string|null="shop-a"){
  const key=generateAccessKey(),encrypted=encryptAccessKey(key,tenant,"fixture-encryption-secret-never-used-live");
  await fake.pool!.query(`INSERT INTO manual_billing_keys(tenant_id,key_hash,encrypted_key) VALUES($1,$2,$3)
    ON CONFLICT((COALESCE(tenant_id,'__legacy_null__'))) DO UPDATE SET key_hash=EXCLUDED.key_hash,encrypted_key=EXCLUDED.encrypted_key,revision=gen_random_uuid()`,
    [tenant,accessKeyDigest(key,tenant,"fixture-encryption-secret-never-used-live"),encrypted]);
  return key;
}
const bill={items:[{name:"Fixture manual",quantity:1,price:100,purchasePrice:60}],paymentMode:"cash",customerPhone:"9999999999"};
beforeAll(async()=>{
  execFileSync("initdb",["-D",data,"-A","trust","--no-locale","--encoding=UTF8"],{stdio:"ignore"});
  execFileSync("pg_ctl",["-D",data,"-l",join(root,"pg.log"),"-o",`-F -h '' -k ${root} -p 55479`,"-w","start"],{stdio:"ignore"});started=true;
  fake.pool=new pg.Pool({host:root,port:55479,user:userInfo().username,database:"postgres"});
  const verify=await fake.pool.query("SELECT current_setting('data_directory') AS dir");
  if(verify.rows[0].dir!==data)throw new Error("Refusing unverified DB");
  await fake.pool.query("CREATE TABLE tenants(id text PRIMARY KEY,name text NOT NULL); INSERT INTO tenants VALUES('shop-a','Fixture A'),('shop-b','Fixture B')");
  // Reproduce actual column shapes/defaults without ever importing the live
  // database module or running schema-push against a connection string.
  const dialect=new PgDialect();
  for(const table of [schema.staffProfilesTable,schema.staffPermissionsTable,schema.authUsersTable,schema.productsTable,
    schema.billsTable,schema.saleItemsTable,schema.stockLogsTable,schema.billPaymentsTable,schema.returnsTable,schema.activeCartsTable,schema.heldBillsTable,schema.categoriesTable,schema.suppliersTable,schema.supplierPaymentsTable]){
    const config=getTableConfig(table);
    const columns=config.columns.map(c=>{
      let def="";
      if(c.default instanceof SQL)def=` DEFAULT ${dialect.sqlToQuery(c.default).sql}`;
      else if(c.default!==undefined)def=` DEFAULT '${(typeof c.default==="object"?JSON.stringify(c.default):String(c.default)).replace(/'/g,"''")}'`;
      return `"${c.name}" ${c.getSQLType()}${c.primary?" PRIMARY KEY":""}${c.notNull?" NOT NULL":""}${def}`;
    });
    await fake.pool.query(`CREATE TABLE "${config.name}" (${columns.join(",")})`);
  }
  fake.db=drizzle(fake.pool,{schema});
  await fake.db.insert(schema.staffProfilesTable).values([
    {id:owner,tenantId:"shop-a",name:"Fixture Owner",role:"owner",pin:"not-a-real-pin",isActive:true},
    {id:staff,tenantId:"shop-a",name:"Fixture Staff",role:"staff",pin:"not-a-real-pin",isActive:true},
    {id:other,tenantId:"shop-b",name:"Fixture Other",role:"staff",pin:"not-a-real-pin",isActive:true},
  ]);
  await fake.db.insert(schema.staffPermissionsTable).values([{staffId:staff,resource:"scan",level:"write"},{staffId:staff,resource:"products",level:"read"},{staffId:other,resource:"scan",level:"write"}]);
  await fake.db.insert(schema.suppliersTable).values([
    {id:"e1000000-0000-4000-8000-000000000001",tenantId:"shop-a",name:"Fixture Supplier"},
    {id:"e1000000-0000-4000-8000-000000000002",tenantId:"shop-b",name:"Other Shop Supplier",checkoutDiscountEnabled:false},
  ]);
  await fake.db.insert(schema.productsTable).values([
    {id:"2fba3c5a-f017-4649-afb3-06b37c923de9",tenantId:"shop-a",name:"Fixture Catalogue Toy",category:browserFixture?"STATIONERY":"MIX",sku:"FIXTURE-CAT",price:"100",stock:10,supplierId:"e1000000-0000-4000-8000-000000000001"},
    {id:"2fba3c5a-f017-4649-afb3-06b37c923de8",tenantId:"shop-a",name:"Fixture Second Toy",category:"SOFT TOYS",sku:"FIXTURE-CAT-2",price:"100",stock:10,supplierId:"e1000000-0000-4000-8000-000000000001"},
  ]);
  const migration=readFileSync(new URL("../../../../lib/db/migrations/0028_manual_billing_access.sql",import.meta.url),"utf8");
  await fake.pool.query(migration);await fake.pool.query(migration);
  const categoryMigration=readFileSync(new URL("../../../../lib/db/migrations/0029_category_checkout_discounts.sql",import.meta.url),"utf8");
  await fake.pool.query(categoryMigration);await fake.pool.query(categoryMigration);
  const supplierMigration=readFileSync(new URL("../../../../lib/db/migrations/0030_supplier_checkout_discounts.sql",import.meta.url),"utf8");
  await fake.pool.query(supplierMigration);await fake.pool.query(supplierMigration);
  await fake.db.insert(schema.categoriesTable).values([
    {id:"e0000000-0000-4000-8000-000000000001",tenantId:"shop-a",name:"STATIONERY",skuCode:"S"},
    {id:"e0000000-0000-4000-8000-000000000002",tenantId:"shop-a",name:"SOFT TOYS",skuCode:"ST"},
    {id:"e0000000-0000-4000-8000-000000000003",tenantId:"shop-b",name:"STATIONERY",skuCode:"S",checkoutDiscountEnabled:false},
  ]);
  server=app.listen(browserFixture?18082:0,browserFixture?"0.0.0.0":"127.0.0.1");await once(server,"listening");
  const address=server.address();if(!address||typeof address==="string")throw new Error("No fixture server");base=`http://127.0.0.1:${address.port}`;
},30000);
afterAll(async()=>{
  if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
  if(fake.pool)await fake.pool.end();
  if(started)execFileSync("pg_ctl",["-D",data,"-m","immediate","-w","stop"],{stdio:"ignore"});
  rmSync(root,{recursive:true,force:true});
});
it.runIf(browserFixture)("holds isolated manual billing browser fixture until tester finishes",async()=>{
  console.log("ISOLATED MANUAL BILLING FIXTURE READY port=18082");
  await new Promise<void>(resolve=>{
    const timer=setTimeout(resolve,900_000);
    finishFixture=()=>{clearTimeout(timer);resolve();};
  });
},930_000);
describe.skipIf(browserFixture)("manual billing real SQL safety",()=>{
  it("owner generates and reloads current key; regeneration replaces exactly one key",async()=>{
    const first=await request("/manual-billing/access-key",{},{"X-Test-Role":"owner"});
    expect(first.status).toBe(200);expect(first.data.currentKey).toMatch(/^[0-9]{4}$/);
    expect((await request("/manual-billing/access-key",undefined,{"X-Test-Role":"owner"})).data.currentKey).toBe(first.data.currentKey);
    const second=await request("/manual-billing/access-key",{},{"X-Test-Role":"owner"});
    expect(second.data.currentKey).not.toBe(first.data.currentKey);
    expect((await request("/manual-billing/authorize",{key:first.data.currentKey})).status).toBe(403);
    expect((await fake.pool!.query("SELECT count(*) FROM manual_billing_keys WHERE tenant_id='shop-a'")).rows[0].count).toBe("1");
    const stored=await fake.pool!.query("SELECT encrypted_key,key_hash FROM manual_billing_keys WHERE tenant_id='shop-a'");
    expect(JSON.stringify(stored.rows)).not.toContain(second.data.currentKey);
  });
  it("refuses staff key viewing/generation, mismatched tenants and read-only writes",async()=>{
    expect((await request("/manual-billing/access-key")).status).toBe(403);
    expect((await request("/manual-billing/access-key",{})).status).toBe(403);
    expect((await request("/manual-billing/access-key",undefined,{"X-Test-Role":"owner","X-Test-Readonly":"yes"})).status).toBe(403);
    expect((await request("/manual-billing/access-key",{},{"X-Test-Role":"owner","X-Test-Tenant":"shop-b"})).status).toBe(403);
    expect((await request("/manual-billing/access-key",{},{"X-Test-Role":"owner","X-Test-Readonly":"yes"})).status).toBe(403);
  });
  it("blocks manual bills without key, before any financial write",async()=>{
    const r=await request("/bills/checkout",bill);expect(r.status).toBe(403);expect(r.data.code).toBe("MANUAL_ACCESS_REQUIRED");
    expect((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count).toBe("0");
    expect((await fake.pool!.query("SELECT count(*) FROM bill_payments")).rows[0].count).toBe("0");
  });
  it("authorizes one bill and replays concurrent retries without double collections",async()=>{
    const key=await fixtureKey();const approval=await request("/manual-billing/authorize",{key});expect(approval.status).toBe(200);
    const payload={...bill,manualAccessToken:approval.data.approvalToken};
    const responses=await Promise.all(Array.from({length:4},()=>request("/bills/checkout",payload)));
    expect(responses.map(r=>r.status)).toEqual([201,201,201,201]);
    expect(new Set(responses.map(r=>r.data.bill.id)).size).toBe(1);
    expect((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count).toBe("1");
    expect((await fake.pool!.query("SELECT count(*) FROM bill_payments")).rows[0].count).toBe("1");
    expect((await request("/bills/checkout",{...payload,paymentMode:"upi"})).status).toBe(409);
    await fake.pool!.query("UPDATE manual_billing_approvals SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(approval.data.approvalToken)]);
    await fixtureKey();
    const recovered=await request("/bills/checkout",payload);
    expect(recovered.status).toBe(201);expect(recovered.data.bill.id).toBe(responses[0].data.bill.id);
    expect((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count).toBe("1");
  });
  it("revokes old key and unused approvals, isolates staff and shops",async()=>{
    const oldKey=await fixtureKey();const approval=await request("/manual-billing/authorize",{key:oldKey});
    const freshKey=await fixtureKey();
    expect((await request("/manual-billing/authorize",{key:oldKey})).status).toBe(403);
    expect((await request("/bills/checkout",{...bill,manualAccessToken:approval.data.approvalToken})).status).toBe(403);
    const fresh=await request("/manual-billing/authorize",{key:freshKey});expect(fresh.status).toBe(200);
    expect((await request("/bills/checkout",{...bill,manualAccessToken:fresh.data.approvalToken},{"X-Test-Role":"other","X-Test-Tenant":"shop-b"})).status).toBe(403);
    const b=await fixtureKey("shop-b");
    expect((await request("/manual-billing/authorize",{key:b})).status).toBe(403);
  });
  it("retains approval on invalid bill and refuses expired approvals",async()=>{
    const key=await fixtureKey();const a=await request("/manual-billing/authorize",{key});
    const payload={...bill,manualAccessToken:a.data.approvalToken};
    expect((await request("/bills/checkout",{...payload,items:[{...bill.items[0],purchasePrice:null}]})).status).toBe(400);
    expect((await request("/bills/checkout",payload)).status).toBe(201);
    const b=await request("/manual-billing/authorize",{key});
    await fake.pool!.query("UPDATE manual_billing_approvals SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(b.data.approvalToken)]);
    expect((await request("/bills/checkout",{...bill,manualAccessToken:b.data.approvalToken})).status).toBe(403);
  });
  it("rate limits guessing and owners still bill without a key",async()=>{
    await fake.pool!.query("DELETE FROM manual_billing_key_attempts");
    for(let i=0;i<5;i++)expect((await request("/manual-billing/authorize",{key:"invalid"})).status).toBe(403);
    expect((await request("/manual-billing/authorize",{key:"invalid"})).status).toBe(429);
    expect((await request("/bills/checkout",bill,{"X-Test-Role":"owner"})).status).toBe(201);
  });
  it("managed category editing and category discount policy preserve money and tenant scope",async()=>{
    const ownerHeaders={"X-Test-Role":"owner"};
    const id="2fba3c5a-f017-4649-afb3-06b37c923de9",categoryId="e0000000-0000-4000-8000-000000000001";
    expect((await request(`/products/${id}`,{category:"NOT AVAILABLE"},ownerHeaders,"PATCH")).status).toBe(400);
    expect((await request(`/products/${id}`,{category:"STATIONERY"},ownerHeaders,"PATCH")).status).toBe(200);
    expect((await request(`/categories/${categoryId}`,{checkoutDiscountEnabled:false},{},"PUT")).status).toBe(403);
    expect((await request(`/categories/${categoryId}`,{checkoutDiscountEnabled:"no"},ownerHeaders,"PUT")).status).toBe(400);
    expect((await request(`/categories/${categoryId}`,{checkoutDiscountEnabled:false},ownerHeaders,"PUT")).status).toBe(200);
    expect((await request(`/checkout/category-discounts?ids=${id}`)).data[0].checkoutDiscountEnabled).toBe(false);
    expect((await request(`/categories/${categoryId}`,{checkoutDiscountEnabled:true},{"X-Test-Tenant":"shop-b","X-Test-Role":"other"},"PUT")).status).toBe(403);
    const original=Number((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count);
    const catalogueBill={...bill,items:[{productId:id,quantity:1,price:90,discountType:"percent",discountValue:10}]};
    const denied=await request("/bills/checkout",catalogueBill,ownerHeaders);
    expect(denied.status).toBe(400);expect(denied.data.code).toBe("CATEGORY_DISCOUNT_DISABLED");
    expect(Number((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count)).toBe(original);
    expect((await fake.pool!.query("SELECT stock FROM products WHERE id=$1",[id])).rows[0].stock).toBe(10);
    expect((await request("/bills/checkout",{...catalogueBill,items:[{productId:id,quantity:1,price:90}]},ownerHeaders)).status).toBe(400);
    expect((await request("/bills/checkout",{...catalogueBill,items:[{productId:id,quantity:1,price:100}]},ownerHeaders)).status).toBe(201);
    await request(`/categories/${categoryId}`,{checkoutDiscountEnabled:true},ownerHeaders,"PUT");
    expect((await request("/bills/checkout",catalogueBill,ownerHeaders)).status).toBe(201);
    expect((await fake.pool!.query("SELECT checkout_discount_enabled FROM categories WHERE tenant_id='shop-b'")).rows[0].checkout_discount_enabled).toBe(false);
  });
  it("supplier locks apply to every linked product without changing category rules, prices, stock or payments",async()=>{
    const headers={"X-Test-Role":"owner"},supplier="e1000000-0000-4000-8000-000000000001";
    const ids=["2fba3c5a-f017-4649-afb3-06b37c923de9","2fba3c5a-f017-4649-afb3-06b37c923de8"];
    expect((await request(`/suppliers/${supplier}`,{checkoutDiscountEnabled:false},{},"PATCH")).status).toBe(403);
    expect((await request(`/suppliers/${supplier}`,{checkoutDiscountEnabled:"false"},headers,"PATCH")).status).toBe(400);
    const before=(await fake.pool!.query("SELECT id,stock,price FROM products ORDER BY id")).rows;
    const billsBefore=Number((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count);
    expect((await request(`/suppliers/${supplier}`,{checkoutDiscountEnabled:false},headers,"PATCH")).status).toBe(200);
    const policies=(await request(`/checkout/category-discounts?ids=${ids.join(",")}`)).data;
    expect(policies).toHaveLength(2);expect(policies.every((p:any)=>p.checkoutDiscountEnabled===false && p.discountBlockReason==="supplier Fixture Supplier")).toBe(true);
    for(const id of ids){
      const rejected=await request("/bills/checkout",{...bill,items:[{productId:id,quantity:1,price:90}]},headers);
      expect(rejected.status).toBe(400);expect(rejected.data.error).toContain("supplier Fixture Supplier");
    }
    expect((await fake.pool!.query("SELECT id,stock,price FROM products ORDER BY id")).rows).toEqual(before);
    expect(Number((await fake.pool!.query("SELECT count(*) FROM bills")).rows[0].count)).toBe(billsBefore);
    const otherSupplier="e1000000-0000-4000-8000-000000000002";
    expect((await request(`/suppliers/${otherSupplier}`,{checkoutDiscountEnabled:true},headers,"PATCH")).status).toBe(404);
    await request("/categories/e0000000-0000-4000-8000-000000000001",{checkoutDiscountEnabled:false},headers,"PUT");
    await request(`/suppliers/${supplier}`,{checkoutDiscountEnabled:true},headers,"PATCH");
    const combined=(await request(`/checkout/category-discounts?ids=${ids.join(",")}`)).data;
    expect(combined.find((p:any)=>p.productId===ids[0]).checkoutDiscountEnabled).toBe(false);
    expect(combined.find((p:any)=>p.productId===ids[1]).checkoutDiscountEnabled).toBe(true);
    await request("/categories/e0000000-0000-4000-8000-000000000001",{checkoutDiscountEnabled:true},headers,"PUT");
  });
  it("legacy keys require owner replacement and shop-wide guesses cannot bypass the four-digit lockout",async()=>{
    await fake.pool!.query("DELETE FROM manual_billing_key_attempts");
    const legacy="MB-1234-ABCD-5678-EF90";
    await fake.pool!.query("UPDATE manual_billing_keys SET key_hash=$1,encrypted_key=$2 WHERE tenant_id='shop-a'",
      [digest(legacy),encryptAccessKey(legacy,"shop-a","fixture-encryption-secret-never-used-live")]);
    expect((await request("/manual-billing/access-key",undefined,{"X-Test-Role":"owner"})).data.currentKey).toBeNull();
    expect((await request("/manual-billing/authorize",{key:legacy})).status).toBe(403);
    const replacement=await request("/manual-billing/access-key",{},{"X-Test-Role":"owner"});
    expect(replacement.data.currentKey).toMatch(/^[0-9]{4}$/);
    expect((await request("/manual-billing/authorize",{key:replacement.data.currentKey})).status).toBe(200);
    await fake.pool!.query("UPDATE manual_billing_key_attempts SET failures=20 WHERE tenant_id='shop-a' AND actor_id='shop-wide'");
    expect((await request("/manual-billing/authorize",{key:replacement.data.currentKey})).status).toBe(429);
    const changed=await request("/manual-billing/access-key",{},{"X-Test-Role":"owner"});
    expect(changed.data.currentKey).not.toBe(replacement.data.currentKey);
    expect((await request("/manual-billing/authorize",{key:changed.data.currentKey})).status).toBe(200);
  });
});
