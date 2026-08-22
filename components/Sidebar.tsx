"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Truck,
  Layers,
  Receipt,
  UserCheck,
  ShieldCheck,
  Settings,
  Store,
  ChevronDown,
  Boxes,
  Percent,
  ShoppingCart,
  BarChart3,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isStaffAllowedRoute } from "@/lib/pagesConfig";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  aliasHref?: string;
  id?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, id: "dashboard" },
  { name: "POS Billing", href: "/pos-billing", icon: CreditCard, aliasHref: "/", id: "pos-billing" },
  { name: "Invoices", href: "/invoices", icon: FileText, id: "invoices" },
  { name: "Products", href: "/products", icon: Package, id: "products" },
  { name: "Stock", href: "/stock", icon: Layers, id: "stock" },
  { name: "Stock Assignment", href: "/stock-assignment", icon: Boxes, id: "stock-assignment" },
  { name: "Customers", href: "/customers", icon: Users, id: "customers" },
  { name: "Suppliers", href: "/suppliers", icon: Truck, id: "suppliers" },
  { name: "Purchase Orders", href: "/purchase", icon: ShoppingCart, id: "purchase" },
  { name: "Discounts", href: "/discounts", icon: Percent, id: "discounts" },
  { name: "Expenses", href: "/expenses", icon: Receipt, id: "expenses" },
  { name: "Branches", href: "/branches", icon: Store, id: "branches" },
  { name: "Employees", href: "/employees", icon: UserCheck, id: "employees" },
  { name: "Staff & Access", href: "/staff", icon: ShieldCheck, id: "staff" },
  { name: "Reports", href: "/reports", icon: BarChart3, id: "reports" },
  { name: "Settings", href: "/settings", icon: Settings, id: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Filter NAV items based on current role and staff permissions
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (!user) return false;
    if (user.role === "super_admin") return true;

    // Staff access filtering: Dashboard permanently forbidden
    if (item.href === "/dashboard") return false;

    // Check if staff allowed this page
    return isStaffAllowedRoute(item.href, user.allowedPages || []);
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 sticky top-0 z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-full h-full object-contain p-0.5"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-slate-900 tracking-tight truncate">Natural Fresh</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                user?.role === "super_admin"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {user?.role === "super_admin" ? "Super Admin" : "Staff User"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.aliasHref && pathname === item.aliasHref);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 h-[36px] rounded-[6px] text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Branch & Session Info */}
      <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
        {/* Branch Selector Shortcut */}
        {user?.role === "super_admin" ? (
          <Link
            href="/branches"
            title="Manage Branches"
            className="flex items-center justify-between px-2.5 h-[42px] rounded-[6px] border border-slate-200 bg-white hover:border-blue-400 hover:shadow-2xs transition-all cursor-pointer block"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">All Stores Access</p>
                <p className="text-[10px] text-slate-400 truncate">Super Admin Portal</p>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </Link>
        ) : (
          <div className="flex items-center justify-between px-2.5 h-[42px] rounded-[6px] border border-slate-200 bg-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user?.branchIds?.length || 1} Store(s) Assigned
                </p>
                <p className="text-[10px] text-slate-400 truncate">Staff Workspace</p>
              </div>
            </div>
          </div>
        )}

        {/* Online Status & Quick Logout */}
        <div className="flex items-center justify-between px-3 h-[36px] text-xs font-medium text-slate-600 rounded-[6px] bg-white border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-700 font-semibold text-[11px]">System Online</span>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            title="Sign Out"
            className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
