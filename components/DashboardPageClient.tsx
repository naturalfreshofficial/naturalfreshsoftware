"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invoice, Branch, Customer } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingBag,
  Receipt,
  Users,
  CreditCard,
  Banknote,
  QrCode,
  ArrowUpRight,
  Store,
  Package,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  Clock,
  Award,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  SlidersHorizontal,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Download,
  FileSpreadsheet,
  Search,
  X,
  Printer,
  FileText,
} from "lucide-react";
import CustomSelect from "@/components/CustomSelect";
import * as XLSX from "xlsx";
import { usePrinter } from "@/lib/PrinterContext";

type TimeRange =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  branchId?: string;
  date?: string;
  createdAt?: any;
}

export default function DashboardPageClient() {
  const { user } = useAuth();

  // Firestore Real-time States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [branchStockMap, setBranchStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const printer = usePrinter();

  // Filters (Default to 'today')
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders">("revenue");
  const [hoveredChartPoint, setHoveredChartPoint] = useState<{
    date: string;
    revenue: number;
    orders: number;
    x: number;
    y: number;
  } | null>(null);

  // Invoices Audit Modal & Print Inspection States
  const [auditModalType, setAuditModalType] = useState<"gst" | "cash" | "upi" | "card" | null>(null);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [inspectInvoice, setInspectInvoice] = useState<Invoice | null>(null);

  // 1. Available branches strictly filtered for staff
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") {
      return branches;
    }
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  useEffect(() => {
    if (user?.role === "staff" && availableBranches.length > 0) {
      if (selectedBranchId === "all" || !availableBranches.some((b) => b.id === selectedBranchId)) {
        setSelectedBranchId(availableBranches[0].id);
      }
    }
  }, [user, availableBranches, selectedBranchId]);

  // 2. Fetch completed invoices
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "invoices"), where("status", "==", "completed"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Invoice[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Invoice);
        });
        setInvoices(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Invoices fetch error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 3. Fetch branches
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), (snapshot) => {
      const list: Branch[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status !== "inactive") {
          list.push({ id: d.id, ...data } as Branch);
        }
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBranches(list);
    });
    return () => unsub();
  }, []);

  // 4. Fetch customers
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "customers"), (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Customer);
      });
      setCustomers(list);
    });
    return () => unsub();
  }, []);

  // 5. Fetch products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.status !== "inactive") {
          list.push({ id: d.id, ...data });
        }
      });
      setProducts(list);
    });
    return () => unsub();
  }, []);

  // 6. Fetch expenses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "expenses"), (snapshot) => {
      const list: ExpenseItem[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ExpenseItem);
      });
      setExpenses(list);
    });
    return () => unsub();
  }, []);

  // 7. Fetch branch stocks
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branch_stocks"), (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.productId && data.branchId) {
          map[`${data.productId}_${data.branchId}`] = Number(data.quantity) || 0;
        }
      });
      setBranchStockMap(map);
    });
    return () => unsub();
  }, []);

  // Date Filtering Helper
  const dateRangeBounds = useMemo(() => {
    const now = new Date();

    switch (timeRange) {
      case "today": {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { start, end };
      }
      case "yesterday": {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
        const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
        return { start, end };
      }
      case "this_week": {
        // Monday to Sunday of the current week
        const dayOfWeek = now.getDay();
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
        return { start, end };
      }
      case "last_week": {
        // Monday to Sunday of previous week
        const dayOfWeek = now.getDay();
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday - 7, 0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
        return { start, end };
      }
      case "this_month": {
        // 1st of current month to last day of current month
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "last_month": {
        // 1st of last month to last day of last month
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end };
      }
      default: {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { start, end };
      }
    }
  }, [timeRange]);

  const dateRangeLabel = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    const startStr = dateRangeBounds.start.toLocaleDateString("en-IN", options);
    const endStr = dateRangeBounds.end.toLocaleDateString("en-IN", options);

    if (timeRange === "today") return `Today (${startStr})`;
    if (timeRange === "yesterday") return `Yesterday (${startStr})`;
    return `${startStr} – ${endStr}`;
  }, [dateRangeBounds, timeRange]);

  // Filtered Invoices based on Branch and Time Range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Branch filter
      if (selectedBranchId !== "all" && inv.branchId && inv.branchId !== selectedBranchId) {
        return false;
      }

      // Date filter
      const invDate = inv.createdAt?.toDate ? inv.createdAt.toDate() : inv.createdAt ? new Date(inv.createdAt) : null;
      if (!invDate) return false;

      return invDate >= dateRangeBounds.start && invDate <= dateRangeBounds.end;
    });
  }, [invoices, selectedBranchId, dateRangeBounds]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (selectedBranchId !== "all" && exp.branchId && exp.branchId !== selectedBranchId) {
        return false;
      }
      const expDate = exp.createdAt?.toDate
        ? exp.createdAt.toDate()
        : exp.date
        ? new Date(exp.date)
        : null;
      if (!expDate) return true;
      return expDate >= dateRangeBounds.start && expDate <= dateRangeBounds.end;
    });
  }, [expenses, selectedBranchId, dateRangeBounds]);

  // Core KPI Aggregates
  const totalRevenue = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.totalPayable) || 0), 0);
  }, [filteredInvoices]);

  const totalOrders = filteredInvoices.length;

  const totalExpensesAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
  }, [filteredExpenses]);

  const netProfit = totalRevenue - totalExpensesAmount;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalGstCollected = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.taxAmount) || 0), 0);
  }, [filteredInvoices]);

  const totalDiscountGiven = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + (Number(inv.discountAmount) || 0), 0);
  }, [filteredInvoices]);

  // Payment Breakdown with collection counts
  const paymentBreakdown = useMemo(() => {
    let upi = 0;
    let cash = 0;
    let card = 0;
    let split = 0;

    let upiCount = 0;
    let cashCount = 0;
    let cardCount = 0;

    filteredInvoices.forEach((inv) => {
      const mode = inv.paymentMethod || "Cash";
      const amt = Number(inv.totalPayable) || 0;
      if (mode === "UPI") {
        upi += amt;
        upiCount++;
      } else if (mode === "Cash") {
        cash += amt;
        cashCount++;
      } else if (mode === "Card") {
        card += amt;
        cardCount++;
      } else if (mode === "Split") {
        split += amt;
        if (inv.splitPayments) {
          const sUpi = Number(inv.splitPayments.upi || 0);
          const sCash = Number(inv.splitPayments.cash || 0);
          const sCard = Number(inv.splitPayments.card || 0);
          upi += sUpi;
          cash += sCash;
          card += sCard;
          if (sUpi > 0) upiCount++;
          if (sCash > 0) cashCount++;
          if (sCard > 0) cardCount++;
        }
      }
    });

    const sum = upi + cash + card;
    return {
      upi: { amount: upi, percent: sum > 0 ? (upi / sum) * 100 : 0, count: upiCount },
      cash: { amount: cash, percent: sum > 0 ? (cash / sum) * 100 : 0, count: cashCount },
      card: { amount: card, percent: sum > 0 ? (card / sum) * 100 : 0, count: cardCount },
      total: sum,
    };
  }, [filteredInvoices]);

  // Specific Invoice Subsets for Auditing & Exports
  const gstInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => (Number(inv.taxAmount) || 0) > 0);
  }, [filteredInvoices]);

  const cashInvoices = useMemo(() => {
    return filteredInvoices.filter(
      (inv) => inv.paymentMethod === "Cash" || (inv.paymentMethod === "Split" && (inv.splitPayments?.cash || 0) > 0)
    );
  }, [filteredInvoices]);

  const upiInvoices = useMemo(() => {
    return filteredInvoices.filter(
      (inv) => inv.paymentMethod === "UPI" || (inv.paymentMethod === "Split" && (inv.splitPayments?.upi || 0) > 0)
    );
  }, [filteredInvoices]);

  const cardInvoices = useMemo(() => {
    return filteredInvoices.filter(
      (inv) => inv.paymentMethod === "Card" || (inv.paymentMethod === "Split" && (inv.splitPayments?.card || 0) > 0)
    );
  }, [filteredInvoices]);

  // Taxable turnover for GST Invoices
  const totalGstTaxableAmount = useMemo(() => {
    return gstInvoices.reduce((acc, inv) => {
      const taxable =
        Number(inv.taxableAmount) ||
        Math.max(0, Number(inv.subtotal || 0) - Number(inv.discountAmount || 0));
      return acc + taxable;
    }, 0);
  }, [gstInvoices]);

  // Invoices filtered for the open audit modal
  const currentAuditInvoices = useMemo(() => {
    let list: Invoice[] = [];
    if (auditModalType === "gst") {
      list = gstInvoices;
    } else if (auditModalType === "cash") {
      list = cashInvoices;
    } else if (auditModalType === "upi") {
      list = upiInvoices;
    } else if (auditModalType === "card") {
      list = cardInvoices;
    }

    if (!auditSearchQuery.trim()) return list;

    const q = auditSearchQuery.toLowerCase();
    return list.filter((inv) => {
      const invNum = inv.invoiceNumber?.toLowerCase() || "";
      const custName = inv.customer?.name?.toLowerCase() || "";
      const custPhone = inv.customer?.phone?.toLowerCase() || "";
      const branchName = inv.branchName?.toLowerCase() || "";
      return (
        invNum.includes(q) ||
        custName.includes(q) ||
        custPhone.includes(q) ||
        branchName.includes(q)
      );
    });
  }, [auditModalType, gstInvoices, cashInvoices, upiInvoices, cardInvoices, auditSearchQuery]);

  const AUDIT_ITEMS_PER_PAGE = 10;
  const auditTotalPages = Math.ceil(currentAuditInvoices.length / AUDIT_ITEMS_PER_PAGE) || 1;
  const paginatedAuditInvoices = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_ITEMS_PER_PAGE;
    return currentAuditInvoices.slice(start, start + AUDIT_ITEMS_PER_PAGE);
  }, [currentAuditInvoices, auditPage]);

  // Reset page when switching modal or searching
  useEffect(() => {
    setAuditPage(1);
  }, [auditModalType, auditSearchQuery]);

  // Export current audit invoices to Excel
  const handleExportAuditExcel = () => {
    if (currentAuditInvoices.length === 0) {
      alert("No invoice records to export for this selection.");
      return;
    }

    const typePrefix =
      auditModalType === "gst"
        ? "GST_Collected_Invoices"
        : auditModalType === "cash"
        ? "Cash_Collected_Invoices"
        : auditModalType === "upi"
        ? "UPI_Collected_Invoices"
        : "Card_Collected_Invoices";

    const excelRows = currentAuditInvoices.map((inv, idx) => {
      const dateStr = inv.createdAt?.toDate
        ? inv.createdAt.toDate().toLocaleString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : inv.createdAt
        ? new Date(inv.createdAt).toLocaleString("en-IN")
        : "—";

      const taxAmt = Number(inv.taxAmount) || 0;
      const cgst = inv.cgstAmount ?? taxAmt / 2;
      const sgst = inv.sgstAmount ?? taxAmt / 2;
      const taxable =
        Number(inv.taxableAmount) ||
        Math.max(0, Number(inv.subtotal || 0) - Number(inv.discountAmount || 0));

      return {
        "Sl. No": idx + 1,
        "Invoice Number": inv.invoiceNumber,
        "Date & Time": dateStr,
        "Outlet / Branch": inv.branchName || "Main Store",
        "Customer Name": inv.customer?.name || "Walk-in Customer",
        "Customer Phone": inv.customer?.phone || "—",
        "Payment Mode": inv.paymentMethod || "Cash",
        "Items Count": inv.itemCount || inv.items?.length || 0,
        "Subtotal (₹)": Number(inv.subtotal || 0).toFixed(2),
        "Discount (₹)": Number(inv.discountAmount || 0).toFixed(2),
        "Taxable Value (₹)": Number(taxable).toFixed(2),
        "CGST 2.5% (₹)": Number(cgst).toFixed(2),
        "SGST 2.5% (₹)": Number(sgst).toFixed(2),
        "Total GST 5% (₹)": Number(taxAmt).toFixed(2),
        "Grand Total (₹)": Number(inv.totalPayable || 0).toFixed(2),
      };
    });

    // Summary Totals Row
    const sumTaxable = currentAuditInvoices.reduce((acc, inv) => {
      const taxable =
        Number(inv.taxableAmount) ||
        Math.max(0, Number(inv.subtotal || 0) - Number(inv.discountAmount || 0));
      return acc + taxable;
    }, 0);
    const sumTax = currentAuditInvoices.reduce((acc, inv) => acc + (Number(inv.taxAmount) || 0), 0);
    const sumTotal = currentAuditInvoices.reduce((acc, inv) => acc + (Number(inv.totalPayable) || 0), 0);

    excelRows.push({
      "Sl. No": "" as any,
      "Invoice Number": "TOTAL SUMMARY",
      "Date & Time": "",
      "Outlet / Branch": "",
      "Customer Name": "",
      "Customer Phone": "",
      "Payment Mode": "",
      "Items Count": currentAuditInvoices.length as any,
      "Subtotal (₹)": "",
      "Discount (₹)": "",
      "Taxable Value (₹)": sumTaxable.toFixed(2),
      "CGST 2.5% (₹)": (sumTax / 2).toFixed(2),
      "SGST 2.5% (₹)": (sumTax / 2).toFixed(2),
      "Total GST 5% (₹)": sumTax.toFixed(2),
      "Grand Total (₹)": sumTotal.toFixed(2),
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    const sheetName = auditModalType === "gst" ? "GST Tax Register" : "Invoices List";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${typePrefix}_${timeRange}_${Date.now()}.xlsx`);
  };

  // Time Series Data for Revenue Trend Area Chart
  const trendData = useMemo(() => {
    if (timeRange === "today" || timeRange === "yesterday") {
      const hourlyMap: Record<number, { revenue: number; orders: number }> = {};
      for (let h = 0; h < 24; h++) hourlyMap[h] = { revenue: 0, orders: 0 };

      filteredInvoices.forEach((inv) => {
        const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
        const hour = d.getHours();
        if (hourlyMap[hour]) {
          hourlyMap[hour].revenue += Number(inv.totalPayable || 0);
          hourlyMap[hour].orders += 1;
        }
      });

      return Array.from({ length: 24 }, (_, h) => {
        const hourLabel = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
        return {
          label: hourLabel,
          revenue: hourlyMap[h].revenue,
          orders: hourlyMap[h].orders,
        };
      });
    } else {
      const daysList: { dateKey: string; label: string; revenue: number; orders: number }[] = [];
      const cur = new Date(dateRangeBounds.start);
      const end = new Date(dateRangeBounds.end);

      while (cur <= end) {
        const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        const label = cur.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          weekday: timeRange === "this_week" || timeRange === "last_week" ? "short" : undefined,
        });
        daysList.push({ dateKey, label, revenue: 0, orders: 0 });
        cur.setDate(cur.getDate() + 1);
      }

      const map = new Map(daysList.map((item) => [item.dateKey, item]));

      filteredInvoices.forEach((inv) => {
        const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const entry = map.get(dateKey);
        if (entry) {
          entry.revenue += Number(inv.totalPayable || 0);
          entry.orders += 1;
        }
      });

      return daysList;
    }
  }, [filteredInvoices, timeRange, dateRangeBounds]);

  // Top Selling Products Leaderboard
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number; category?: string }>();

    filteredInvoices.forEach((inv) => {
      inv.items?.forEach((item) => {
        const key = item.productId || item.name;
        const current = map.get(key) || {
          name: item.name,
          quantity: 0,
          revenue: 0,
          category: "Ice Cream",
        };
        current.quantity += item.quantity || 1;
        current.revenue += Number(item.total || item.price * (item.quantity || 1) || 0);
        map.set(key, current);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [filteredInvoices]);

  // Branch Performance Ranking
  const branchSales = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; orders: number }>();

    branches.forEach((b) => {
      map.set(b.id, { name: b.name, revenue: 0, orders: 0 });
    });

    invoices.forEach((inv) => {
      const bId = inv.branchId || "main";
      const bName = inv.branchName || "Main Store";
      const existing = map.get(bId) || { name: bName, revenue: 0, orders: 0 };
      existing.revenue += Number(inv.totalPayable || 0);
      existing.orders += 1;
      map.set(bId, existing);
    });

    return Array.from(map.values())
      .filter((b) => b.revenue > 0 || branches.length <= 5)
      .sort((a, b) => b.revenue - a.revenue);
  }, [invoices, branches]);

  // Hourly Peak Footfall Distribution (for Ice Cream Evening Rush)
  const hourlyRush = useMemo(() => {
    const hours: number[] = new Array(24).fill(0);
    filteredInvoices.forEach((inv) => {
      const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
      hours[d.getHours()] += 1;
    });

    const maxOrders = Math.max(...hours, 1);
    return hours.map((count, h) => ({
      hour: h,
      label: h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`,
      count,
      percent: (count / maxOrders) * 100,
      isPeak: count === maxOrders && maxOrders > 0,
    }));
  }, [filteredInvoices]);

  // Category Distribution
  const categorySales = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    filteredInvoices.forEach((inv) => {
      inv.items?.forEach((item) => {
        const matchedProd = products.find((p) => p.id === item.productId);
        const cat = matchedProd?.category || "General";
        const cur = map.get(cat) || { count: 0, revenue: 0 };
        cur.count += item.quantity || 1;
        cur.revenue += Number(item.total || 0);
        map.set(cat, cur);
      });
    });

    const totalCatRevenue = Array.from(map.values()).reduce((sum, c) => sum + c.revenue, 0);
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        count: data.count,
        percent: totalCatRevenue > 0 ? (data.revenue / totalCatRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredInvoices, products]);

  // Low Stock Items in Inventory
  const lowStockProducts = useMemo(() => {
    return products
      .map((p) => {
        let stockInBranch = p.stock || 0;
        if (selectedBranchId !== "all") {
          const key = `${p.id}_${selectedBranchId}`;
          stockInBranch = branchStockMap[key] !== undefined ? branchStockMap[key] : p.stock || 0;
        }
        return {
          ...p,
          currentStock: stockInBranch,
          buffer: p.bufferStock || 5,
        };
      })
      .filter((p) => p.currentStock <= p.buffer)
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 5);
  }, [products, selectedBranchId, branchStockMap]);

  // Recent 6 Invoices
  const recentInvoices = useMemo(() => {
    return [...filteredInvoices].slice(0, 6);
  }, [filteredInvoices]);

  // SVG Chart Helper: Generate Smooth Path
  const maxTrendVal = useMemo(() => {
    const vals = trendData.map((d) => (chartMetric === "revenue" ? d.revenue : d.orders));
    return Math.max(...vals, chartMetric === "revenue" ? 1000 : 10);
  }, [trendData, chartMetric]);

  const svgChartWidth = 800;
  const svgChartHeight = 220;
  const svgPadding = 30;

  const chartPoints = useMemo(() => {
    if (trendData.length === 0) return [];
    const usableW = svgChartWidth - svgPadding * 2;
    const usableH = svgChartHeight - svgPadding * 2;
    const stepX = usableW / (trendData.length - 1 || 1);

    return trendData.map((pt, i) => {
      const val = chartMetric === "revenue" ? pt.revenue : pt.orders;
      const x = svgPadding + i * stepX;
      const y = svgChartHeight - svgPadding - (val / maxTrendVal) * usableH;
      return { x, y, data: pt };
    });
  }, [trendData, chartMetric, maxTrendVal]);

  const svgAreaPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    let path = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      const prev = chartPoints[i - 1];
      const cur = chartPoints[i];
      const midX = (prev.x + cur.x) / 2;
      path += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
    }
    const last = chartPoints[chartPoints.length - 1];
    const first = chartPoints[0];
    path += ` L ${last.x} ${svgChartHeight - svgPadding} L ${first.x} ${svgChartHeight - svgPadding} Z`;
    return path;
  }, [chartPoints]);

  const svgLinePath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    let path = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      const prev = chartPoints[i - 1];
      const cur = chartPoints[i];
      const midX = (prev.x + cur.x) / 2;
      path += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
    }
    return path;
  }, [chartPoints]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] mx-auto min-h-full">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & EXECUTIVE CONTROL BAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        {/* Tier 1: Title, Live Status Badge, and Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Executive Analytics & Sales
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>{dateRangeLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time business performance, revenue trends, footfall rush & inventory intelligence.
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <Link
              href="/pos-billing"
              className="h-10 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>New POS Bill</span>
            </Link>
          </div>
        </div>

        {/* Tier 2: Dedicated Filter Toolbar (Pill Presets on left, Outlet selector on right) */}
        <div className="border-t border-slate-100 pt-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Presets Segmented Pills */}
          <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs font-bold overflow-x-auto max-w-full">
            <span className="pl-2 pr-1 text-slate-400 hidden sm:inline-flex items-center">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "last_week", label: "Last Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs whitespace-nowrap ${
                  timeRange === t.id
                    ? "bg-white text-blue-600 shadow-sm font-black"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Branch / Outlet Selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 hidden sm:flex items-center gap-1.5 shrink-0">
              <Store className="w-3.5 h-3.5 text-blue-600" />
              Outlet:
            </span>
            <div className="w-full sm:w-56">
              <CustomSelect
                value={selectedBranchId}
                onChange={(val) => setSelectedBranchId(val)}
                options={[
                  ...(user?.role === "super_admin" || !user
                    ? [{ label: "All Outlets (Consolidated)", value: "all" }]
                    : []),
                  ...availableBranches.map((b) => ({
                    label: b.name,
                    value: b.id,
                  })),
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CORE KPI METRICS CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        {/* Total Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales</span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{totalOrders} paid invoices</span>
            </p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Profit</span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{profitMargin.toFixed(1)}% net margin</span>
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <span className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {totalOrders}
            </div>
            <p className="text-[11px] font-semibold text-purple-600 flex items-center gap-1 mt-1.5">
              <span>Avg ₹ {averageOrderValue.toFixed(0)} / order</span>
            </p>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expenses</span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {totalExpensesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mt-1.5">
              <span>{filteredExpenses.length} entries recorded</span>
            </p>
          </div>
        </div>

        {/* GST Tax Collected (Clickable to inspect invoices & export) */}
        <div
          onClick={() => {
            setAuditModalType("gst");
            setAuditSearchQuery("");
          }}
          role="button"
          tabIndex={0}
          className="bg-white p-4 sm:p-5 rounded-xl border border-cyan-200 hover:border-cyan-400 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
          title="Click to view all GST collected invoices and export to Excel"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GST Collected</span>
            <span className="p-2 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {totalGstCollected.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] font-bold text-cyan-700">
              <span>{gstInvoices.length} bills</span>
              <span className="inline-flex items-center gap-0.5 text-cyan-600 group-hover:underline text-[10px]">
                Audit & Export <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Registered Customers */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customers</span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {customers.length}
            </div>
            <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1.5">
              <span>Active client profiles</span>
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2b. PAYMENT COLLECTION CHANNELS & GST AUDIT STRIP */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Payment Collections & Tax Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Channel breakdown (Cash, UPI, Card) & GST tax pool for {dateRangeLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setAuditModalType("gst");
                setAuditSearchQuery("");
              }}
              className="h-9 px-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>GST Invoices List & Excel Export</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Cash Collection Card */}
          <div
            onClick={() => {
              setAuditModalType("cash");
              setAuditSearchQuery("");
            }}
            role="button"
            tabIndex={0}
            className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200/70 hover:border-emerald-400 hover:bg-emerald-50/70 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                Cash Collected
              </span>
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {paymentBreakdown.cash.percent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {paymentBreakdown.cash.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{paymentBreakdown.cash.count} cash payments</span>
              <span className="text-emerald-700 group-hover:underline font-bold text-[10px] flex items-center gap-0.5">
                Inspect <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* UPI Collection Card */}
          <div
            onClick={() => {
              setAuditModalType("upi");
              setAuditSearchQuery("");
            }}
            role="button"
            tabIndex={0}
            className="p-4 rounded-xl bg-blue-50/40 border border-blue-200/70 hover:border-blue-400 hover:bg-blue-50/70 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-600" />
                UPI / QR Collected
              </span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {paymentBreakdown.upi.percent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {paymentBreakdown.upi.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{paymentBreakdown.upi.count} transactions</span>
              <span className="text-blue-700 group-hover:underline font-bold text-[10px] flex items-center gap-0.5">
                Inspect <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card Collection Card */}
          <div
            onClick={() => {
              setAuditModalType("card");
              setAuditSearchQuery("");
            }}
            role="button"
            tabIndex={0}
            className="p-4 rounded-xl bg-purple-50/40 border border-purple-200/70 hover:border-purple-400 hover:bg-purple-50/70 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-purple-600" />
                Card / POS Collected
              </span>
              <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                {paymentBreakdown.card.percent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2.5 text-xl font-black text-slate-900 font-mono tracking-tight">
              ₹ {paymentBreakdown.card.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>{paymentBreakdown.card.count} card swipes</span>
              <span className="text-purple-700 group-hover:underline font-bold text-[10px] flex items-center gap-0.5">
                Inspect <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* GST Tax Collection Card */}
          <div
            onClick={() => {
              setAuditModalType("gst");
              setAuditSearchQuery("");
            }}
            role="button"
            tabIndex={0}
            className="p-4 rounded-xl bg-cyan-50/50 border border-cyan-300 hover:border-cyan-500 hover:bg-cyan-50/80 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-700" />
                GST Collected (5%)
              </span>
              <span className="text-[10px] font-extrabold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full border border-cyan-200">
                CGST + SGST
              </span>
            </div>
            <div className="mt-2.5 text-xl font-black text-cyan-950 font-mono tracking-tight">
              ₹ {totalGstCollected.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-cyan-800">
              <span>{gstInvoices.length} tax invoices</span>
              <span className="text-cyan-700 group-hover:underline font-bold text-[10px] flex items-center gap-0.5">
                View & Export <Download className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. GRAPHICAL SECTION: REVENUE TREND (AREA CHART) & PAYMENT MODES (DONUT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Revenue & Orders Trend Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Revenue & Sales Trajectory</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Graphical timeline of billing performance across the selected interval.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[6px] border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric("revenue")}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === "revenue"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("orders")}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === "orders"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Order Volume
              </button>
            </div>
          </div>

          {/* SVG Area Chart Graphic */}
          <div className="relative mt-4 w-full h-[240px] flex items-end">
            {trendData.length > 0 && chartPoints.length > 1 ? (
              <div className="relative w-full h-full">
                <svg
                  viewBox={`0 0 ${svgChartWidth} ${svgChartHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  {[0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = svgChartHeight - svgPadding - pct * (svgChartHeight - svgPadding * 2);
                    return (
                      <g key={pct}>
                        <line
                          x1={svgPadding}
                          y1={y}
                          x2={svgChartWidth - svgPadding}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                        <text
                          x={svgPadding - 5}
                          y={y + 3}
                          fill="#94a3b8"
                          fontSize="9"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {chartMetric === "revenue"
                            ? `₹${((maxTrendVal * pct) / 1000).toFixed(0)}k`
                            : Math.round(maxTrendVal * pct)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Shaded Area */}
                  <path d={svgAreaPath} fill="url(#areaGradient)" />

                  {/* Stroke Line */}
                  <path
                    d={svgLinePath}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Points */}
                  {chartPoints.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={hoveredChartPoint?.date === pt.data.label ? "6" : "3.5"}
                      className="fill-white stroke-blue-600 stroke-2 cursor-pointer transition-all hover:scale-125"
                      onMouseEnter={(e) => {
                        setHoveredChartPoint({
                          date: pt.data.label,
                          revenue: pt.data.revenue,
                          orders: pt.data.orders,
                          x: pt.x,
                          y: pt.y,
                        });
                      }}
                      onMouseLeave={() => setHoveredChartPoint(null)}
                    />
                  ))}
                </svg>

                {/* Floating Tooltip */}
                {hoveredChartPoint && (
                  <div
                    className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-slate-900/95 text-white p-2.5 rounded-[6px] shadow-xl text-[11px] font-mono border border-slate-700 min-w-[130px]"
                    style={{
                      left: `${(hoveredChartPoint.x / svgChartWidth) * 100}%`,
                      top: `${(hoveredChartPoint.y / svgChartHeight) * 100 - 8}%`,
                    }}
                  >
                    <p className="font-bold text-slate-300 border-b border-slate-700 pb-1 mb-1">
                      {hoveredChartPoint.date}
                    </p>
                    <p className="text-emerald-400 font-bold">
                      Revenue: ₹ {hoveredChartPoint.revenue.toFixed(2)}
                    </p>
                    <p className="text-blue-300">Orders: {hoveredChartPoint.orders}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                No billing history available for this range.
              </div>
            )}
          </div>

          {/* X Axis Labels */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-100">
            {trendData.slice(0, 7).map((pt, idx) => (
              <span key={idx}>{pt.label}</span>
            ))}
            {trendData.length > 7 && (
              <span>{trendData[trendData.length - 1].label}</span>
            )}
          </div>
        </div>

        {/* Right 1 Col: Payment Methods Distribution (Donut Graph) */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Payment Breakdown</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Split by collection channel</p>
            </div>
            <span className="text-xs font-bold text-blue-600 font-mono">
              ₹ {paymentBreakdown.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Circular Donut Graphic */}
          <div className="flex items-center justify-center my-4 relative">
            <svg width="170" height="170" viewBox="0 0 170 170" className="transform -rotate-90">
              <circle cx="85" cy="85" r="65" stroke="#f1f5f9" strokeWidth="20" fill="transparent" />

              {/* UPI Segment (Blue) */}
              <circle
                cx="85"
                cy="85"
                r="65"
                stroke="#3b82f6"
                strokeWidth="20"
                fill="transparent"
                strokeDasharray={`${(paymentBreakdown.upi.percent / 100) * 408} 408`}
                strokeDashoffset="0"
                className="transition-all duration-500"
              />

              {/* Cash Segment (Emerald) */}
              <circle
                cx="85"
                cy="85"
                r="65"
                stroke="#10b981"
                strokeWidth="20"
                fill="transparent"
                strokeDasharray={`${(paymentBreakdown.cash.percent / 100) * 408} 408`}
                strokeDashoffset={`-${(paymentBreakdown.upi.percent / 100) * 408}`}
                className="transition-all duration-500"
              />

              {/* Card Segment (Purple) */}
              <circle
                cx="85"
                cy="85"
                r="65"
                stroke="#8b5cf6"
                strokeWidth="20"
                fill="transparent"
                strokeDasharray={`${(paymentBreakdown.card.percent / 100) * 408} 408`}
                strokeDashoffset={`-${((paymentBreakdown.upi.percent + paymentBreakdown.cash.percent) / 100) * 408}`}
                className="transition-all duration-500"
              />
            </svg>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Billed</span>
              <span className="text-base font-extrabold text-slate-900 font-mono">
                ₹ {(paymentBreakdown.total / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* Interactive Legends */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <QrCode className="w-3 h-3 text-blue-500" />
                  UPI / QR
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold text-slate-900">₹ {paymentBreakdown.upi.amount.toFixed(0)}</span>
                <span className="text-[10px] text-slate-400 ml-1.5">({paymentBreakdown.upi.percent.toFixed(0)}%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Banknote className="w-3 h-3 text-emerald-500" />
                  Cash
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold text-slate-900">₹ {paymentBreakdown.cash.amount.toFixed(0)}</span>
                <span className="text-[10px] text-slate-400 ml-1.5">({paymentBreakdown.cash.percent.toFixed(0)}%)</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-purple-500" />
                  Card
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold text-slate-900">₹ {paymentBreakdown.card.amount.toFixed(0)}</span>
                <span className="text-[10px] text-slate-400 ml-1.5">({paymentBreakdown.card.percent.toFixed(0)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PERFORMANCE INTELLIGENCE: HOURLY PEAK FOOTFALL & BRANCH COMPARISON */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Peak Sales & Footfall Activity */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">Hourly Footfall & Rush Pattern</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Order distribution across hours of the day</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-[4px]">
              Evening Peak Analysis
            </span>
          </div>

          {/* Bar Histogram of 24 Hours */}
          <div className="pt-6 pb-2">
            <div className="h-32 flex items-end gap-1 sm:gap-1.5 justify-between">
              {hourlyRush.map((hr) => (
                <div
                  key={hr.hour}
                  className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1 z-10 pointer-events-none bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                    {hr.label}: {hr.count} orders
                  </div>

                  <div
                    style={{ height: `${Math.max(hr.percent, 6)}%` }}
                    className={`w-full rounded-t-[3px] transition-all duration-300 ${
                      hr.isPeak
                        ? "bg-gradient-to-t from-amber-500 to-amber-400 shadow-xs"
                        : hr.count > 0
                        ? "bg-blue-500/80 hover:bg-blue-600"
                        : "bg-slate-100"
                    }`}
                  />
                  <span className="text-[8px] sm:text-[9px] text-slate-400 font-mono truncate">
                    {hr.hour % 3 === 0 ? hr.label.replace(" ", "") : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500" />
              <span>Highest Rush Hour</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-500" />
              <span>Regular Operating Hours</span>
            </span>
          </div>
        </div>

        {/* Branch / Outlet Comparative Performance */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">Outlet Revenue Benchmark</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Sales volume generated per retail outlet</p>
            </div>
            <Link
              href="/branches"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3.5 my-4">
            {branchSales.slice(0, 5).map((b, idx) => {
              const highestBranchRev = branchSales[0]?.revenue || 1;
              const barPercent = Math.min(100, (b.revenue / highestBranchRev) * 100);

              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span>{b.name}</span>
                    </span>
                    <span className="font-extrabold font-mono text-slate-900">
                      ₹ {b.revenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">({b.orders} bills)</span>
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : idx === 1
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                          : "bg-slate-400"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Tracking active outlets in real time</span>
            <span className="font-bold text-emerald-600">
              Top: {branchSales[0]?.name || "Main Store"}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TOP SELLING PRODUCTS, CATEGORY MIX & LOW INVENTORY ALERTS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Products Leaderboard */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top Selling Products</h3>
                <p className="text-[10px] text-slate-400">Best performers by total billing</p>
              </div>
            </div>
            <Link
              href="/products"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Catalog</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {topProducts.length > 0 ? (
              topProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] shrink-0 ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800"
                          : idx === 1
                          ? "bg-slate-200 text-slate-700"
                          : idx === 2
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-50 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.quantity} units sold</p>
                    </div>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-800 shrink-0">
                    ₹ {p.revenue.toFixed(0)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No sales records in selected range.</p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-right">
            <span>Aggregated across variant combinations</span>
          </div>
        </div>

        {/* Category Contribution */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Category Share</h3>
                <p className="text-[10px] text-slate-400">Revenue split across item types</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600">Top 5</span>
          </div>

          <div className="space-y-3 my-2">
            {categorySales.length > 0 ? (
              categorySales.map((cat, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-800">{cat.name}</span>
                    <span className="font-mono text-slate-600 font-semibold">
                      ₹ {cat.revenue.toFixed(0)} ({cat.percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${cat.percent}%` }}
                      className="bg-indigo-600 h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No category data available.</p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Categories track billing trends</span>
            <span className="font-bold text-indigo-600">Dynamic</span>
          </div>
        </div>

        {/* Low Stock Replenishment Alerts */}
        <div className="bg-white rounded-[10px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Low Stock Alerts</h3>
                <p className="text-[10px] text-slate-400">Items nearing buffer stock limit</p>
              </div>
            </div>
            <Link
              href="/stock-assignment"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>Restock</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400">Buffer: {p.buffer} KG</p>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-red-50 text-red-700 border border-red-200 shrink-0">
                    {Number(p.currentStock).toFixed(2)} KG left
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-xs text-emerald-600 font-bold">✓ Inventory Healthy</p>
                <p className="text-[10px] text-slate-400 mt-0.5">All monitored products above buffer stock.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Buffer limit: 5 KG standard</span>
            <span className="font-bold text-red-600">Immediate Action</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. RECENT TRANSACTIONS TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-[10px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Completed Invoices</h2>
            <p className="text-xs text-slate-500">Latest completed point-of-sale customer transactions</p>
          </div>
          <Link
            href="/invoices"
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            <span>View All Invoices</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Outlet</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-right">GST</th>
                <th className="py-3 px-4 text-right">Total Paid</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {inv.branchName || "Main Store"}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{inv.customer?.name || "Walk-in"}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{inv.customer?.phone || "—"}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {inv.itemCount || inv.items?.length || 0} Units
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          inv.paymentMethod === "UPI"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : inv.paymentMethod === "Cash"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : inv.paymentMethod === "Split"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                      >
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      ₹ {Number(inv.taxAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                      ₹ {Number(inv.totalPayable).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/invoices"
                        className="h-[28px] px-2.5 inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-bold text-[10px] transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No completed invoices recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. GST & PAYMENT INVOICES AUDIT MODAL WITH EXCEL EXPORT */}
      {/* ========================================================================= */}
      {auditModalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-[6px] bg-blue-600 text-white shadow-xs">
                    {auditModalType === "gst" ? (
                      <Layers className="w-4 h-4" />
                    ) : auditModalType === "cash" ? (
                      <Banknote className="w-4 h-4" />
                    ) : auditModalType === "upi" ? (
                      <QrCode className="w-4 h-4" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {auditModalType === "gst"
                      ? "GST Invoices Register & Tax Breakdown"
                      : auditModalType === "cash"
                      ? "Cash Collection Invoices Register"
                      : auditModalType === "upi"
                      ? "UPI / QR Collection Invoices Register"
                      : "Card / POS Collection Invoices Register"}
                  </h3>
                  <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-[4px] border border-blue-200">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    <span>{dateRangeLabel}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {auditModalType === "gst"
                    ? `Showing all invoices with GST tax recorded (${gstInvoices.length} bills). Inspect breakdown or export directly to Excel.`
                    : `Detailed transaction list for ${auditModalType.toUpperCase()} payments (${currentAuditInvoices.length} bills).`}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setAuditModalType(null)}
                className="h-[32px] w-[32px] self-end sm:self-auto flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-[6px] hover:bg-slate-200/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick KPI Strip inside Modal */}
            <div className="p-3 sm:p-4 bg-slate-100/70 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total GST Pool
                </span>
                <span className="text-sm sm:text-base font-extrabold text-cyan-700 font-mono">
                  ₹ {totalGstCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  CGST (2.5%) / SGST (2.5%)
                </span>
                <span className="text-sm sm:text-base font-extrabold text-slate-800 font-mono">
                  ₹ {(totalGstCollected / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })} each
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Taxable Turnover
                </span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
                  ₹ {totalGstTaxableAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Matching Invoices
                </span>
                <span className="text-sm sm:text-base font-extrabold text-blue-600 font-mono">
                  {currentAuditInvoices.length} Bills
                </span>
              </div>
            </div>

            {/* Toolbar: Category Tabs, Search Bar & EXPORT TO EXCEL button */}
            <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
              {/* Category Tabs */}
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-[6px] border border-slate-200 text-xs font-bold w-full md:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAuditModalType("gst")}
                  className={`px-3 py-1.5 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                    auditModalType === "gst"
                      ? "bg-white text-cyan-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  GST Invoices ({gstInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditModalType("cash")}
                  className={`px-3 py-1.5 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                    auditModalType === "cash"
                      ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cash ({cashInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditModalType("upi")}
                  className={`px-3 py-1.5 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                    auditModalType === "upi"
                      ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  UPI ({upiInvoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditModalType("card")}
                  className={`px-3 py-1.5 rounded-[4px] transition-all cursor-pointer whitespace-nowrap ${
                    auditModalType === "card"
                      ? "bg-white text-purple-700 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Card ({cardInvoices.length})
                </button>
              </div>

              {/* Search & Export Button */}
              <div className="flex items-center gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search invoice #, customer..."
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="w-full h-[36px] pl-8.5 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportAuditExcel}
                  className="h-[36px] px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
                  title="Export this data table as a Microsoft Excel spreadsheet"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export to Excel</span>
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto flex-1 p-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Invoice #</th>
                    <th className="py-3 px-3.5">Date & Time</th>
                    <th className="py-3 px-3.5">Outlet</th>
                    <th className="py-3 px-3.5">Customer</th>
                    <th className="py-3 px-3.5 text-center">Payment</th>
                    <th className="py-3 px-3.5 text-right">Taxable (₹)</th>
                    <th className="py-3 px-3.5 text-right">CGST (2.5%)</th>
                    <th className="py-3 px-3.5 text-right">SGST (2.5%)</th>
                    <th className="py-3 px-3.5 text-right font-extrabold text-cyan-800">Total GST</th>
                    <th className="py-3 px-3.5 text-right font-extrabold text-slate-900">Total Paid</th>
                    <th className="py-3 px-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedAuditInvoices.length > 0 ? (
                    paginatedAuditInvoices.map((inv) => {
                      const taxAmt = Number(inv.taxAmount) || 0;
                      const cgst = inv.cgstAmount ?? taxAmt / 2;
                      const sgst = inv.sgstAmount ?? taxAmt / 2;
                      const taxable =
                        Number(inv.taxableAmount) ||
                        Math.max(0, Number(inv.subtotal || 0) - Number(inv.discountAmount || 0));

                      const dateStr = inv.createdAt?.toDate
                        ? inv.createdAt.toDate().toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : inv.createdAt
                        ? new Date(inv.createdAt).toLocaleString("en-IN")
                        : "—";

                      return (
                        <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-bold text-blue-700">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap text-[11px]">
                            {dateStr}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              <Store className="w-3 h-3 text-slate-500" />
                              {inv.branchName || "Main Store"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <p className="font-bold text-slate-800">{inv.customer?.name || "Walk-in Customer"}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{inv.customer?.phone || "—"}</p>
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                inv.paymentMethod === "UPI"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : inv.paymentMethod === "Cash"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : inv.paymentMethod === "Split"
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {inv.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-600">
                            ₹ {taxable.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-600 text-[11px]">
                            ₹ {cgst.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-slate-600 text-[11px]">
                            ₹ {sgst.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-cyan-800">
                            ₹ {taxAmt.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-900">
                            ₹ {Number(inv.totalPayable).toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setInspectInvoice(inv)}
                              className="h-[28px] px-2.5 inline-flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition-colors cursor-pointer"
                              title="View full tax invoice receipt"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-slate-600 text-xs">No matching invoices found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Try adjusting your date range filter or search keyword.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer & Pagination */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 font-medium">
                Showing{" "}
                <span className="font-bold text-slate-800">
                  {currentAuditInvoices.length > 0 ? (auditPage - 1) * AUDIT_ITEMS_PER_PAGE + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-bold text-slate-800">
                  {Math.min(auditPage * AUDIT_ITEMS_PER_PAGE, currentAuditInvoices.length)}
                </span>{" "}
                of <span className="font-bold text-slate-800">{currentAuditInvoices.length}</span> invoices
              </div>

              {auditTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAuditPage(1)}
                    disabled={auditPage === 1}
                    className="h-[30px] w-[30px] flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="First page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="h-[30px] w-[30px] flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-2 text-xs font-semibold text-slate-700">
                    Page {auditPage} of {auditTotalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                    disabled={auditPage === auditTotalPages}
                    className="h-[30px] w-[30px] flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditPage(auditTotalPages)}
                    disabled={auditPage === auditTotalPages}
                    className="h-[30px] w-[30px] flex items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Last page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setAuditModalType(null)}
                className="h-[32px] px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-[6px] text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. DETAILED TAX INVOICE RECEIPT INSPECTION MODAL */}
      {/* ========================================================================= */}
      {inspectInvoice && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tax Invoice Receipt</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-mono text-slate-500">{inspectInvoice.invoiceNumber}</p>
                    <span className="text-[9px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold uppercase">
                      Completed
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectInvoice(null)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Content */}
            <div className="p-6 space-y-4 text-xs bg-white text-slate-800 overflow-y-auto max-h-[68vh]">
              {/* Store Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="w-12 h-12 mx-auto mb-1 rounded-[6px] overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">
                  {printer.settings.storeName || "NATURAL FRESH"}
                </h4>
                {printer.settings.tagline && (
                  <p className="text-[10px] text-slate-500 font-medium">
                    {printer.settings.tagline}
                  </p>
                )}
                <p className="text-[11px] font-bold text-blue-700">
                  Outlet: {inspectInvoice.branchName || "Main Store"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {printer.settings.storeAddress || "Guntur, Andhra Pradesh"}
                </p>
                {printer.settings.storePhone && (
                  <p className="text-[11px] text-slate-500 font-mono">
                    Ph: {printer.settings.storePhone}
                  </p>
                )}
                {Number(inspectInvoice.taxAmount || 0) > 0 && printer.settings.storeGst && (
                  <p className="text-[11px] text-slate-700 font-bold font-mono">
                    GSTIN: {printer.settings.storeGst}
                  </p>
                )}
              </div>

              {/* Invoice Metadata */}
              <div className="flex items-center justify-between text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div>
                  <p className="font-bold text-slate-900 font-mono">{inspectInvoice.invoiceNumber}</p>
                  <p className="text-slate-500">
                    Date:{" "}
                    {inspectInvoice.createdAt?.toDate
                      ? inspectInvoice.createdAt.toDate().toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{inspectInvoice.customer?.name || "Walk-in Customer"}</p>
                  {inspectInvoice.customer?.phone && (
                    <p className="text-slate-500 font-mono">{inspectInvoice.customer.phone}</p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectInvoice.items?.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1.5 font-medium text-slate-800">
                        {item.name}
                        {item.variantName && (
                          <span className="text-[10px] text-slate-500 block">
                            ({item.variantName})
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-center">{item.quantity}</td>
                      <td className="py-1.5 text-right font-mono">₹{Number(item.price).toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono font-semibold">
                        ₹{Number(item.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">₹ {Number(inspectInvoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(inspectInvoice.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount ({inspectInvoice.discountPercent || 0}%)</span>
                    <span className="font-mono">- ₹ {Number(inspectInvoice.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(inspectInvoice.taxAmount) > 0 ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (2.5%)</span>
                      <span className="font-mono">
                        ₹ {(Number(inspectInvoice.cgstAmount ?? inspectInvoice.taxAmount / 2)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (2.5%)</span>
                      <span className="font-mono">
                        ₹ {(Number(inspectInvoice.sgstAmount ?? inspectInvoice.taxAmount / 2)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-cyan-800 font-semibold">
                      <span>Total GST (5%)</span>
                      <span className="font-mono">₹ {Number(inspectInvoice.taxAmount).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-400 italic">
                    <span>GST (0%)</span>
                    <span className="font-mono">Exempted / Disabled</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-300 pt-1.5">
                  <span>Total Payable</span>
                  <span className="font-mono">₹ {Number(inspectInvoice.totalPayable).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                  <span>Payment Mode</span>
                  <span className="font-bold text-slate-800 uppercase">{inspectInvoice.paymentMethod}</span>
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-[36px] px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>System Print</span>
                </button>

                {printer.isConnected && (
                  <button
                    type="button"
                    onClick={() => printer.printInvoice(inspectInvoice)}
                    disabled={printer.isPrinting}
                    className="h-[36px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {printer.isPrinting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>Thermal Print</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
