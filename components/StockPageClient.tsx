"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";
import {
  Layers,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Minus,
  Edit3,
  X,
  Check,
  Package,
  IndianRupee,
  SlidersHorizontal,
  Store,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/AuthContext";
import CustomSelect from "@/components/CustomSelect";


export type StockHealthStatus =
  | "crossed_buffer" // 🔴 Depleted past buffer (urgent restock)
  | "reached_buffer" // 🟠 Exactly at buffer threshold
  | "closer_buffer" // 🟡 Near buffer (approaching low limit)
  | "good_stock"; // 🟢 Healthy stock level

export interface StockProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
  bufferStock: number;
  status: "active" | "inactive";
  imageUrl?: string;
}

export default function StockPageClient() {
  const toast = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Mapping of `${productId}_${branchId}` -> quantity
  const [branchStockMap, setBranchStockMap] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<string[]>(["All Categories"]);
  const [loading, setLoading] = useState(true);

  // Available branches filtered strictly by role
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") {
      return branches;
    }
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    "all" | StockHealthStatus
  >("all");

  // Auto select first assigned branch for staff
  useEffect(() => {
    if (user?.role === "staff" && availableBranches.length > 0) {
      if (selectedBranchFilter === "all" || !availableBranches.some((b) => b.id === selectedBranchFilter)) {
        setSelectedBranchFilter(availableBranches[0].id);
      }
    }
  }, [user, availableBranches, selectedBranchFilter]);


  // Quick Stock Adjustment Modal State
  const [adjustingProduct, setAdjustingProduct] = useState<StockProduct | null>(null);
  const [adjustBranchId, setAdjustBranchId] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "set">("add");
  const [adjustQty, setAdjustQty] = useState<number | "">("");
  const [adjustBufferQty, setAdjustBufferQty] = useState<number | "">("");
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  // 1. Subscribe to Products in Firestore
  useEffect(() => {
    setLoading(true);
    const unsubProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const items: StockProduct[] = [];
        const catSet = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== "inactive") {
            const cat = data.category || "General";
            catSet.add(cat);
            items.push({
              id: docSnap.id,
              name: data.name || "Unnamed Product",
              barcode: data.barcode || "",
              category: cat,
              price: Number(data.price) || 0,
              stock: Number(data.stock) ?? 0,
              bufferStock: Number(data.bufferStock) > 0 ? Number(data.bufferStock) : 5,
              status: data.status || "active",
              imageUrl: data.imageUrl || "/logo.png",
            });
          }
        });

        items.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(items);
        setCategories(["All Categories", ...Array.from(catSet)]);
        setLoading(false);
      },
      (err) => {
        console.error("Stock products listener error:", err);
        setLoading(false);
      }
    );

    return () => unsubProducts();
  }, []);

  // 2. Subscribe to Branches in Firestore
  useEffect(() => {
    const unsubBranches = onSnapshot(collection(db, "branches"), (snapshot) => {
      const bList: Branch[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status !== "inactive") {
          bList.push({ id: docSnap.id, ...d } as Branch);
        }
      });
      bList.sort((a, b) => a.name.localeCompare(b.name));
      setBranches(bList);
    });

    return () => unsubBranches();
  }, []);

  // 3. Subscribe to Branch Stocks in Firestore
  useEffect(() => {
    const unsubBranchStocks = onSnapshot(
      collection(db, "branch_stocks"),
      (snapshot) => {
        const map: Record<string, number> = {};
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.productId && d.branchId) {
            map[`${d.productId}_${d.branchId}`] = Number(d.quantity) || 0;
          }
        });
        setBranchStockMap(map);
      }
    );

    return () => unsubBranchStocks();
  }, []);

  // Helper to determine Stock Health Status
  const getProductStockHealth = (stock: number, bufferStock: number): StockHealthStatus => {
    if (stock < bufferStock) {
      return "crossed_buffer"; // 🔴 Depleted past buffer
    } else if (stock === bufferStock) {
      return "reached_buffer"; // 🟠 Reached exact buffer threshold
    } else if (stock <= Math.max(bufferStock + 5, bufferStock * 1.5)) {
      return "closer_buffer"; // 🟡 Warning: Closer to buffer
    } else {
      return "good_stock"; // 🟢 Good / Healthy stock
    }
  };

  // Helper to get total branch-assigned stock for a product
  const getConsolidatedBranchStock = (productId: string): number => {
    if (branches.length === 0) return 0;
    return branches.reduce((sum, b) => {
      const k = `${productId}_${b.id}`;
      return sum + (branchStockMap[k] || 0);
    }, 0);
  };

  // Compute products with calculated branch-wise analytics
  const analyzedProducts = useMemo(() => {
    return products.map((p) => {
      // Determine effective stock based on selected branch filter
      let effectiveStock: number;
      if (selectedBranchFilter === "all") {
        effectiveStock = getConsolidatedBranchStock(p.id);
      } else {
        const key = `${p.id}_${selectedBranchFilter}`;
        effectiveStock = branchStockMap[key] !== undefined ? branchStockMap[key] : 0;
      }

      const health = getProductStockHealth(effectiveStock, p.bufferStock);
      const stockValuation = effectiveStock * p.price;
      const ratio = p.bufferStock > 0 ? Math.min(200, (effectiveStock / p.bufferStock) * 100) : 100;

      // Branch breakdown details
      const branchBreakdown = branches.map((b) => ({
        branchId: b.id,
        branchName: b.name,
        qty: branchStockMap[`${p.id}_${b.id}`] || 0,
      }));

      return {
        ...p,
        effectiveStock,
        health,
        stockValuation,
        ratio,
        branchBreakdown,
      };
    });
  }, [products, branches, branchStockMap, selectedBranchFilter]);

  // Aggregate Category Counts & Valuation KPI for current branch filter
  const stats = useMemo(() => {
    let crossed = 0;
    let reached = 0;
    let closer = 0;
    let good = 0;
    let totalStockUnits = 0;
    let totalValuation = 0;

    analyzedProducts.forEach((p) => {
      totalStockUnits += Math.max(0, p.effectiveStock);
      totalValuation += Math.max(0, p.stockValuation);

      if (p.health === "crossed_buffer") crossed++;
      else if (p.health === "reached_buffer") reached++;
      else if (p.health === "closer_buffer") closer++;
      else if (p.health === "good_stock") good++;
    });

    return {
      total: analyzedProducts.length,
      crossed,
      reached,
      closer,
      good,
      totalStockUnits,
      totalValuation,
    };
  }, [analyzedProducts]);

  // Filtered Products based on Search, Category, and Active Status Tab
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return analyzedProducts.filter((p) => {
      // Status Filter
      if (selectedStatusFilter !== "all" && p.health !== selectedStatusFilter) {
        return false;
      }
      // Category Filter
      if (
        selectedCategory !== "All Categories" &&
        p.category !== selectedCategory
      ) {
        return false;
      }
      // Search Query
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [analyzedProducts, selectedStatusFilter, selectedCategory, searchQuery]);

  // Selected Branch Name
  const selectedBranchName = useMemo(() => {
    if (selectedBranchFilter === "all") return "All Branches (Consolidated)";
    const b = branches.find((item) => item.id === selectedBranchFilter);
    return b ? b.name : "Selected Branch";
  }, [selectedBranchFilter, branches]);

  // Open Quick Stock Adjust Modal
  const openAdjustModal = (product: StockProduct) => {
    setAdjustingProduct(product);
    setAdjustBranchId(selectedBranchFilter !== "all" ? selectedBranchFilter : (branches[0]?.id || ""));
    setAdjustmentType("add");
    setAdjustQty("");
    setAdjustBufferQty("");
  };

  // Save Stock Adjustment to Firestore
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const targetBranchId = adjustBranchId || (branches[0]?.id || "");
    const targetBranch = branches.find((b) => b.id === targetBranchId);
    const key = `${adjustingProduct.id}_${targetBranchId}`;
    const currentBranchStock = branchStockMap[key] || 0;

    let newBranchStock = currentBranchStock;
    if (adjustmentType === "add") {
      const added = Number(adjustQty) || 0;
      newBranchStock += added;
    } else {
      if (adjustQty === "" || Number(adjustQty) < 0) {
        toast.warning("Please enter a valid stock quantity");
        return;
      }
      newBranchStock = Number(adjustQty);
    }

    const newBuffer =
      adjustBufferQty === "" || Number(adjustBufferQty) < 0
        ? adjustingProduct.bufferStock
        : Number(adjustBufferQty);

    setIsUpdatingStock(true);
    try {
      // 1. Update branch stock document in branch_stocks
      if (targetBranchId) {
        await setDoc(
          doc(db, "branch_stocks", key),
          {
            productId: adjustingProduct.id,
            productName: adjustingProduct.name,
            branchId: targetBranchId,
            branchName: targetBranch?.name || "",
            quantity: newBranchStock,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 2. Calculate updated product consolidated stock
      let updatedTotal = 0;
      branches.forEach((b) => {
        if (b.id === targetBranchId) {
          updatedTotal += newBranchStock;
        } else {
          updatedTotal += branchStockMap[`${adjustingProduct.id}_${b.id}`] || 0;
        }
      });

      // 3. Update main product document in products
      await updateDoc(doc(db, "products", adjustingProduct.id), {
        stock: updatedTotal,
        bufferStock: newBuffer,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        `Updated stock for "${adjustingProduct.name}" at ${targetBranch?.name || "branch"} (${newBranchStock} units)`
      );
      setAdjustingProduct(null);
    } catch (err: any) {
      console.error("Stock update error:", err);
      toast.error("Failed to update stock: " + err.message);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Export Stock Report to Excel
  const handleExportStockExcel = () => {
    if (filteredProducts.length === 0) {
      toast.warning("No stock items to export");
      return;
    }

    const data = filteredProducts.map((p, idx) => {
      const row: Record<string, any> = {
        "SL No": idx + 1,
        "Product Name": p.name,
        Category: p.category,
        Barcode: p.barcode || "—",
        "Selected View": selectedBranchName,
        "Stock Units": p.effectiveStock,
        "Buffer Limit": p.bufferStock,
        "Health Status":
          p.health === "crossed_buffer"
            ? "Crossed Buffer (Critical)"
            : p.health === "reached_buffer"
            ? "Reached Buffer (Limit)"
            : p.health === "closer_buffer"
            ? "Closer to Buffer (Warning)"
            : "Good Stock (Healthy)",
        "Unit Price (INR)": p.price,
        "Total Valuation (INR)": p.stockValuation,
      };

      // If consolidated view, append branch breakdown columns
      if (selectedBranchFilter === "all") {
        branches.forEach((b) => {
          row[b.name] = branchStockMap[`${p.id}_${b.id}`] || 0;
        });
      }

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Analytics");
    XLSX.writeFile(
      workbook,
      `stock_analytics_${selectedBranchFilter}_${Date.now()}.xlsx`
    );
    toast.success(`Exported ${filteredProducts.length} stock items to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Stock & Buffer Analytics
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {stats.total} SKUs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Branch-wise inventory tracking, buffer threshold indicators, critical stock depletion alerts, and valuation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Branch Filter Selector */}
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-blue-600 shrink-0" />
            <CustomSelect
              value={selectedBranchFilter}
              onChange={(val) => setSelectedBranchFilter(val)}
              options={[
                ...(user?.role === "super_admin"
                  ? [{ value: "all", label: "🏢 All Branches (Consolidated)" }]
                  : []),
                ...availableBranches.map((b) => ({ value: b.id, label: `📍 ${b.name}` })),
              ]}
              searchable={true}
              className="w-56"
            />
          </div>


          <Link
            href="/stock-assignment"
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Boxes className="w-4 h-4" />
            <span>Stock Assignment Matrix</span>
          </Link>

          <button
            type="button"
            onClick={handleExportStockExcel}
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Stock Excel</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE COLOR REPRESENTATION ANALYTICS CARDS (CLICK TO FILTER) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* 1. 🔴 Crossed Buffer Stock (Critical) */}
        <div
          onClick={() =>
            setSelectedStatusFilter(
              selectedStatusFilter === "crossed_buffer" ? "all" : "crossed_buffer"
            )
          }
          className={`p-4 rounded-[6px] border transition-all cursor-pointer select-none relative ${
            selectedStatusFilter === "crossed_buffer"
              ? "bg-red-50/90 border-red-500 ring-2 ring-red-500/20 shadow-xs"
              : "bg-white border-red-200/80 hover:border-red-400 hover:bg-red-50/30 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
              <p className="text-xs font-bold text-red-900">Crossed Buffer</p>
            </div>
            <span className="px-2 py-0.5 rounded-[4px] bg-red-100 text-red-800 text-[11px] font-extrabold">
              Critical
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black text-red-700">{stats.crossed}</p>
            <p className="text-[11px] text-red-600 font-semibold">
              {stats.total > 0
                ? `${Math.round((stats.crossed / stats.total) * 100)}% of items`
                : "0%"}
            </p>
          </div>

          <p className="text-[11px] text-red-600/80 mt-1">
            Stock is <strong>below</strong> buffer threshold. Urgent reorder required.
          </p>
        </div>

        {/* 2. 🟠 Reached Buffer Stock (Threshold) */}
        <div
          onClick={() =>
            setSelectedStatusFilter(
              selectedStatusFilter === "reached_buffer" ? "all" : "reached_buffer"
            )
          }
          className={`p-4 rounded-[6px] border transition-all cursor-pointer select-none relative ${
            selectedStatusFilter === "reached_buffer"
              ? "bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-xs"
              : "bg-white border-amber-200/80 hover:border-amber-400 hover:bg-amber-50/30 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <p className="text-xs font-bold text-amber-900">Reached Buffer</p>
            </div>
            <span className="px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-800 text-[11px] font-extrabold">
              Exact Limit
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black text-amber-700">{stats.reached}</p>
            <p className="text-[11px] text-amber-600 font-semibold">
              {stats.total > 0
                ? `${Math.round((stats.reached / stats.total) * 100)}% of items`
                : "0%"}
            </p>
          </div>

          <p className="text-[11px] text-amber-600/80 mt-1">
            Stock has reached <strong>exact minimum buffer limit</strong>.
          </p>
        </div>

        {/* 3. 🟡 Closer to Buffer Stock (Warning) */}
        <div
          onClick={() =>
            setSelectedStatusFilter(
              selectedStatusFilter === "closer_buffer" ? "all" : "closer_buffer"
            )
          }
          className={`p-4 rounded-[6px] border transition-all cursor-pointer select-none relative ${
            selectedStatusFilter === "closer_buffer"
              ? "bg-yellow-50/90 border-yellow-500 ring-2 ring-yellow-500/20 shadow-xs"
              : "bg-white border-yellow-200/80 hover:border-yellow-400 hover:bg-yellow-50/30 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
              <p className="text-xs font-bold text-yellow-900">Closer to Buffer</p>
            </div>
            <span className="px-2 py-0.5 rounded-[4px] bg-yellow-100 text-yellow-800 text-[11px] font-extrabold">
              Warning
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black text-yellow-700">{stats.closer}</p>
            <p className="text-[11px] text-yellow-600 font-semibold">
              {stats.total > 0
                ? `${Math.round((stats.closer / stats.total) * 100)}% of items`
                : "0%"}
            </p>
          </div>

          <p className="text-[11px] text-yellow-700/80 mt-1">
            Stock is <strong>approaching</strong> the buffer threshold soon.
          </p>
        </div>

        {/* 4. 🟢 Good Stock (Healthy) */}
        <div
          onClick={() =>
            setSelectedStatusFilter(
              selectedStatusFilter === "good_stock" ? "all" : "good_stock"
            )
          }
          className={`p-4 rounded-[6px] border transition-all cursor-pointer select-none relative ${
            selectedStatusFilter === "good_stock"
              ? "bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
              : "bg-white border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-bold text-emerald-900">Good Stock</p>
            </div>
            <span className="px-2 py-0.5 rounded-[4px] bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
              Healthy
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-black text-emerald-700">{stats.good}</p>
            <p className="text-[11px] text-emerald-600 font-semibold">
              {stats.total > 0
                ? `${Math.round((stats.good / stats.total) * 100)}% of items`
                : "0%"}
            </p>
          </div>

          <p className="text-[11px] text-emerald-600/80 mt-1">
            Adequate units available above buffer margin.
          </p>
        </div>
      </div>

      {/* Inventory Valuation Bar with Current Branch Context */}
      <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Store className="w-4 h-4 text-blue-600" />
            <span className="text-slate-400 font-normal">Active Scope: </span>
            <span className="font-extrabold text-blue-700">
              {selectedBranchName}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-normal">Total Stock Units: </span>
            <span className="font-extrabold text-slate-900 font-mono">
              {stats.totalStockUnits.toLocaleString()} units
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-normal">Inventory Valuation: </span>
            <span className="font-extrabold text-emerald-700 font-mono">
              ₹ {stats.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {selectedStatusFilter !== "all" && (
          <button
            type="button"
            onClick={() => setSelectedStatusFilter("all")}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear status filter (Showing {filteredProducts.length} of {stats.total})</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MAIN STOCK LIST TABLE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col relative z-10">
        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-30">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, barcode, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
            {/* Category CustomSelect */}
            <CustomSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={categories.map((c) => ({ value: c, label: c }))}
              searchable={true}
              align="right"
              className="w-44"
            />

            {/* Status CustomSelect */}
            <CustomSelect
              value={selectedStatusFilter}
              onChange={(val) => setSelectedStatusFilter(val as any)}
              options={[
                { value: "all", label: "All Health Statuses" },
                { value: "crossed_buffer", label: "🔴 Crossed Buffer" },
                { value: "reached_buffer", label: "🟠 Reached Buffer" },
                { value: "closer_buffer", label: "🟡 Closer to Buffer" },
                { value: "good_stock", label: "🟢 Good Stock" },
              ]}
              align="right"
              className="w-48"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-b-[6px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Analyzing stock levels from Firestore...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Layers className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No products match current filter</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {selectedStatusFilter !== "all"
                  ? `No items are currently in "${selectedStatusFilter.replace("_", " ")}" status.`
                  : "Try adjusting your search query or category filter."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">
                    {selectedBranchFilter === "all" ? "Total Stock" : "Branch Stock"}
                  </th>
                  <th className="py-3 px-4 text-center">Buffer Threshold</th>
                  <th className="py-3 px-4 text-center">Health Status</th>
                  {selectedBranchFilter === "all" && (
                    <th className="py-3 px-4 text-center">Branch Breakdown</th>
                  )}
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Valuation</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        p.health === "crossed_buffer"
                          ? "bg-red-50/15"
                          : p.health === "reached_buffer"
                          ? "bg-amber-50/15"
                          : p.health === "closer_buffer"
                          ? "bg-yellow-50/10"
                          : ""
                      }`}
                    >
                      {/* Product Thumbnail & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 p-0.5 overflow-hidden">
                            <img
                              src={p.imageUrl || "/logo.png"}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/logo.png";
                              }}
                            />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs line-clamp-1">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {p.barcode || "No Barcode"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {p.category}
                      </td>

                      {/* Current / Branch Stock */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center font-extrabold text-sm font-mono px-2.5 py-0.5 rounded-[4px] ${
                            p.health === "crossed_buffer"
                              ? "bg-red-100 text-red-700"
                              : p.health === "reached_buffer"
                              ? "bg-amber-100 text-amber-800"
                              : p.health === "closer_buffer"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {Number(p.effectiveStock).toFixed(3)} KG
                        </span>
                      </td>

                      {/* Buffer Threshold */}
                      <td className="py-3 px-4 text-center font-mono text-slate-600 font-bold">
                        {p.bufferStock} KG
                      </td>

                      {/* Buffer Status & Color Badge */}
                      <td className="py-3 px-4 text-center">
                        {p.health === "crossed_buffer" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                            <span>Crossed Buffer</span>
                          </span>
                        )}
                        {p.health === "reached_buffer" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>At Buffer Limit</span>
                          </span>
                        )}
                        {p.health === "closer_buffer" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-yellow-100 text-yellow-800 border border-yellow-300">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            <span>Closer to Buffer</span>
                          </span>
                        )}
                        {p.health === "good_stock" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Good Stock</span>
                          </span>
                        )}
                      </td>

                      {/* Branch Breakdown (in Consolidated View) */}
                      {selectedBranchFilter === "all" && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap max-w-[200px] mx-auto">
                            {p.branchBreakdown.map((b) => (
                              <span
                                key={b.branchId}
                                title={`${b.branchName}: ${b.qty} units`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700"
                              >
                                <span className="text-slate-400 font-sans truncate max-w-[55px]">
                                  {b.branchName.slice(0, 6)}:
                                </span>
                                <span className="font-bold text-blue-700">{b.qty}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      )}

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right font-medium text-slate-600 text-xs">
                        ₹ {p.price.toFixed(2)}
                      </td>

                      {/* Total Valuation */}
                      <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-xs font-mono">
                        ₹ {p.stockValuation.toFixed(2)}
                      </td>

                      {/* Quick Adjust Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openAdjustModal(p)}
                          className="h-[30px] px-2.5 inline-flex items-center gap-1 rounded-[5px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Adjust</span>
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
      {/* QUICK STOCK ADJUST MODAL */}
      {/* ========================================================================= */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Adjust Product Stock</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-xs">{adjustingProduct.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStockAdjustment} className="p-5 space-y-4 text-xs">
              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Target Store Branch <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={adjustBranchId}
                  onChange={(val) => setAdjustBranchId(val)}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: b.name,
                  }))}
                  searchable={true}
                  className="w-full"
                />
              </div>

              {/* Product Info Banner */}
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-semibold">Branch Stock</p>
                  <p className="text-xl font-extrabold text-slate-900 font-mono">
                    {branchStockMap[`${adjustingProduct.id}_${adjustBranchId}`] || 0} units
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 font-semibold">Buffer Threshold</p>
                  <p className="text-xl font-extrabold text-blue-600 font-mono">
                    {adjustingProduct.bufferStock} units
                  </p>
                </div>
              </div>

              {/* Adjustment Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Adjustment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("add")}
                    className={`h-[36px] rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                      adjustmentType === "add"
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    + Add to Branch Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("set")}
                    className={`h-[36px] rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                      adjustmentType === "set"
                        ? "bg-blue-50 border-blue-500 text-blue-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    = Set Exact Branch Stock
                  </button>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {adjustmentType === "add" ? "Quantity to Add (Restock)" : "New Branch Stock Count"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={adjustmentType === "set" ? "0" : undefined}
                  required
                  placeholder={adjustmentType === "add" ? "e.g. 25" : "e.g. 50"}
                  value={adjustQty}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) => setAdjustQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              {/* Buffer Threshold Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Buffer Stock Threshold (Alert Limit)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={adjustBufferQty}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) => setAdjustBufferQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStock}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStock ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Branch Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
