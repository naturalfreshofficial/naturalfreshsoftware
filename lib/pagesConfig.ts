import {
  CreditCard,
  FileText,
  Package,
  Users,
  Truck,
  Store,
  Layers,
  Boxes,
  Receipt,
  UserCheck,
  ShieldCheck,
  BarChart3,
  Settings,
  Percent,
  ShoppingCart,
  LayoutDashboard,
  LucideIcon,
} from "lucide-react";

export interface PageDefinition {
  id: string; // unique key, e.g. "pos-billing"
  name: string; // Display name
  href: string; // Main path
  aliasHrefs?: string[]; // Alias paths (e.g. "/" for pos-billing)
  icon: LucideIcon;
  description: string;
  category: "sales" | "inventory" | "management" | "finance" | "system";
}

/**
 * All assignable pages for Staff members.
 * IMPORTANT: "Dashboard" is strictly excluded from this list per system requirements.
 */
export const AVAILABLE_STAFF_PAGES: PageDefinition[] = [
  {
    id: "pos-billing",
    name: "POS Billing",
    href: "/pos-billing",
    aliasHrefs: ["/"],
    icon: CreditCard,
    description: "Point of Sale billing, cash register, invoice checkout",
    category: "sales",
  },
  {
    id: "invoices",
    name: "Invoices",
    href: "/invoices",
    icon: FileText,
    description: "View, print, download, and track customer sales invoices",
    category: "sales",
  },
  {
    id: "products",
    name: "Products",
    href: "/products",
    icon: Package,
    description: "Manage product catalogue, SKUs, barcodes, and pricing",
    category: "inventory",
  },
  {
    id: "stock",
    name: "Stock Management",
    href: "/stock",
    icon: Layers,
    description: "Track inventory quantities, low stock alerts, adjustments",
    category: "inventory",
  },
  {
    id: "stock-assignment",
    name: "Stock Assignment",
    href: "/stock-assignment",
    icon: Boxes,
    description: "Transfer & assign stock quantities to specific store branches",
    category: "inventory",
  },
  {
    id: "customers",
    name: "Customers",
    href: "/customers",
    icon: Users,
    description: "Customer directory, contact details, and purchase history",
    category: "sales",
  },
  {
    id: "suppliers",
    name: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    description: "Supplier contacts, vendor directories, purchase history",
    category: "inventory",
  },
  {
    id: "purchase",
    name: "Purchase Orders",
    href: "/purchase",
    icon: ShoppingCart,
    description: "Create and track vendor purchase orders",
    category: "inventory",
  },
  {
    id: "discounts",
    name: "Discounts & Offers",
    href: "/discounts",
    icon: Percent,
    description: "Manage promotional discount codes and special pricing",
    category: "sales",
  },
  {
    id: "expenses",
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
    description: "Record daily branch operational expenses and petty cash",
    category: "finance",
  },
  {
    id: "branches",
    name: "Branches",
    href: "/branches",
    icon: Store,
    description: "Store branch outlets, locations, and branch managers",
    category: "management",
  },
  {
    id: "employees",
    name: "Employees",
    href: "/employees",
    icon: UserCheck,
    description: "Employee records, attendance, salaries, and leave tracking",
    category: "management",
  },
  {
    id: "staff",
    name: "Staff & Access",
    href: "/staff",
    icon: ShieldCheck,
    description: "Staff logins, mobile OTP access, multi-store and page permissions",
    category: "management",
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    href: "/reports",
    icon: BarChart3,
    description: "Sales summaries, tax reports, revenue analytics",
    category: "finance",
  },
  {
    id: "settings",
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Store preferences, tax rates, printer and app settings",
    category: "system",
  },
];

/**
 * Super Admin navigation list (Includes Dashboard).
 */
export const SUPER_ADMIN_NAV_PAGES = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  ...AVAILABLE_STAFF_PAGES.map((p) => ({
    id: p.id,
    name: p.name,
    href: p.href,
    aliasHrefs: p.aliasHrefs,
    icon: p.icon,
  })),
];

/**
 * Helper to check if a staff member has permission for a specific pathname.
 */
export function isStaffAllowedRoute(pathname: string, allowedPages: string[]): boolean {
  // Staff is NEVER allowed on /dashboard
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return false;
  }

  // Public/system routes
  if (pathname === "/login" || pathname.startsWith("/api/")) {
    return true;
  }

  // Root "/" is alias for POS Billing
  if (pathname === "/") {
    return (
      allowedPages.includes("/pos-billing") ||
      allowedPages.includes("pos-billing") ||
      allowedPages.includes("/")
    );
  }

  // Check matching href or page id
  return allowedPages.some((allowed) => {
    // Direct match with href e.g. "/products"
    if (allowed === pathname || pathname.startsWith(`${allowed}/`)) {
      return true;
    }
    // Match by ID e.g. "products"
    const matchedDef = AVAILABLE_STAFF_PAGES.find((p) => p.id === allowed);
    if (matchedDef) {
      if (pathname === matchedDef.href || pathname.startsWith(`${matchedDef.href}/`)) {
        return true;
      }
      if (matchedDef.aliasHrefs?.some((alias) => pathname === alias)) {
        return true;
      }
    }
    return false;
  });
}
