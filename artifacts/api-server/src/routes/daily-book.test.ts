/**
 * Real SQL and HTTP, isolated Unix-socket Postgres. No app connection string
 * is read or used: @workspace/db is mocked to this pool and schema exports.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import pg from "pg";
import express from "express";
import zlib from "node:zlib";

const fake = vi.hoisted(() => ({ pool: null as unknown as import("pg").Pool, actor: {} as Record<string, unknown> }));
vi.mock("@workspace/db", async () => ({
  ...await import("../../../../lib/db/src/schema"),
  pool: { query: (...args: unknown[]) => (fake.pool.query as Function)(...args), connect: () => fake.pool.connect() },
  db: { select: () => ({ from: () => ({ where: async () => [fake.actor] }) }) },
}));
import router from "./daily-book";
import { readOnlySessionGate } from "../middlewares/read-only-session";
import { dumpDatabaseSnapshot } from "../lib/backup";
import { restoreSnapshot, restoreTenantSnapshot } from "../lib/restore";

const root = mkdtempSync(join(tmpdir(),"daily-book-test-"));
const browserFixture = process.env.DAILY_BOOK_BROWSER_FIXTURE === "1";
const data = join(root,"data");
let started = false;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let base = "";
let finishFixture: (() => void) | undefined;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.tenantId = req.get("X-Test-Tenant") === "legacy" ? null : (req.get("X-Test-Tenant") ?? "shop-a");
  req.authKind = "pin";
  req.staffId = req.get("X-Test-Role") === "anonymous" ? undefined : "d3aa5b4a-790c-45a7-87b3-b0c9e6275051";
  req.viewAsReadOnly = req.get("X-Test-Readonly") === "yes";
  fake.actor = { role:req.get("X-Test-Role") ?? "owner",isActive:true,tenantId:req.get("X-Test-Actor-Tenant") ?? req.tenantId };
  next();
});
app.use("/api",readOnlySessionGate,router);
if (browserFixture) {
  // An ephemeral browser-only harness. No real cookies, user rows or business
  // APIs are used. Its frontend is the real production build.
  app.use("/api",(req,res) => {
    if (req.path === "/auth/me") { res.json({kind:"pin",id:"d3aa5b4a-790c-45a7-87b3-b0c9e6275051",role:"owner",name:"Fixture Owner",permissions:{}}); return; }
    if (req.path === "/auth/activity") { res.status(204).end(); return; }
    if (req.path === "/app/notices") { res.json({notices:[],viewAs:null}); return; }
    if (req.path === "/settings") { res.json({}); return; }
    if (req.path === "/events") { res.status(204).end(); return; }
    if (req.method !== "GET") { res.status(403).json({error:"Business writes are disabled in this isolated fixture"}); return; }
    res.json({});
  });
  app.use(express.static(new URL("../../../toy-mall/dist/public",import.meta.url).pathname));
  app.post("/__fixture/finish",(_req,res) => { res.json({stopping:true}); finishFixture?.(); });
  app.get(/.*/,(_req,res) => res.sendFile(new URL("../../../toy-mall/dist/public/index.html",import.meta.url).pathname));
}
app.use((_err: unknown,_req: express.Request,res: express.Response,_next: express.NextFunction) => res.status(500).json({ error:"Server error" }));

async function request(path: string, method = "GET", body?: unknown, headers: Record<string,string> = {}) {
  const response = await fetch(`${base}/api/daily-book${path}`, { method, headers:{
    "Content-Type":"application/json",...(method==="GET" ? {} : { "Idempotency-Key":randomUUID() }),...headers,
  },...(body === undefined ? {} : { body:JSON.stringify(body) }) });
  // Fixture bodies vary by endpoint; each shape is asserted in its test.
  return { status:response.status,data:await response.json() as any };
}
async function account(name = "Fixture Person", tenant = "shop-a") {
  const result = await request("/accounts","POST",{name},{"X-Test-Tenant":tenant});
  expect(result.status).toBe(201); return result.data.id as string;
}
const money = (amount:string,direction="given") => ({ amount,direction,entryDate:"2026-01-01",method:"cash",note:"Fixture only" });
beforeAll(async () => {
  execFileSync("initdb",["-D",data,"-A","trust","--no-locale","--encoding=UTF8"],{stdio:"ignore"});
  execFileSync("pg_ctl",["-D",data,"-l",join(root,"postgres.log"),"-o",`-F -h '' -k ${root} -p 55478`,"-w","start"],{stdio:"ignore"});
  started = true;
  fake.pool = new pg.Pool({host:root,port:55478,user:userInfo().username,database:"postgres"});
  const identity = await fake.pool.query("SELECT current_setting('data_directory') AS dir");
  if (identity.rows[0].dir !== data) throw new Error("Refusing to test an unverified database");
  await fake.pool.query("CREATE TABLE tenants(id text PRIMARY KEY, name text NOT NULL); INSERT INTO tenants(id,name) VALUES('shop-a','Fixture A'),('shop-b','Fixture B')");
  const migration = readFileSync(new URL("../../../../lib/db/migrations/0027_daily_book.sql",import.meta.url),"utf8");
  await fake.pool.query(migration);
  await fake.pool.query(migration); // idempotent rerun
  server = app.listen(browserFixture ? 18081 : 0,browserFixture ? "0.0.0.0" : "127.0.0.1"); await once(server,"listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture HTTP server");
  base = `http://127.0.0.1:${address.port}`;
},30000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  if (fake.pool) await fake.pool.end();
  if (started) execFileSync("pg_ctl",["-D",data,"-m","immediate","-w","stop"],{stdio:"ignore"});
  rmSync(root,{recursive:true,force:true});
});

it.runIf(browserFixture)("holds an isolated browser fixture until the tester finishes", async () => {
  console.log("ISOLATED DAILY BOOK BROWSER FIXTURE READY port=18081");
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve,600_000);
    finishFixture = () => { clearTimeout(timer); resolve(); };
  });
},630_000);
describe.skipIf(browserFixture)("Daily Book real SQL safety", () => {
  it("denies staff, anonymous sessions, mismatched tenant claims and read-only writes", async () => {
    expect((await request("/notes","GET",undefined,{"X-Test-Role":"staff"})).status).toBe(403);
    expect((await request("/accounts","GET",undefined,{"X-Test-Role":"anonymous"})).status).toBe(401);
    expect((await request("/accounts","GET",undefined,{"X-Test-Actor-Tenant":"shop-b"})).status).toBe(403);
    expect((await request("/accounts","POST",{name:"No write"},{"X-Test-Readonly":"yes"})).status).toBe(403);
  });
  it("keeps notes editable, completed/reopened and archived without stale overwrites", async () => {
    const created = await request("/notes","POST",{content:"Call supplier",entryDate:"2026-01-01",isTask:true,dueDate:"2026-01-02"});
    expect(created.status).toBe(201);
    const input = {content:created.data.content,entryDate:created.data.entryDate,isTask:true,dueDate:created.data.dueDate,completed:true,archived:false,version:1};
    expect((await request(`/notes/${created.data.id}`,"PATCH",input)).data.version).toBe(2);
    expect((await request(`/notes/${created.data.id}`,"PATCH",input)).status).toBe(409);
    expect((await request(`/notes/${created.data.id}`,"PATCH",{...input,version:2,completed:false,archived:true})).data.archived).toBe(true);
    expect((await request(`/notes/${created.data.id}`,"PATCH",{...input,version:3,completed:false,archived:false})).data.archived).toBe(false);
    expect((await request(`/notes/${created.data.id}`,"PATCH",input,{"X-Test-Tenant":"shop-b"})).status).toBe(404);
    expect((await request("/notes","GET",undefined,{"X-Test-Tenant":"legacy"})).data).toEqual([]);
  });
  it("makes give 1000 minus receive 300 equal 700 and received-first equal owing", async () => {
    const id = await account("Balance example");
    expect((await request(`/accounts/${id}/entries`,"POST",money("1000"))).status).toBe(201);
    expect((await request(`/accounts/${id}/entries`,"POST",money("300","received"))).status).toBe(201);
    const other = await account("Received first");
    await request(`/accounts/${other}/entries`,"POST",money("500","received"));
    const result = (await request("/accounts")).data;
    expect(result.accounts.find((a: {id:string}) => a.id===id).balancePaise).toBe("70000");
    expect(result.accounts.find((a: {id:string}) => a.id===other).balancePaise).toBe("-50000");
    expect(result.receivablePaise).toBe("70000"); expect(result.payablePaise).toBe("50000");
    expect((await request(`/accounts/${id}/entries`,"GET",undefined,{"X-Test-Tenant":"shop-b"})).status).toBe(404);
    expect((await request(`/accounts/${id}/entries`,"POST",money("10"),{"X-Test-Tenant":"shop-b"})).status).toBe(404);
    expect((await request(`/accounts/${id}`,"PATCH",{archived:true})).status).toBe(409);
  });
  it("serializes concurrent retries, retains idempotency and rejects altered retry payloads", async () => {
    const id = await account("Retry safety"), key = randomUUID();
    const requests = await Promise.all(Array.from({length:5},() => request(`/accounts/${id}/entries`,"POST",money("0.29"),{"Idempotency-Key":key})));
    expect(requests.every(result => result.status===201)).toBe(true);
    expect(new Set(requests.map(result => result.data.id)).size).toBe(1);
    expect((await request(`/accounts/${id}/entries`)).data).toHaveLength(1);
    expect((await request(`/accounts/${id}/entries`,"POST",money("0.30"),{"Idempotency-Key":key})).status).toBe(409);
  });
  it("voids and replaces atomically, retains original, and blocks double correction", async () => {
    const id = await account("Correction safety");
    const original = (await request(`/accounts/${id}/entries`,"POST",money("1000"))).data;
    const path = `/accounts/${id}/entries/${original.id}/correct`;
    const key = randomUUID(), body = {reason:"Typed wrong amount",replacement:money("1200")};
    const corrected = await request(path,"POST",body,{"Idempotency-Key":key});
    expect(corrected.status).toBe(200); expect(corrected.data.replacement.correctedFrom).toBe(original.id);
    expect((await request(path,"POST",body,{"Idempotency-Key":key})).data.replacement.id).toBe(corrected.data.replacement.id);
    expect((await request(path,"POST",body)).status).toBe(409);
    const history = (await request(`/accounts/${id}/entries`)).data;
    expect(history).toHaveLength(2);
    expect(history.find((e:{id:string}) => e.id===original.id).voidedAt).toBeTruthy();
    const replacementPath = `/accounts/${id}/entries/${corrected.data.replacement.id}/correct`;
    expect((await request(replacementPath,"POST",{reason:"Cancel fixture",replacement:null})).status).toBe(200);
    expect((await request(`/accounts/${id}`,"PATCH",{archived:true})).status).toBe(200);
    expect((await request(`/accounts/${id}/entries`,"POST",money("10"))).status).toBe(409);
    expect((await request(`/accounts/${id}`,"PATCH",{archived:false})).status).toBe(200);
  });
  it("rolls back rejected writes without consuming the request key", async () => {
    const key = randomUUID(), missing = randomUUID();
    expect((await request(`/accounts/${missing}/entries`,"POST",money("10"),{"Idempotency-Key":key})).status).toBe(404);
    const found = await fake.pool.query("SELECT 1 FROM daily_book_requests WHERE request_key=$1",[key]);
    expect(found.rowCount).toBe(0);
    expect((await request("/accounts","POST",{name:"x"},{"Idempotency-Key":"bad"})).status).toBe(400);
  });
  it("round-trips new tables through full and per-shop backup/restore using ONLY scratch data", async () => {
    const snapshot = await dumpDatabaseSnapshot(fake.pool);
    for (const table of ["daily_notes","daily_khata_accounts","daily_khata_entries","daily_book_requests"])
      expect(snapshot.payload.data[table]).toBeDefined();
    const gz = zlib.gzipSync(JSON.stringify(snapshot.payload));
    const options = {pool:fake.pool,takeSafetyBackup:async () => "isolated-fixture-only"};
    await restoreSnapshot(gz,options);
    const restored = await dumpDatabaseSnapshot(fake.pool);
    for (const table of Object.keys(snapshot.payload.data))
      expect(restored.payload.data[table].length).toBe(snapshot.payload.data[table].length);
    await restoreTenantSnapshot(gz,"shop-a",options);
    const after = await dumpDatabaseSnapshot(fake.pool);
    expect(after.payload.data.daily_khata_entries.length).toBe(snapshot.payload.data.daily_khata_entries.length);
  });
});
