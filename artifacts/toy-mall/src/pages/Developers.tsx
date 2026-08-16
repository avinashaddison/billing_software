/**
 * /developers — public API reference for the Addison Bill public API (v1).
 *
 * Static page, no fetches, rendered outside the app shell (public branch of
 * the router, like /terms). Shop owners create keys under
 * Settings → API Access; this page is what they hand to their developer.
 */
import { Link } from "wouter";
import { ArrowLeft, KeyRound, Gauge, AlertCircle, Layers } from "lucide-react";

const BASE = window.location.origin;

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-muted rounded-xl p-3 text-xs font-mono overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

function Method({ verb }: { verb: "GET" | "POST" | "PATCH" }) {
  const color =
    verb === "GET"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : verb === "POST"
        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
        : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${color}`}>{verb}</span>
  );
}

function Endpoint({
  verb, path, scope, note, children,
}: {
  verb: "GET" | "POST" | "PATCH";
  path: string;
  scope?: "write";
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Method verb={verb} />
        <code className="text-sm font-mono font-bold">{path}</code>
        {scope === "write" && (
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            write key
          </span>
        )}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}

function H2({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-black flex items-center gap-2 pt-6">
      <Icon className="w-5 h-5" /> {children}
    </h2>
  );
}

export default function Developers() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Link href="/">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Back
          </span>
        </Link>

        <div>
          <h1 className="text-2xl font-black">API Reference</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Public API v1 — read and update a shop's products, stock, suppliers and bills
            from your own software.
          </p>
        </div>

        <div className="bg-card border rounded-2xl p-4 text-sm space-y-1">
          <p className="font-bold">Base URL</p>
          <Code>{`${BASE}/api/v1`}</Code>
        </div>

        {/* ── Authentication ── */}
        <H2 icon={KeyRound}>Authentication</H2>
        <p className="text-sm">
          The shop owner creates a key under <span className="font-bold">Settings → API Access</span>{" "}
          (it looks like <code className="font-mono text-xs">adb_…</code> and is shown only once).
          Send it on every request:
        </p>
        <Code>{`curl ${BASE}/api/v1/me \\
  -H "Authorization: Bearer adb_YOUR_KEY_HERE"`}</Code>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li><span className="font-bold">read</span> keys can use every GET endpoint.</li>
          <li><span className="font-bold">write</span> keys can also create and update. Endpoints marked "write key" below need one.</li>
          <li>A key only ever sees its own shop's data. Revoked keys stop working immediately.</li>
        </ul>

        {/* ── Conventions ── */}
        <H2 icon={Layers}>Conventions</H2>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>Requests and responses are JSON. Send <code className="font-mono text-xs">Content-Type: application/json</code> on POST/PATCH.</li>
          <li>
            Money fields (<code className="font-mono text-xs">price</code>, <code className="font-mono text-xs">totalAmount</code>…)
            are decimal <span className="font-bold">strings</span> like <code className="font-mono text-xs">"120.00"</code> so
            paise never suffer floating-point drift. You may send numbers; we normalise.
          </li>
          <li>
            Lists are paginated: <code className="font-mono text-xs">?page=1&amp;limit=50</code> (limit max 200) →{" "}
            <code className="font-mono text-xs">{"{ data, page, limit, total }"}</code>.
          </li>
          <li>Date filters use the shop's business day (Indian time), format <code className="font-mono text-xs">YYYY-MM-DD</code>.</li>
          <li>IDs are UUIDs.</li>
        </ul>

        {/* ── Rate limits ── */}
        <H2 icon={Gauge}>Rate limits</H2>
        <p className="text-sm">
          120 requests per minute per key. Every response carries{" "}
          <code className="font-mono text-xs">X-RateLimit-Limit</code>,{" "}
          <code className="font-mono text-xs">X-RateLimit-Remaining</code> and{" "}
          <code className="font-mono text-xs">X-RateLimit-Reset</code>; going over returns{" "}
          <code className="font-mono text-xs">429</code> with a <code className="font-mono text-xs">Retry-After</code> header.
        </p>

        {/* ── Errors ── */}
        <H2 icon={AlertCircle}>Errors</H2>
        <p className="text-sm">Errors are JSON with a plain-language message:</p>
        <Code>{`{ "error": "A product with this SKU or barcode already exists in this shop" }`}</Code>
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li><code className="font-mono text-xs">400</code> — invalid input (the message says what's wrong)</li>
          <li><code className="font-mono text-xs">401</code> — missing, invalid or revoked key</li>
          <li><code className="font-mono text-xs">403</code> — write endpoint with a read-only key, or shop not active</li>
          <li><code className="font-mono text-xs">404</code> — no such record in this shop</li>
          <li><code className="font-mono text-xs">409</code> — duplicate (e.g. SKU already exists)</li>
          <li><code className="font-mono text-xs">429</code> — rate limit exceeded</li>
        </ul>

        {/* ── Endpoints ── */}
        <h2 className="text-lg font-black pt-6">Endpoints</h2>

        <Endpoint verb="GET" path="/me" note="Who am I? Returns the key's name, scope and shop.">
          <Code>{`{ "keyName": "Website sync", "scope": "read", "shop": { "id": "…", "name": "…" } }`}</Code>
        </Endpoint>

        <Endpoint
          verb="GET"
          path="/products"
          note="List products. Optional: ?search= (name / SKU / barcode), ?category=, ?page=, ?limit=."
        >
          <Code>{`curl "${BASE}/api/v1/products?search=lego&limit=20" \\
  -H "Authorization: Bearer adb_YOUR_KEY"`}</Code>
        </Endpoint>

        <Endpoint verb="GET" path="/products/:id" note="One product, including current stock." />

        <Endpoint verb="POST" path="/products" scope="write" note="Create a product. name, sku, category and price are required; sku must be unique in the shop.">
          <Code>{`curl -X POST ${BASE}/api/v1/products \\
  -H "Authorization: Bearer adb_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Building Blocks 120 pc",
    "sku": "BB-120",
    "category": "Blocks",
    "price": 499,
    "stock": 24
  }'`}</Code>
        </Endpoint>

        <Endpoint
          verb="PATCH"
          path="/products/:id"
          scope="write"
          note="Update fields you send; others stay unchanged. Stock is NOT accepted here — use the stock endpoint below so every movement is logged."
        />

        <Endpoint
          verb="POST"
          path="/products/:id/stock"
          scope="write"
          note="Adjust stock by a signed amount (positive = add, negative = remove). Recorded in the shop's stock history as an adjustment."
        >
          <Code>{`curl -X POST ${BASE}/api/v1/products/PRODUCT_ID/stock \\
  -H "Authorization: Bearer adb_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "change": -3, "note": "Sold on marketplace" }'`}</Code>
        </Endpoint>

        <Endpoint verb="GET" path="/categories" note="Category names currently in use, as a JSON array of strings." />

        <Endpoint verb="GET" path="/suppliers" note="List suppliers (paginated)." />
        <Endpoint verb="GET" path="/suppliers/:id" note="One supplier." />
        <Endpoint verb="POST" path="/suppliers" scope="write" note="Create a supplier. Only name is required; contact, email, phone, address and notes are optional." />
        <Endpoint verb="PATCH" path="/suppliers/:id" scope="write" note="Update the fields you send. Send null to clear an optional field." />

        <Endpoint
          verb="GET"
          path="/bills"
          note="List bills, newest first. Optional: ?from=YYYY-MM-DD, ?to=YYYY-MM-DD (Indian business days), ?status=paid|partial|unpaid, pagination."
        >
          <Code>{`curl "${BASE}/api/v1/bills?from=2026-08-01&to=2026-08-15&status=paid" \\
  -H "Authorization: Bearer adb_YOUR_KEY"`}</Code>
        </Endpoint>

        <Endpoint verb="GET" path="/bills/:id" note="One bill including its line items. Bills are read-only through the API — they are created at the till." />

        <div className="border-t pt-4 mt-8 text-xs text-muted-foreground">
          Every write made with an API key is recorded in the shop's audit trail under the key's name.
        </div>
      </div>
    </div>
  );
}
