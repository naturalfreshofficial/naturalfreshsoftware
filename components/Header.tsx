"use client";

import { Search, Bell, PauseCircle, BookmarkPlus, Menu, ChevronDown } from "lucide-react";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 sticky top-0 z-10">
      {/* Left Search Bar with Toggle */}
      <div className="flex items-center gap-4 flex-1 max-w-2xl">
        <button
          type="button"
          className="h-[36px] w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-[6px] lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name, barcode, sku..."
            className="w-full h-[36px] pl-10 pr-20 bg-slate-50 border border-slate-200 rounded-[6px] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <kbd className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-[4px] shadow-2xs">
              Ctrl + K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Hold Invoice */}
        <button
          type="button"
          className="hidden md:flex h-[36px] items-center gap-2 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-[6px] transition-colors cursor-pointer"
        >
          <PauseCircle className="w-4 h-4 text-slate-600" />
          <span>Hold Invoice</span>
        </button>

        {/* Park Sale */}
        <button
          type="button"
          className="hidden md:flex h-[36px] items-center gap-2 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-[6px] transition-colors cursor-pointer"
        >
          <BookmarkPlus className="w-4 h-4 text-slate-600" />
          <span>Park Sale</span>
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative h-[36px] w-[36px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[6px] border border-slate-200 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
            4
          </span>
        </button>

        {/* User Profile */}
        <div className="flex h-[36px] items-center gap-2.5 px-2 rounded-[6px] hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-[6px] bg-blue-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden">
            <span>AS</span>
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-tight">Arumulla Siva</p>
            <p className="text-[10px] text-slate-400 font-medium">Admin</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
