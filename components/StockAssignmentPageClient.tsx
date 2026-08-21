"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";
import {
  Boxes,
  Search,
  Store,
  FileSpreadsheet,
  RefreshCw,
  Check,
  Save,
  Package,
  Edit2,
  Undo2,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  barcode: string;
  price: number;
  bufferStock: number;
  imageUrl?: string;
}

export default function StockAssignmentPageClient() {
  const toast = useToast();

  // Firestore Data State
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  // Mapping of `${productId}_${branchId}` -> quantity in Firestore
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  // Local pending edits: `${productId}_${branchId}` -> quantity
  const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({});

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Edit Mode state
  const [isAllEditMode, setIsAllEditMode] = useState(false);
  const [editingRowIds, setEditingRowIds] = useState<Set<string>>(new Set());

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [categories, setCategories] = useState<string[]>(["All Categories"]);

  // Quick Distribute Modal State
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [selectedProductForDistribute, setSelectedProductForDistribute] = useState<ProductRow | null>(null);
  const [distributeBranchQuantities, setDistributeBranchQuantities] = useState<Record<string, number | "">>({});

  // 1. Real-time Firestore Sync for Products & Categories
  useEffect(() => {
    setLoading(true);
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const pList: ProductRow[] = [];
      const catSet = new Set<string>();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status !== "inactive") {
          const cat = d.category || "General";
          catSet.add(cat);
          pList.push({
            id: docSnap.id,
            name: d.name || "Unnamed Product",
            category: cat,
            barcode: d.barcode || "",
            price: Number(d.price) || 0,
            bufferStock: Number(d.bufferStock) > 0 ? Number(d.bufferStock) : 5,
            imageUrl: d.imageUrl || "/logo.png",
          });
        }
      });

      pList.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(pList);
      setCategories(["All Categories", ...Array.from(catSet)]);
      setLoading(false);
    });

    return () => unsubProducts();
  }, []);

  // 2. Real-time Firestore Sync for Branches
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

  // 3. Real-time Firestore Sync for Branch Stocks
  useEffect(() => {
    const unsubStock = onSnapshot(collection(db, "branch_stocks"), (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.productId && d.branchId) {
          const key = `${d.productId}_${d.branchId}`;
          map[key] = Number(d.quantity) || 0;
        }
      });
      setStockMap(map);
    });

    return () => unsubStock();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (selectedCategory !== "All Categories" && p.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  // Helper to get current quantity of a product in a branch
  const getBranchQty = (productId: string, branchId: string): number => {
    const key = `${productId}_${branchId}`;
    if (pendingEdits[key] !== undefined) {
      return pendingEdits[key];
    }
    return stockMap[key] || 0;
  };

  // Helper to check if a single product row has pending changes
  const hasRowPendingEdits = (productId: string): boolean => {
    return branches.some((b) => pendingEdits[`${productId}_${b.id}`] !== undefined);
  };

  // Helper to get total stock across all branches for a product
  const getProductTotalStock = (productId: string): number => {
    return branches.reduce((sum, b) => sum + getBranchQty(productId, b.id), 0);
  };

  // Check if a row is editable
  const isRowEditable = (productId: string): boolean => {
    return isAllEditMode || editingRowIds.has(productId) || hasRowPendingEdits(productId);
  };

  // Toggle single row edit mode
  const toggleRowEdit = (productId: string) => {
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Handle inline cell change
  const handleCellChange = (productId: string, branchId: string, val: string) => {
    const key = `${productId}_${branchId}`;
    const num = val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0);
    setPendingEdits((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  // Discard pending edits for a single row
  const handleDiscardRowEdits = (productId: string) => {
    setPendingEdits((prev) => {
      const updated = { ...prev };
      branches.forEach((b) => {
        delete updated[`${productId}_${b.id}`];
      });
      return updated;
    });
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  };

  // Save changes for a single individual row
  const handleSaveSingleRow = async (prod: ProductRow) => {
    setSavingRowId(prod.id);
    try {
      const batch = writeBatch(db);
      let newTotal = 0;

      branches.forEach((b) => {
        const key = `${prod.id}_${b.id}`;
        const qty = pendingEdits[key] !== undefined ? pendingEdits[key] : (stockMap[key] || 0);
        newTotal += qty;

        const docRef = doc(db, "branch_stocks", key);
        batch.set(
          docRef,
          {
            productId: prod.id,
            productName: prod.name,
            branchId: b.id,
            branchName: b.name,
            quantity: qty,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      // Update product total stock
      await updateDoc(doc(db, "products", prod.id), {
        stock: newTotal,
        updatedAt: serverTimestamp(),
      });

      // Clear pending edits for this row
      setPendingEdits((prev) => {
        const updated = { ...prev };
        branches.forEach((b) => {
          delete updated[`${prod.id}_${b.id}`];
        });
        return updated;
      });

      setEditingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(prod.id);
        return next;
      });

      toast.success(`Saved stock assignments for "${prod.name}" (${newTotal} units total)`);
    } catch (err: any) {
      console.error("Save row error:", err);
      toast.error("Failed to save row: " + err.message);
    } finally {
      setSavingRowId(null);
    }
  };

  // Save ALL pending changes at once across all rows (Batch Write)
  const handleSaveAllChanges = async () => {
    const keys = Object.keys(pendingEdits);
    if (keys.length === 0) {
      toast.info("No stock assignment changes to save.");
      return;
    }

    setIsSavingAll(true);
    try {
      const batch = writeBatch(db);
      const affectedProductIds = new Set<string>();

      keys.forEach((key) => {
        const [productId, branchId] = key.split("_");
        const quantity = pendingEdits[key];
        const docRef = doc(db, "branch_stocks", key);
        const branchObj = branches.find((b) => b.id === branchId);
        const prodObj = products.find((p) => p.id === productId);

        batch.set(
          docRef,
          {
            productId,
            productName: prodObj?.name || "",
            branchId,
            branchName: branchObj?.name || "",
            quantity,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        affectedProductIds.add(productId);
      });

      await batch.commit();

      // Update product total stock for affected products
      for (const prodId of Array.from(affectedProductIds)) {
        const total = branches.reduce((sum, b) => {
          const k = `${prodId}_${b.id}`;
          return sum + (pendingEdits[k] !== undefined ? pendingEdits[k] : (stockMap[k] || 0));
        }, 0);

        try {
          await updateDoc(doc(db, "products", prodId), {
            stock: total,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("Product total sync warning:", err);
        }
      }

      setPendingEdits({});
      setEditingRowIds(new Set());
      setIsAllEditMode(false);
      toast.success(`Successfully saved all stock assignments for ${affectedProductIds.size} product(s)!`);
    } catch (err: any) {
      console.error("Save all error:", err);
      toast.error("Failed to save stock assignments: " + err.message);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Open Quick Distribute Modal
  const openDistributeModal = (prod: ProductRow) => {
    setSelectedProductForDistribute(prod);
    const initialBranchQtys: Record<string, number | ""> = {};
    branches.forEach((b) => {
      initialBranchQtys[b.id] = getBranchQty(prod.id, b.id);
    });
    setDistributeBranchQuantities(initialBranchQtys);
    setIsDistributeModalOpen(true);
  };

  // Save single product distribution from modal
  const handleSaveDistributeModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForDistribute) return;

    setSavingRowId(selectedProductForDistribute.id);
    try {
      const batch = writeBatch(db);
      let newTotal = 0;

      branches.forEach((b) => {
        const qty = Number(distributeBranchQuantities[b.id]) || 0;
        newTotal += qty;
        const key = `${selectedProductForDistribute.id}_${b.id}`;
        const docRef = doc(db, "branch_stocks", key);

        batch.set(
          docRef,
          {
            productId: selectedProductForDistribute.id,
            productName: selectedProductForDistribute.name,
            branchId: b.id,
            branchName: b.name,
            quantity: qty,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      // Update product total stock
      await updateDoc(doc(db, "products", selectedProductForDistribute.id), {
        stock: newTotal,
        updatedAt: serverTimestamp(),
      });

      // Clear any pending edits for this product
      setPendingEdits((prev) => {
        const updated = { ...prev };
        branches.forEach((b) => {
          delete updated[`${selectedProductForDistribute.id}_${b.id}`];
        });
        return updated;
      });

      toast.success(`Updated stock assignments for "${selectedProductForDistribute.name}"`);
      setIsDistributeModalOpen(false);
    } catch (err: any) {
      console.error("Distribute save error:", err);
      toast.error("Failed to save branch distribution: " + err.message);
    } finally {
      setSavingRowId(null);
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalItems = products.length;
    let totalAssignedUnits = 0;
    let totalValuation = 0;

    products.forEach((p) => {
      const qty = getProductTotalStock(p.id);
      totalAssignedUnits += qty;
      totalValuation += qty * p.price;
    });

    const pendingKeys = Object.keys(pendingEdits);
    const affectedProductsCount = new Set(pendingKeys.map((k) => k.split("_")[0])).size;

    return {
      totalItems,
      totalAssignedUnits,
      totalValuation,
      totalBranches: branches.length,
      pendingCount: pendingKeys.length,
      affectedProductsCount,
    };
  }, [products, branches, stockMap, pendingEdits]);

  // Export Matrix to Excel
  const handleExportExcel = () => {
    if (filteredProducts.length === 0) {
      toast.warning("No products to export");
      return;
    }

    const data = filteredProducts.map((prod, idx) => {
      const row: Record<string, any> = {
        "SL No": idx + 1,
        "Product Name": prod.name,
        "Barcode ID": prod.barcode || "—",
        Category: prod.category,
        "Buffer Stock": prod.bufferStock,
        "Price (₹)": prod.price,
      };

      // Add each branch column
      branches.forEach((b) => {
        row[b.name] = getBranchQty(prod.id, b.id);
      });

      row["Total Stock"] = getProductTotalStock(prod.id);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock_Assignments");
    XLSX.writeFile(workbook, `stock_assignment_matrix_${Date.now()}.xlsx`);
    toast.success(`Exported stock assignment matrix to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Stock Assignment
            </h1>
            {metrics.pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold animate-pulse flex items-center gap-1 border border-amber-300">
                <span>{metrics.affectedProductsCount} item(s) modified</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign and edit physical stock branch-by-branch with individual row save or all-at-once batch save.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Edit All Toggle */}
          <button
            type="button"
            onClick={() => setIsAllEditMode((prev) => !prev)}
            className={`h-[36px] px-3.5 flex items-center gap-1.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer border ${
              isAllEditMode
                ? "bg-blue-50 text-blue-700 border-blue-400 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>{isAllEditMode ? "Exit Edit All Mode" : "Edit All at a Time"}</span>
          </button>

          {/* Save All Button (Active when changes exist) */}
          {metrics.pendingCount > 0 && (
            <button
              type="button"
              onClick={handleSaveAllChanges}
              disabled={isSavingAll}
              className="h-[36px] px-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSavingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save All at a Time ({metrics.pendingCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Matrix</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col relative z-10">
        {/* Search & Filter Bar */}
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
            <CustomSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={categories.map((c) => ({ value: c, label: c }))}
              searchable={true}
              align="right"
              className="w-48"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto rounded-b-[6px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading stock assignments from Firestore...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Store className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No active store branches found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Please create your store branches in the Branches page first before allocating stock.
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Package className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No products found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Try adjusting your search query or category filter.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">#</th>
                  {/* Single Clean Product Column */}
                  <th className="py-3.5 px-4 min-w-[280px]">Product Information</th>

                  {/* Dynamic Branch Columns */}
                  {branches.map((b) => (
                    <th
                      key={b.id}
                      className="py-3.5 px-4 text-center min-w-[130px] bg-blue-50/40 border-l border-r border-blue-100/60"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-blue-900 font-bold truncate max-w-[120px]">
                          {b.name}
                        </span>
                        <span className="text-[10px] text-blue-600 font-normal font-mono">
                          (Qty in Units)
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="py-3.5 px-4 text-center min-w-[120px] bg-slate-100/70 font-bold text-slate-900">
                    Total Stock
                  </th>
                  <th className="py-3.5 px-4 text-center min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod, idx) => {
                  const totalAssigned = getProductTotalStock(prod.id);
                  const isLowBuffer = totalAssigned <= prod.bufferStock;
                  const isDirty = hasRowPendingEdits(prod.id);
                  const isEditing = isRowEditable(prod.id);
                  const isSavingThisRow = savingRowId === prod.id;

                  return (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        isDirty
                          ? "bg-amber-50/30 hover:bg-amber-50/50"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* SL No */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Product Name & Subtext (Barcode ID | Category | Buffer Stock) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[4px] bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                            <img
                              src={prod.imageUrl || "/logo.png"}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/logo.png";
                              }}
                            />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            {/* Product Name */}
                            <p className="font-bold text-slate-900 text-xs truncate max-w-[260px] leading-snug">
                              {prod.name}
                            </p>

                            {/* Subtitle: Barcode ID | Category | Buffer Stock */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                              <span className="font-mono text-slate-600 font-medium">
                                {prod.barcode || "No Barcode"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-medium text-slate-700">
                                {prod.category}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-bold text-blue-700 font-mono">
                                Buffer: {prod.bufferStock} units
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-800 font-semibold">
                                ₹{prod.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Dynamic Branch Quantity Inputs */}
                      {branches.map((b) => {
                        const key = `${prod.id}_${b.id}`;
                        const currentVal = getBranchQty(prod.id, b.id);
                        const isEdited = pendingEdits[key] !== undefined;

                        return (
                          <td
                            key={b.id}
                            className="py-2.5 px-3 text-center border-l border-r border-blue-50/70"
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                value={currentVal === 0 && !isEdited ? "" : currentVal}
                                placeholder="0"
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                onChange={(e) => handleCellChange(prod.id, b.id, e.target.value)}
                                className={`w-20 h-[34px] px-2 text-center text-xs font-bold font-mono rounded-[5px] border transition-all ${
                                  isEdited
                                    ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300"
                                    : isEditing
                                    ? "bg-white border-blue-400 text-slate-900 ring-1 ring-blue-300"
                                    : "bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                }`}
                              />
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Assigned */}
                      <td className="py-3.5 px-4 text-center bg-slate-50/40">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-extrabold text-xs font-mono border ${
                            isLowBuffer
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}
                        >
                          {totalAssigned} units
                        </span>
                      </td>

                      {/* Actions: Individual Save / Edit / Distribute */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isDirty ? (
                            <>
                              {/* Individual Row Save */}
                              <button
                                type="button"
                                onClick={() => handleSaveSingleRow(prod)}
                                disabled={isSavingThisRow}
                                title="Save this row"
                                className="h-[30px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[5px] text-[11px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSavingThisRow ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Save</span>
                              </button>

                              {/* Undo Row */}
                              <button
                                type="button"
                                onClick={() => handleDiscardRowEdits(prod.id)}
                                title="Undo row changes"
                                className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Individual Row Edit Toggle */}
                              <button
                                type="button"
                                onClick={() => toggleRowEdit(prod.id)}
                                title={isEditing ? "Done editing" : "Edit row"}
                                className={`h-[30px] px-2.5 rounded-[5px] text-[11px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 border ${
                                  isEditing
                                    ? "bg-blue-50 text-blue-700 border-blue-300"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                }`}
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>{isEditing ? "Done" : "Edit"}</span>
                              </button>

                              {/* Distribute Modal */}
                              <button
                                type="button"
                                onClick={() => openDistributeModal(prod)}
                                title="Distribute modal"
                                className="h-[30px] px-2.5 bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-200 rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer"
                              >
                                Distribute
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info & Save Bar */}
        {filteredProducts.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                Showing {filteredProducts.length} products
              </span>
              <span>across {branches.length} store branches.</span>
            </div>

            {metrics.pendingCount > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-amber-700 font-bold text-xs">
                  {metrics.affectedProductsCount} item(s) modified
                </span>
                <button
                  type="button"
                  onClick={handleSaveAllChanges}
                  disabled={isSavingAll}
                  className="h-[34px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingAll ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save All Changes ({metrics.pendingCount})</span>
                </button>
              </div>
            ) : (
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>All branch stock assignments are up to date.</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUICK DISTRIBUTE MODAL */}
      {/* ========================================================================= */}
      {isDistributeModalOpen && selectedProductForDistribute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Distribute Product Stock
                  </h3>
                  <p className="text-[11px] font-bold text-blue-700">
                    {selectedProductForDistribute.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDistributeModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDistributeModal} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-slate-500 font-medium">Category</p>
                  <p className="font-bold text-slate-900">{selectedProductForDistribute.category}</p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Barcode</p>
                  <p className="font-bold text-slate-900 font-mono">
                    {selectedProductForDistribute.barcode || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Buffer Limit</p>
                  <p className="font-bold text-blue-700 font-mono">
                    {selectedProductForDistribute.bufferStock} units
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Assign Quantities per Branch:
                </label>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {branches.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{b.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="0"
                          value={distributeBranchQuantities[b.id] ?? ""}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          onChange={(e) =>
                            setDistributeBranchQuantities((prev) => ({
                              ...prev,
                              [b.id]: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                          className="w-24 h-[34px] px-3 bg-white border border-slate-300 rounded-[5px] text-xs font-bold font-mono text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-slate-500 text-[11px]">units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-[6px] flex items-center justify-between">
                <span className="font-bold text-blue-900">Total Allocated Stock:</span>
                <span className="font-extrabold text-sm text-blue-700 font-mono">
                  {branches.reduce(
                    (sum, b) => sum + (Number(distributeBranchQuantities[b.id]) || 0),
                    0
                  )}{" "}
                  units
                </span>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDistributeModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRowId !== null}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingRowId !== null ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Distribution</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
