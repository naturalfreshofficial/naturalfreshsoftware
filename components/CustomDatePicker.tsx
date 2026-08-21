"use client";

import { useState, useRef, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Clock,
} from "lucide-react";

interface CustomDatePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  onChange: (start: string, end?: string) => void;
  isRange?: boolean;
  label?: string;
  className?: string;
  preset?: string;
  onPresetChange?: (preset: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDatePicker({
  startDate,
  endDate,
  onChange,
  isRange = false,
  label,
  className = "",
  preset,
  onPresetChange,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current viewed calendar month & year
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Temp selected range state for calendar selection
  const [tempStart, setTempStart] = useState<string>(startDate || "");
  const [tempEnd, setTempEnd] = useState<string>(endDate || "");

  useEffect(() => {
    setTempStart(startDate || "");
    setTempEnd(endDate || "");
  }, [startDate, endDate]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format YYYY-MM-DD to readable string (e.g. 21 Aug 2026)
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Calendar matrix calculations
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const selectedDateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;

    if (!isRange) {
      setTempStart(selectedDateStr);
      onChange(selectedDateStr);
      setIsOpen(false);
      if (onPresetChange) onPresetChange("custom");
      return;
    }

    // Range selection logic
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(selectedDateStr);
      setTempEnd("");
    } else if (tempStart && !tempEnd) {
      if (new Date(selectedDateStr) < new Date(tempStart)) {
        setTempEnd(tempStart);
        setTempStart(selectedDateStr);
        onChange(selectedDateStr, tempStart);
      } else {
        setTempEnd(selectedDateStr);
        onChange(tempStart, selectedDateStr);
      }
      setIsOpen(false);
      if (onPresetChange) onPresetChange("custom");
    }
  };

  // Check if date is in range
  const isDateInRange = (day: number) => {
    if (!tempStart || !tempEnd) return false;
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    return dateStr > tempStart && dateStr < tempEnd;
  };

  const isDateSelected = (day: number) => {
    const formattedMonth = String(viewMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${formattedMonth}-${formattedDay}`;
    return dateStr === tempStart || dateStr === tempEnd;
  };

  // Quick Preset Helper
  const applyPreset = (p: string) => {
    const now = new Date();
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (p === "today") {
      const todayStr = toDateStr(now);
      setTempStart(todayStr);
      setTempEnd(todayStr);
      onChange(todayStr, todayStr);
    } else if (p === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const today = new Date();
      setTempStart(toDateStr(monday));
      setTempEnd(toDateStr(today));
      onChange(toDateStr(monday), toDateStr(today));
    } else if (p === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const today = new Date();
      setTempStart(toDateStr(firstDay));
      setTempEnd(toDateStr(today));
      onChange(toDateStr(firstDay), toDateStr(today));
    } else if (p === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setTempStart(toDateStr(firstDayLastMonth));
      setTempEnd(toDateStr(lastDayLastMonth));
      onChange(toDateStr(firstDayLastMonth), toDateStr(lastDayLastMonth));
    } else if (p === "this_year") {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      const today = new Date();
      setTempStart(toDateStr(firstDayYear));
      setTempEnd(toDateStr(today));
      onChange(toDateStr(firstDayYear), toDateStr(today));
    }

    if (onPresetChange) {
      onPresetChange(p);
    }
    setIsOpen(false);
  };

  // Label text for trigger button
  const triggerLabel = isRange
    ? startDate && endDate
      ? `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`
      : startDate
      ? `${formatDisplayDate(startDate)} (Select End)`
      : "Select Date Range"
    : startDate
    ? formatDisplayDate(startDate)
    : "Select Date";

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-[36px] px-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-[6px] flex items-center gap-2 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs select-none"
      >
        <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
        <span>{triggerLabel}</span>
      </button>

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-[8px] shadow-2xl z-50 p-4 w-72 sm:w-80 animate-in fade-in zoom-in-95 duration-100">
          {/* Quick Presets for Date Range */}
          {isRange && (
            <div className="mb-3 pb-3 border-b border-slate-100 grid grid-cols-3 gap-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => applyPreset("today")}
                className={`py-1 px-1.5 rounded-[4px] border text-center transition-colors cursor-pointer ${
                  preset === "today" ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this_week")}
                className={`py-1 px-1.5 rounded-[4px] border text-center transition-colors cursor-pointer ${
                  preset === "this_week" ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this_month")}
                className={`py-1 px-1.5 rounded-[4px] border text-center transition-colors cursor-pointer ${
                  preset === "this_month" ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("last_month")}
                className={`py-1 px-1.5 rounded-[4px] border text-center transition-colors cursor-pointer ${
                  preset === "last_month" ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset("this_year")}
                className={`py-1 px-1.5 rounded-[4px] border text-center transition-colors cursor-pointer ${
                  preset === "this_year" ? "bg-blue-50 border-blue-300 text-blue-700 font-bold" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempStart("");
                  setTempEnd("");
                  onChange("", "");
                  if (onPresetChange) onPresetChange("all_time");
                  setIsOpen(false);
                }}
                className="py-1 px-1.5 rounded-[4px] border border-slate-200 text-slate-500 hover:bg-slate-50 text-center transition-colors cursor-pointer"
              >
                All Time
              </button>
            </div>
          )}

          {/* Calendar Header Month & Year */}
          <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-900">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-7 w-7 rounded-[4px] flex items-center justify-center hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="h-7 w-7 rounded-[4px] flex items-center justify-center hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells matrix */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Trailing days from previous month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`prev-${i}`}
                className="h-7 flex items-center justify-center text-slate-300 select-none text-[11px]"
              >
                {prevMonthDays - firstDayIndex + i + 1}
              </div>
            ))}

            {/* Days in current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = isDateSelected(dayNum);
              const inRange = isDateInRange(dayNum);
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === viewMonth &&
                new Date().getFullYear() === viewYear;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 mx-auto rounded-[4px] flex items-center justify-center text-xs font-semibold transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : inRange
                      ? "bg-blue-100 text-blue-900"
                      : isToday
                      ? "border border-blue-500 text-blue-600 font-bold bg-blue-50/50"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setViewMonth(today.getMonth());
                setViewYear(today.getFullYear());
              }}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              Go to Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-[28px] px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-[4px] text-[11px] cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
