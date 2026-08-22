"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import {
  CreditCard,
  LayoutDashboard,
  FileText,
  Layers,
  LayoutGrid,
  Package,
  Boxes,
  Receipt,
  Users,
} from "lucide-react";

interface MobileBottomNavProps {
  onOpenMenu: () => void;
}

export default function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { user, hasPageAccess } = useAuth();

  if (!user) return null;

  const isSuperAdmin = user.role === "super_admin";

  // Build the 4 quick tabs dynamically based on user role and permissions
  const tabs = [];

  // Tab 1: Dashboard (Admin) or Products/Invoices (Staff)
  if (isSuperAdmin) {
    tabs.push({
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    });
  } else if (hasPageAccess("/invoices")) {
    tabs.push({
      name: "Invoices",
      href: "/invoices",
      icon: FileText,
      isActive: pathname === "/invoices",
    });
  } else if (hasPageAccess("/products")) {
    tabs.push({
      name: "Products",
      href: "/products",
      icon: Package,
      isActive: pathname === "/products",
    });
  }

  // Center Tab: POS Billing (Featured Hero Button)
  const canAccessPOS = isSuperAdmin || hasPageAccess("/pos-billing");
  const isPosActive = pathname === "/pos-billing" || pathname === "/";

  // Tab 3: Stock Management
  if (isSuperAdmin || hasPageAccess("/stock")) {
    tabs.push({
      name: "Stock",
      href: "/stock",
      icon: Layers,
      isActive: pathname === "/stock",
    });
  } else if (hasPageAccess("/stock-assignment")) {
    tabs.push({
      name: "Assign",
      href: "/stock-assignment",
      icon: Boxes,
      isActive: pathname === "/stock-assignment",
    });
  }

  // Tab 4: Invoices (for Admin) or Expenses/Customers (for Staff)
  if (isSuperAdmin) {
    tabs.push({
      name: "Invoices",
      href: "/invoices",
      icon: FileText,
      isActive: pathname === "/invoices",
    });
  } else if (hasPageAccess("/expenses")) {
    tabs.push({
      name: "Expenses",
      href: "/expenses",
      icon: Receipt,
      isActive: pathname === "/expenses",
    });
  } else if (hasPageAccess("/customers")) {
    tabs.push({
      name: "Customers",
      href: "/customers",
      icon: Users,
      isActive: pathname === "/customers",
    });
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 py-1 flex items-center justify-around lg:hidden safe-area-pb"
    >
      {/* Left Tab(s) */}
      {tabs.slice(0, 1).map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] transition-all min-w-[58px] ${
              tab.isActive
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className={`w-5 h-5 ${tab.isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.name}</span>
          </Link>
        );
      })}

      {/* POS Billing - Center Prominent Action Button */}
      {canAccessPOS && (
        <Link
          href="/pos-billing"
          className="flex flex-col items-center justify-center -mt-4 group cursor-pointer"
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
              isPosActive
                ? "bg-blue-600 text-white ring-4 ring-blue-100 scale-105 shadow-blue-500/40"
                : "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/30 group-hover:scale-105"
            }`}
          >
            <CreditCard className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] mt-1 font-bold ${
              isPosActive ? "text-blue-600" : "text-slate-600"
            }`}
          >
            POS Billing
          </span>
        </Link>
      )}

      {/* Right Tab(s) */}
      {tabs.slice(1).map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] transition-all min-w-[58px] ${
              tab.isActive
                ? "text-blue-600 font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className={`w-5 h-5 ${tab.isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] mt-0.5 tracking-tight">{tab.name}</span>
          </Link>
        );
      })}

      {/* "More / Cards Menu" Button */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open Full Menu Cards"
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] text-slate-500 hover:text-blue-600 transition-colors min-w-[58px] cursor-pointer"
      >
        <div className="relative">
          <LayoutGrid className="w-5 h-5 stroke-[1.8]" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
        </div>
        <span className="text-[10px] mt-0.5 font-bold tracking-tight text-slate-700">
          All Menu
        </span>
      </button>
    </nav>
  );
}
