"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  Store,
  ShieldCheck,
  User,
  Printer,
  Usb,
  Bluetooth,
  CheckCircle2,
  RefreshCw,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePrinter } from "@/lib/PrinterContext";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export default function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout, selectedBranchId, setSelectedBranchId } = useAuth();
  const printer = usePrinter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrinterOpen, setIsPrinterOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const printerMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        printerMenuRef.current &&
        !printerMenuRef.current.contains(event.target as Node)
      ) {
        setIsPrinterOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Fetch branches
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Branch);
      });
      setBranches(list);
    });
    return () => unsub();
  }, []);

  // Filter branches available to this user
  const availableBranches: Branch[] = useMemo(() => {
    if (!user || user.role === "super_admin") return branches;
    return branches.filter((b: Branch) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  // Keep selectedBranchId valid within availableBranches
  useEffect(() => {
    if (availableBranches.length > 0) {
      if (!selectedBranchId || !availableBranches.some((b: Branch) => b.id === selectedBranchId)) {
        setSelectedBranchId(availableBranches[0].id);
      }
    }
  }, [availableBranches, selectedBranchId, setSelectedBranchId]);

  const activeBranchName =
    branches.find((b) => b.id === selectedBranchId)?.name ||
    availableBranches[0]?.name ||
    "Main Store";

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "NF";

  return (
    <header className="h-14 sm:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
      {/* Left Search Bar & Mobile Brand */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-2xl">
        {/* Mobile Hamburger / Menu Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open Mobile Menu Cards"
          className="h-[36px] w-[36px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[8px] border border-slate-200 lg:hidden cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo Brand */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-0.5" />
          </div>
          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate hidden xs:inline">
            Natural Fresh
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative w-full hidden sm:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name, barcode, sku..."
            className="w-full h-[36px] pl-10 pr-20 bg-slate-50 border border-slate-200 rounded-[6px] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:block">
            <kbd className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-[4px] shadow-2xs">
              Ctrl + K
            </kbd>
          </div>
        </div>
      </div>


      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Active Store Branch Dropdown */}
        {availableBranches.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-1.5 px-2.5 h-[36px] rounded-[6px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={selectedBranchId || availableBranches[0]?.id}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                {availableBranches.map((b: Branch) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}

              </select>
            </div>
          </div>
        )}

        {/* Thermal Printer Quick Connect & Status Button */}
        <div className="relative" ref={printerMenuRef}>
          <button
            type="button"
            onClick={() => setIsPrinterOpen(!isPrinterOpen)}
            title={printer.isConnected ? `Connected: ${printer.deviceName}` : "Connect Thermal Printer"}
            className={`h-[36px] px-2.5 flex items-center gap-1.5 rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
              printer.isConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Printer className={`w-4 h-4 ${printer.isConnected ? "text-emerald-600" : "text-slate-500"}`} />
            <span className="hidden sm:inline">
              {printer.isConnected
                ? `${printer.connectionType?.toUpperCase()}: Ready`
                : "Connect Printer"}
            </span>
            {printer.isConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          {/* Quick Printer Dropdown Popover */}
          {isPrinterOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-[8px] border border-slate-200 shadow-xl z-50 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900">Thermal Printer</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-400">
                  {printer.settings.paperWidth}mm Roll
                </span>
              </div>

              {/* Status Section */}
              {printer.isConnected ? (
                <div className="p-2.5 bg-emerald-50 rounded-[6px] border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Connected ({printer.connectionType?.toUpperCase()})
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold uppercase">
                      Active
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-900 truncate font-medium">
                    {printer.deviceName || "POS Thermal Printer"}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        printer.printTestReceipt();
                      }}
                      disabled={printer.isPrinting}
                      className="flex-1 h-[30px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {printer.isPrinting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Printer className="w-3 h-3" />
                      )}
                      <span>Test Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printer.disconnect()}
                      className="h-[30px] px-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-500 text-[11px]">
                    Connect your POS thermal receipt printer driverless via USB or Bluetooth:
                  </p>

                  <div className="space-y-1.5">
                    {/* Connect USB */}
                    <button
                      type="button"
                      onClick={async () => {
                        await printer.connectUSB();
                        setIsPrinterOpen(false);
                      }}
                      disabled={printer.isConnecting || !printer.isWebUsbSupported}
                      className="w-full h-[34px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <Usb className="w-3.5 h-3.5" />
                        <span>Connect USB Printer</span>
                      </div>
                      <span className="text-[10px] opacity-80">Cable</span>
                    </button>

                    {/* Connect Bluetooth */}
                    <button
                      type="button"
                      onClick={async () => {
                        await printer.connectBluetooth();
                        setIsPrinterOpen(false);
                      }}
                      disabled={printer.isConnecting || !printer.isWebBluetoothSupported}
                      className="w-full h-[34px] px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[6px] font-bold flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <Bluetooth className="w-3.5 h-3.5" />
                        <span>Connect Bluetooth</span>
                      </div>
                      <span className="text-[10px] opacity-80">Wireless</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Settings Link */}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href="/settings"
                  onClick={() => setIsPrinterOpen(false)}
                  className="text-blue-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                >
                  <SettingsIcon className="w-3 h-3" />
                  <span>Printer & Roll Settings</span>
                </Link>
                <span className="text-[10px] text-slate-400">ESC/POS Ready</span>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative h-[36px] w-[36px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[6px] border border-slate-200 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
        </button>

        {/* User Profile & Menu */}
        <div className="relative" ref={profileMenuRef}>

          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex h-[36px] items-center gap-2 px-2 rounded-[6px] hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-[6px] bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shadow-2xs">
              <span>{userInitials}</span>
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                {user?.role === "super_admin" ? "Super Admin" : "Staff Member"}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-[8px] border border-slate-200 shadow-xl z-50 p-2 text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                <div className="p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{user?.name}</span>
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
                  <p className="text-[11px] text-slate-400 truncate">
                    {user?.email || (user?.phone ? `+91 ${user.phone}` : "")}
                  </p>
                  <p className="text-[10px] text-blue-600 font-medium pt-0.5">
                    Store: {activeBranchName}
                  </p>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-red-600 hover:bg-red-50 rounded-[5px] font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
