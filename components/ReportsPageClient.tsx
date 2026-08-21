"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invoice } from "@/lib/types";
import {
  BarChart3,
  Search,
  IndianRupee,
  Receipt,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Download,
  Printer,
  Eye,
  X,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  TrendingUp,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";
import CustomDatePicker from "@/components/CustomDatePicker";

type DateRangePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "all_time"
  | "custom";

export default function ReportsPageClient() {
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");

  // Date Range Filters (Default to 'today')
  const [datePreset, setDatePreset] = useState<DateRangePreset>("today");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  // Invoice Inspection Modal
  const [inspectInvoice, setInspectInvoice] = useState<Invoice | null>(null);

  // Subscribe to Completed Invoices in Firestore (Drafts are excluded from sales reports)
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "invoices"),
      where("status", "==", "completed")
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
        });

        // Sort descending by date
        items.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return dateB - dateA;
        });

        setInvoices(items);
        setLoading(false);
      },
      (err) => {
        console.warn("Invoices sync fallback:", err);
        const fallbackUnsub = onSnapshot(collection(db, "invoices"), (snapshot) => {
          const items: Invoice[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status === "completed") {
              items.push({ id: docSnap.id, ...data } as Invoice);
            }
          });
          setInvoices(items);
          setLoading(false);
        });
        return () => fallbackUnsub();
      }
    );

    return () => unsub();
  }, []);

  // Compute Date Boundaries based on selected preset
  const dateRangeLimits = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (datePreset === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (datePreset === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
    } else if (datePreset === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (datePreset === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (datePreset === "this_year") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } else if (datePreset === "custom") {
      if (customStartDate) {
        start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    } else if (datePreset === "all_time") {
      start = null;
      end = null;
    }

    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // Filtered Invoices according to Date Filter, Search, and Payment Method
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Date filter
      if (inv.createdAt) {
        const invDate = inv.createdAt.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
        if (dateRangeLimits.start && invDate < dateRangeLimits.start) return false;
        if (dateRangeLimits.end && invDate > dateRangeLimits.end) return false;
      }

      // 2. Payment Method filter
      if (paymentFilter !== "all" && inv.paymentMethod !== paymentFilter) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvNo = inv.invoiceNumber?.toLowerCase().includes(q);
        const matchesCustName = inv.customer?.name?.toLowerCase().includes(q);
        const matchesCustPhone = inv.customer?.phone?.includes(q);
        const matchesPayment = inv.paymentMethod?.toLowerCase().includes(q);

        if (!matchesInvNo && !matchesCustName && !matchesCustPhone && !matchesPayment) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, dateRangeLimits, paymentFilter, searchQuery]);

  // Summary Metrics calculations
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.totalPayable) || 0), 0);
  }, [filteredInvoices]);

  const totalBillsCount = filteredInvoices.length;

  const totalItemsSold = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.itemCount) || 0), 0);
  }, [filteredInvoices]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    let upi = 0;
    let cash = 0;
    let card = 0;
    filteredInvoices.forEach((inv) => {
      const amount = Number(inv.totalPayable) || 0;
      if (inv.paymentMethod === "UPI") upi += amount;
      else if (inv.paymentMethod === "Cash") cash += amount;
      else if (inv.paymentMethod === "Card") card += amount;
    });
    return { upi, cash, card };
  }, [filteredInvoices]);

  // Export to Excel
  const handleExportSalesExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.warning("No invoices to export for selected filter");
      return;
    }

    const data = filteredInvoices.map((inv, idx) => {
      const dateStr = inv.createdAt?.toDate
        ? inv.createdAt.toDate().toLocaleString()
        : "—";
      return {
        "SL No": idx + 1,
        "Invoice Number": inv.invoiceNumber,
        "Date & Time": dateStr,
        "Customer Name": inv.customer?.name || "Walk-in Customer",
        "Customer Mobile": inv.customer?.phone || "—",
        "Items Count": inv.itemCount || inv.items?.length || 0,
        "Subtotal (INR)": inv.subtotal || 0,
        "Discount (INR)": inv.discountAmount || 0,
        "GST Tax (INR)": inv.taxAmount || 0,
        "Total Paid (INR)": inv.totalPayable || 0,
        "Payment Mode": inv.paymentMethod || "UPI",
        "Status": inv.status || "completed",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    XLSX.writeFile(workbook, `sales_report_${datePreset}_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredInvoices.length} sales records to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Header & Date Range Action Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales & Revenue Reports</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              {totalBillsCount} Completed Bills
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit date-wise sales, payment methods, GST tax breakdown, and itemized customer invoices.
          </p>
        </div>

        {/* Date Filter Bar & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Custom Date Picker Component with Range and Calendar */}
          <CustomDatePicker
            isRange={true}
            startDate={customStartDate}
            endDate={customEndDate}
            preset={datePreset}
            onPresetChange={(p) => setDatePreset(p as any)}
            onChange={(start, end) => {
              setCustomStartDate(start);
              if (end) setCustomEndDate(end);
              setDatePreset("custom");
            }}
          />

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportSalesExcel}
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[6px] text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Sales Revenue */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Sales Revenue</p>
            <p className="text-2xl font-extrabold text-slate-900">₹ {totalRevenue.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Excludes draft bills</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        {/* Total Completed Bills */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Completed Bills</p>
            <p className="text-2xl font-extrabold text-slate-900">{totalBillsCount}</p>
            <p className="text-[10px] text-slate-400 font-medium">In selected date range</p>
          </div>
          <div className="w-11 h-11 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Total Items Sold */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Units Sold</p>
            <p className="text-2xl font-extrabold text-slate-900">{totalItemsSold}</p>
            <p className="text-[10px] text-slate-400 font-medium">Products dispatched</p>
          </div>
          <div className="w-11 h-11 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Payment Breakdown Card */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 mb-2">Payment Modes Split</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-blue-700">
                <QrCode className="w-3 h-3 text-blue-600" /> UPI:
              </span>
              <span className="font-bold text-slate-900">₹ {paymentBreakdown.upi.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <Banknote className="w-3 h-3 text-emerald-600" /> Cash:
              </span>
              <span className="font-bold text-slate-900">₹ {paymentBreakdown.cash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1 font-semibold text-indigo-700">
                <CreditCard className="w-3 h-3 text-indigo-600" /> Card:
              </span>
              <span className="font-bold text-slate-900">₹ {paymentBreakdown.card.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bills List Table */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Search & Payment Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice number, customer name, mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-semibold text-slate-500">Payment:</span>
            <CustomSelect
              value={paymentFilter}
              onChange={(val) => setPaymentFilter(val)}
              options={[
                { value: "all", label: "All Modes" },
                { value: "UPI", label: "UPI Only", icon: <QrCode className="w-3.5 h-3.5 text-blue-600" /> },
                { value: "Cash", label: "Cash Only", icon: <Banknote className="w-3.5 h-3.5 text-emerald-600" /> },
                { value: "Card", label: "Card Only", icon: <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> },
              ]}
              className="w-36"
            />
          </div>
        </div>

        {/* Sales Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading sales reports from Firestore...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Receipt className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No sales bills found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "No invoices matched your search query. Try adjusting filters."
                  : "Complete bills in POS Billing to view real-time sales reports and receipts here."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-center">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Tax (5%)</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const dateStr = inv.createdAt?.toDate
                    ? inv.createdAt.toDate().toLocaleString()
                    : "—";

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Invoice Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-xs">
                        {inv.invoiceNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{inv.customer?.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{inv.customer?.phone}</p>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                          {inv.itemCount || inv.items?.length || 0} Units
                        </span>
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                            inv.paymentMethod === "UPI"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : inv.paymentMethod === "Cash"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          }`}
                        >
                          {inv.paymentMethod === "UPI" && <QrCode className="w-3 h-3" />}
                          {inv.paymentMethod === "Cash" && <Banknote className="w-3 h-3" />}
                          {inv.paymentMethod === "Card" && <CreditCard className="w-3 h-3" />}
                          <span>{inv.paymentMethod}</span>
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600 text-xs">
                        ₹ {Number(inv.subtotal).toFixed(2)}
                      </td>

                      {/* Tax */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-600 text-xs">
                        ₹ {Number(inv.taxAmount).toFixed(2)}
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-xs">
                        ₹ {Number(inv.totalPayable).toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectInvoice(inv)}
                          title="View and Print Invoice"
                          className="h-[30px] px-2.5 inline-flex items-center gap-1 rounded-[5px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INVOICE INSPECT & PRINT MODAL */}
      {/* ========================================================================= */}
      {inspectInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tax Invoice Receipt</h3>
                  <p className="text-[10px] font-mono text-slate-500">{inspectInvoice.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectInvoice(null)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Area */}
            <div className="p-6 space-y-4 text-xs bg-white text-slate-800">
              {/* Store Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="w-12 h-12 mx-auto mb-1 rounded-[6px] overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">RETAILNEXT SUPERMARKET</h4>
                <p className="text-[11px] text-slate-500">MG Road, Vijayawada, AP</p>
                <p className="text-[11px] text-slate-500 font-mono">GSTIN: 37AAAAA0000A1Z5</p>
              </div>

              {/* Invoice Metadata */}
              <div className="flex items-center justify-between text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div>
                  <p className="font-bold text-slate-900 font-mono">{inspectInvoice.invoiceNumber}</p>
                  <p className="text-slate-500">
                    Date:{" "}
                    {inspectInvoice.createdAt?.toDate
                      ? inspectInvoice.createdAt.toDate().toLocaleString()
                      : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{inspectInvoice.customer?.name}</p>
                  <p className="text-slate-500 font-mono">{inspectInvoice.customer?.phone}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-center">Qty</th>
                    <th className="py-1.5 text-right">Rate</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {inspectInvoice.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-medium text-slate-800">{it.name}</td>
                      <td className="py-1.5 text-center text-slate-600">{it.quantity}</td>
                      <td className="py-1.5 text-right text-slate-600">₹{Number(it.price).toFixed(2)}</td>
                      <td className="py-1.5 text-right font-bold text-slate-900">₹{Number(it.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculations Breakdown */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹ {Number(inspectInvoice.subtotal).toFixed(2)}</span>
                </div>
                {inspectInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({inspectInvoice.discountPercent}%)</span>
                    <span>- ₹ {Number(inspectInvoice.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax (5%)</span>
                  <span className="font-semibold">₹ {Number(inspectInvoice.taxAmount).toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-extrabold text-slate-950">
                  <span>Total Paid</span>
                  <span>₹ {Number(inspectInvoice.totalPayable).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Payment Method:</span>
                  <span className="font-bold text-blue-600 uppercase">{inspectInvoice.paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setInspectInvoice(null)}
                className="h-[36px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="h-[36px] px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
