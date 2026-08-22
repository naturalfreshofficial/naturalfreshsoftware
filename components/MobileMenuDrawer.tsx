"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { AVAILABLE_STAFF_PAGES, SUPER_ADMIN_NAV_PAGES, PageDefinition } from "@/lib/pagesConfig";
import {
  X,
  Store,
  LogOut,
  Download,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Search,
} from "lucide-react";
import { Branch } from "@/lib/types";

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
}

export default function MobileMenuDrawer({
  isOpen,
  onClose,
  branches,
}: MobileMenuDrawerProps) {
  const pathname = usePathname();
  const { user, logout, selectedBranchId, setSelectedBranchId, hasPageAccess } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter accessible pages for the current user
  const accessiblePages = useMemo(() => {
    if (!user) return [];

    let pages: Array<{
      id: string;
      name: string;
      href: string;
      icon: any;
      description?: string;
      category?: string;
    }> = [];

    if (user.role === "super_admin") {
      pages = [
        {
          id: "dashboard",
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          description: "Real-time sales KPIs, revenue analytics, and quick metrics",
          category: "system",
        },
        ...AVAILABLE_STAFF_PAGES,
      ];
    } else {
      // Staff access
      pages = AVAILABLE_STAFF_PAGES.filter((p) => hasPageAccess(p.href));
    }

    if (!searchQuery.trim()) return pages;

    const q = searchQuery.toLowerCase().trim();
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [user, hasPageAccess, searchQuery]);

  // Filter branches available to staff or admin
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") return branches;
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || availableBranches[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container (App Card Style) */}
      <div className="relative bg-slate-50 w-full max-h-[90vh] rounded-t-[20px] shadow-2xl flex flex-col z-10 animate-in slide-in-from-bottom duration-300 overflow-hidden border-t border-slate-200/80">
        {/* Top Drag Pill & Header */}
        <div className="bg-white p-4 border-b border-slate-200/80 shrink-0">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[8px] bg-blue-600 p-1 flex items-center justify-center shadow-xs">
                <img src="/logo.png" alt="Natural Fresh" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {user?.name || "Natural Fresh"}
                  </h2>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      user?.role === "super_admin"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {user?.role === "super_admin" ? "Admin" : "Staff"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {user?.phone ? `+91 ${user.phone}` : user?.email || "Store Workspace"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Modules in Drawer */}
          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search accessible modules & tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] pl-8.5 pr-3 bg-slate-100/80 border border-slate-200/80 rounded-[8px] text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* Active Store Branch Card */}
          {availableBranches.length > 0 && (
            <div className="p-3 bg-white rounded-[10px] border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">Current Store Branch</span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {availableBranches.length} Store{availableBranches.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {availableBranches.map((b) => {
                  const isSelected = selectedBranchId === b.id || (!selectedBranchId && b.id === availableBranches[0].id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`px-2.5 py-2 rounded-[6px] text-left border text-xs transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      <span className="truncate">{b.name}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cards-Based Menu Grid */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">
                All Available Modules ({accessiblePages.length})
              </p>
              <span className="text-[10px] font-semibold text-slate-400">Card View</span>
            </div>

            {accessiblePages.length === 0 ? (
              <div className="p-6 bg-white rounded-[10px] border border-slate-200 text-center text-slate-400">
                <p className="text-xs font-semibold">No modules match "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {accessiblePages.map((page) => {
                  const Icon = page.icon;
                  const isActive = pathname === page.href;

                  return (
                    <Link
                      key={page.id}
                      href={page.href}
                      onClick={onClose}
                      className={`group p-3 rounded-[12px] border transition-all flex flex-col justify-between gap-2.5 relative cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20"
                          : "bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:shadow-2xs active:scale-[0.98]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white/50"></span>
                        )}
                      </div>

                      <div>
                        <p
                          className={`text-xs font-bold tracking-tight truncate ${
                            isActive ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {page.name}
                        </p>
                        <p
                          className={`text-[10px] line-clamp-1 mt-0.5 ${
                            isActive ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {page.description || "Open module"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions in Drawer */}
        <div className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex-1 h-[40px] px-4 rounded-[8px] bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </div>
    </div>
  );
}
