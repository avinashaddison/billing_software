export interface PlatformMe { id: string; email: string; role: string; }

export interface OverviewData {
  generatedAt: string;
  day: string;
  totals: {
    shops: number; activeShops: number; suspended: number; expired: number;
    expiringSoon: number; tradingShops: number; neverSold: number;
    revenueToday: number; revenue30d: number; revenueAllTime: number;
    billsToday: number; bills30d: number; billsAllTime: number;
    outstanding: number; products: number; staff: number; users: number;
  };
  shops: Array<{
    id: string; name: string; isActive: boolean;
    expiresAt: string | null;
    createdAt: string; ownerEmail: string | null;
    daysLeft: number | null;
    access: "active" | "suspended" | "expired" | "expiring";
    activity: "trading" | "idle" | "never_sold";
    revenueToday: number; revenue30d: number; revenueAllTime: number;
    billsToday: number; bills30d: number; billsAllTime: number;
    outstanding: number;
    lastSaleAt: string | null;
    productCount: number; staffCount: number; userCount: number;
  }>;
  unassigned: { bills: number; revenue: number } | null;
}

export interface TenantDetailData {
  shop: { id: string; name: string; isActive: boolean; expiresAt: string | null; createdAt: string };
  inventory: { products: number; stockUnits: number; stockValue: number; lowStock: number };
  receivables: { outstanding: number; openBills: number };
  series: Array<{ day: string; revenue: number; bills: number }>;
  recentBills: Array<{
    billNumber: number; total: number; paid: number; paymentMode: string;
    paymentStatus: string; itemsCount: number; customerName: string | null; createdAt: string
  }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  staff: Array<{ name: string; role: string; isActive: boolean }>;
  users: Array<{ email: string; role: string; isActive: boolean; lastLoginAt: string | null }>;
}

export type AccessKey = "3d" | "7d" | "30d" | "90d" | "180d" | "365d" | "lifetime";

export const ACCESS_PRESETS: { key: AccessKey; label: string }[] = [
  { key: "3d",       label: "3 days"     },
  { key: "7d",       label: "7 days"     },
  { key: "30d",      label: "1 month"    },
  { key: "90d",      label: "3 months"   },
  { key: "180d",     label: "6 months"   },
  { key: "365d",     label: "1 year"     },
  { key: "lifetime", label: "Lifetime"   },
];
