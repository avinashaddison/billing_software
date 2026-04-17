import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { CheckCircle2, ArrowLeft, ScanLine, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillItem {
  id: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface BillData {
  bill: { id: string; totalAmount: number; itemsCount: number; createdAt: string };
  items: BillItem[];
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Bill() {
  const { id: billId } = useParams<{ id: string }>();

  const [data, setData]       = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!billId) return;
    fetch(`${BASE_URL}/api/bills/${billId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Could not load bill"))
      .finally(() => setLoading(false));
  }, [billId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">Loading bill…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-500 font-bold">{error || "Bill not found"}</p>
        <Link href="/scan"><Button variant="outline">Back to Scanner</Button></Link>
      </div>
    );
  }

  const { bill, items } = data;
  const date = new Date(bill.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="p-4 md:px-6 border-b flex items-center gap-3 sticky top-0 bg-background z-10">
        <Link href="/scan" className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-black">Bill Receipt</h1>
      </div>

      <div className="p-4 md:p-6 max-w-md mx-auto w-full space-y-4 pb-24 md:pb-6">

        {/* Success Banner */}
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-black text-green-700 dark:text-green-400">Checkout Successful!</h2>
          <p className="text-sm text-muted-foreground mt-1">Stock has been updated</p>
        </div>

        {/* Bill Card */}
        <div className="bg-card border rounded-2xl overflow-hidden">
          {/* Bill header */}
          <div className="bg-primary/10 px-4 py-3 border-b flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono">Bill #{bill.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
            </div>
            <span className="text-xs bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-bold px-2.5 py-1 rounded-full">
              PAID
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.productName}</p>
                  <p className="text-xs font-mono text-muted-foreground">{item.productSku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">₹{item.subtotal.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × ₹{item.price.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="px-4 py-4 bg-muted/30 border-t flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{bill.itemsCount} item{bill.itemsCount !== 1 ? "s" : ""}</p>
              <p className="font-black text-xl">Total</p>
            </div>
            <p className="font-black text-2xl text-primary">
              ₹{bill.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 font-bold rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Link href="/scan">
            <Button className="w-full h-12 font-bold rounded-xl">
              <ScanLine className="w-4 h-4 mr-2" />
              New Sale
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
