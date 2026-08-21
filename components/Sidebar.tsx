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
  ShoppingCart,
  Receipt,
  BarChart3,
  UserCheck,
  Percent,
  Settings,
  Store,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "POS Billing", href: "/pos-billing", icon: CreditCard, aliasHref: "/" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Products", href: "/products", icon: Package },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Stock", href: "/stock", icon: Layers },
  { name: "Purchase", href: "/purchase", icon: ShoppingCart },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Employees", href: "/employees", icon: UserCheck },
  { name: "Discounts", href: "/discounts", icon: Percent },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 sticky top-0">
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
            <span className="text-base font-bold text-slate-900 tracking-tight truncate">Retailnext</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"></span>
          </div>
          <p className="text-[10px] tracking-wider text-slate-400 font-semibold uppercase truncate mt-0.5">
            Retail Management
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
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

      {/* Bottom Branch & Status Info */}
      <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
        {/* Branch Selector */}
        <div className="flex items-center justify-between px-2.5 h-[44px] rounded-[6px] border border-slate-200 bg-white hover:border-slate-300 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">Main Branch</p>
              <p className="text-[10px] text-slate-400 truncate">MG Road, Vijayawada</p>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>

        {/* Online Status */}
        <div className="flex items-center justify-between px-3 h-[36px] text-xs font-medium text-slate-600 rounded-[6px] bg-white border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-700 font-semibold">Online</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
