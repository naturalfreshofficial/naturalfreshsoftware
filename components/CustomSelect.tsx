"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  subtext?: string;
  badge?: string;
  icon?: ReactNode;
  searchTerms?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | CustomSelectOption)[];
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: "sm" | "md";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select option...",
  label,
  className = "",
  disabled = false,
  searchable = false,
  size = "md",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize options
  const normalizedOptions: CustomSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Filter options across name, value/id, subtext, badge, and extra search terms (e.g. barcode)
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.subtext && opt.subtext.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q)) ||
      (opt.searchTerms && opt.searchTerms.toLowerCase().includes(q))
    );
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const heightClass = size === "sm" ? "h-[32px] text-xs px-2.5" : "h-[36px] text-xs px-3";

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full ${heightClass} bg-slate-50 hover:bg-slate-100/90 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-[6px] flex items-center justify-between gap-2 font-semibold text-slate-800 transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.2 rounded-[3px] bg-blue-100 text-blue-700 text-[10px] font-bold">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[280px] w-full bg-white border border-slate-200 rounded-[6px] shadow-2xl z-[999] overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
          {/* Search Input supporting name, barcode, product ID */}
          {searchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search name, barcode, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-[28px] pl-7 pr-2 text-xs bg-white border border-slate-200 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 font-medium">
                No matching products found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-2.5 py-2 rounded-[4px] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-bold"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        {option.icon}
                        <span className="truncate font-semibold">{option.label}</span>
                        {option.badge && (
                          <span className="px-1.5 py-0.2 rounded-[3px] bg-slate-100 text-slate-600 text-[10px] shrink-0 font-medium border border-slate-200">
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.subtext && (
                        <span className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                          {option.subtext}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
