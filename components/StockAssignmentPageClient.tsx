"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
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
  Plus,
  Minus,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/AuthContext";
import CustomSelect from "@/components/CustomSelect";

export type UnitType = "kg" | "halfKg" | "fms";

export const UNIT_LABELS: Record<UnitType, string> = {
  kg: "1 KG",
  halfKg: "1/2 KG",
  fms: "FMS",
};

interface ProductRow {
  id: string;
  name: string;
  category: string;
  barcode: string;
  price: number;
  bufferStock: number;
  imageUrl?: string;
}

interface BranchStockData {
  kg: number;
  halfKg: number;
  fms: number;
}

interface AdjustModalState {
  isOpen: boolean;
  product: ProductRow | null;
  branch: Branch | null;
  unit: UnitType;
  action: "add" | "decrease";
  currentQty: number;
  inputQty: number | "";
  isSubmitting: boolean;
}

export default function StockAssignmentPageClient() {
  const toast = useToast();
  const { user } = useAuth();

  // Firestore Data State
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Filter branches strictly by user role & staff branchIds
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") {
      return branches;
    }
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  // Mapping of `${productId}_${branchId}` -> { kg, halfKg, fms }
  const [stockMap, setStockMap] = useState<Record<string, BranchStockData>>({});

  // Local pending edits: `${productId}_${branchId}_${unit}` -> quantity
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
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Plus / Minus Adjust Modal State
  const [adjustModal, setAdjustModal] = useState<AdjustModalState>({
    isOpen: false,
    product: null,
    branch: null,
    unit: "kg",
    action: "add",
    currentQty: 0,
    inputQty: 1,
    isSubmitting: false,
  });

  // Quick Distribute Modal State
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [selectedProductForDistribute, setSelectedProductForDistribute] = useState<ProductRow | null>(null);
  const [distributeBranchQuantities, setDistributeBranchQuantities] = useState<
    Record<string, { kg: number | ""; halfKg: number | ""; fms: number | "" }>
  >({});

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

  // 3. Real-time Firestore Sync for Branch Stocks (KG, 1/2KG, FMS)
  useEffect(() => {
    const unsubStock = onSnapshot(collection(db, "branch_stocks"), (snapshot) => {
      const map: Record<string, BranchStockData> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.productId && d.branchId) {
          const key = `${d.productId}_${d.branchId}`;
          const kg = d.kg !== undefined ? Number(d.kg) : (Number(d.quantity) || 0);
          const halfKg = Number(d.halfKg) || 0;
          const fms = Number(d.fms) || 0;
          map[key] = { kg, halfKg, fms };
        }
      });
      setStockMap(map);
    });

    return () => unsubStock();
  }, []);

  // Branches to render based on filter
  const displayedBranches = useMemo(() => {
    if (selectedBranchFilter === "all") {
      return availableBranches;
    }
    return availableBranches.filter((b) => b.id === selectedBranchFilter);
  }, [availableBranches, selectedBranchFilter]);

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

  // Helper to get unit quantity for a product in a branch (KG / 1/2KG / FMS)
  const getBranchUnitQty = (
    productId: string,
    branchId: string,
    unit: UnitType
  ): number => {
    const editKey = `${productId}_${branchId}_${unit}`;
    if (pendingEdits[editKey] !== undefined) {
      return pendingEdits[editKey];
    }
    const branchData = stockMap[`${productId}_${branchId}`];
    if (!branchData) return 0;
    return branchData[unit] || 0;
  };

  // Helper to get total unit sum for a branch (KG + 1/2KG + FMS)
  const getBranchCombinedQty = (productId: string, branchId: string): number => {
    return (
      getBranchUnitQty(productId, branchId, "kg") +
      getBranchUnitQty(productId, branchId, "halfKg") +
      getBranchUnitQty(productId, branchId, "fms")
    );
  };

  // Helper to check if a row has pending edits
  const hasRowPendingEdits = (productId: string): boolean => {
    return availableBranches.some(
      (b) =>
        pendingEdits[`${productId}_${b.id}_kg`] !== undefined ||
        pendingEdits[`${productId}_${b.id}_halfKg`] !== undefined ||
        pendingEdits[`${productId}_${b.id}_fms`] !== undefined
    );
  };

  // Helper to get total stock for a product across all available branches
  const getProductTotalUnit = (productId: string, unit?: UnitType): number => {
    return availableBranches.reduce((sum, b) => {
      if (unit) {
        return sum + getBranchUnitQty(productId, b.id, unit);
      }
      return sum + getBranchCombinedQty(productId, b.id);
    }, 0);
  };

  // Inline cell edit handler
  const handleCellChange = (
    productId: string,
    branchId: string,
    unit: UnitType,
    val: string
  ) => {
    const key = `${productId}_${branchId}_${unit}`;
    const num = val === "" ? 0 : Math.max(0, parseFloat(val) || 0);
    setPendingEdits((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  // Discard pending edits for a single row
  const handleDiscardRowEdits = (productId: string) => {
    setPendingEdits((prev) => {
      const updated = { ...prev };
      availableBranches.forEach((b) => {
        delete updated[`${productId}_${b.id}_kg`];
        delete updated[`${productId}_${b.id}_halfKg`];
        delete updated[`${productId}_${b.id}_fms`];
      });
      return updated;
    });
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
  };

  // Save changes for a single row
  const handleSaveSingleRow = async (prod: ProductRow) => {
    setSavingRowId(prod.id);
    try {
      const batch = writeBatch(db);
      let newTotalCount = 0;

      availableBranches.forEach((b) => {
        const kg = getBranchUnitQty(prod.id, b.id, "kg");
        const halfKg = getBranchUnitQty(prod.id, b.id, "halfKg");
        const fms = getBranchUnitQty(prod.id, b.id, "fms");
        const branchTotal = kg + halfKg + fms;
        newTotalCount += branchTotal;

        const docRef = doc(db, "branch_stocks", `${prod.id}_${b.id}`);
        batch.set(
          docRef,
          {
            productId: prod.id,
            productName: prod.name,
            branchId: b.id,
            branchName: b.name,
            kg,
            halfKg,
            fms,
            quantity: branchTotal,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      // Update product total stock
      await updateDoc(doc(db, "products", prod.id), {
        stock: newTotalCount,
        updatedAt: serverTimestamp(),
      });

      // Clear pending edits for this row
      setPendingEdits((prev) => {
        const updated = { ...prev };
        availableBranches.forEach((b) => {
          delete updated[`${prod.id}_${b.id}_kg`];
          delete updated[`${prod.id}_${b.id}_halfKg`];
          delete updated[`${prod.id}_${b.id}_fms`];
        });
        return updated;
      });

      setEditingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(prod.id);
        return next;
      });

      toast.success(`Saved stock assignments for "${prod.name}" (${newTotalCount} total count)`);
    } catch (err: any) {
      console.error("Save row error:", err);
      toast.error("Failed to save row: " + err.message);
    } finally {
      setSavingRowId(null);
    }
  };

  // Save ALL pending changes at once across all rows
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

      // Group edits by product and branch
      const branchProductMap: Record<string, { productId: string; branchId: string }> = {};

      keys.forEach((key) => {
        const parts = key.split("_");
        // Format: productId_branchId_unit
        const unit = parts.pop() as UnitType;
        const branchId = parts.pop()!;
        const productId = parts.join("_");

        const pairKey = `${productId}_${branchId}`;
        branchProductMap[pairKey] = { productId, branchId };
        affectedProductIds.add(productId);
      });

      Object.values(branchProductMap).forEach(({ productId, branchId }) => {
        const docRef = doc(db, "branch_stocks", `${productId}_${branchId}`);
        const branchObj = branches.find((b) => b.id === branchId);
        const prodObj = products.find((p) => p.id === productId);

        const kg = getBranchUnitQty(productId, branchId, "kg");
        const halfKg = getBranchUnitQty(productId, branchId, "halfKg");
        const fms = getBranchUnitQty(productId, branchId, "fms");
        const branchTotal = kg + halfKg + fms;

        batch.set(
          docRef,
          {
            productId,
            productName: prodObj?.name || "",
            branchId,
            branchName: branchObj?.name || "",
            kg,
            halfKg,
            fms,
            quantity: branchTotal,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      // Update product total stock for affected products
      for (const prodId of Array.from(affectedProductIds)) {
        const total = branches.reduce((sum, b) => {
          return (
            sum +
            getBranchUnitQty(prodId, b.id, "kg") +
            getBranchUnitQty(prodId, b.id, "halfKg") +
            getBranchUnitQty(prodId, b.id, "fms")
          );
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
      toast.success(
        `Successfully saved all stock assignments for ${affectedProductIds.size} product(s)!`
      );
    } catch (err: any) {
      console.error("Save all error:", err);
      toast.error("Failed to save stock assignments: " + err.message);
    } finally {
      setIsSavingAll(false);
    }
  };

  // Open Plus/Minus Adjust Modal
  const openAdjustModal = (
    prod: ProductRow,
    branch: Branch,
    unit: UnitType,
    action: "add" | "decrease"
  ) => {
    const currentQty = getBranchUnitQty(prod.id, branch.id, unit);
    setAdjustModal({
      isOpen: true,
      product: prod,
      branch,
      unit,
      action,
      currentQty,
      inputQty: 1,
      isSubmitting: false,
    });
  };

  // Submit Plus/Minus Adjust Modal
  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.product || !adjustModal.branch) return;

    const count = typeof adjustModal.inputQty === "number" ? adjustModal.inputQty : 0;
    if (count <= 0) {
      toast.warning("Please enter a valid count greater than 0");
      return;
    }

    const { product, branch, unit, action, currentQty } = adjustModal;
    const newQty =
      action === "add"
        ? currentQty + count
        : Math.max(0, currentQty - count);

    setAdjustModal((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const pairKey = `${product.id}_${branch.id}`;
      const docRef = doc(db, "branch_stocks", pairKey);

      // Get current values for the other two units
      const currentKg = unit === "kg" ? newQty : getBranchUnitQty(product.id, branch.id, "kg");
      const currentHalfKg =
        unit === "halfKg" ? newQty : getBranchUnitQty(product.id, branch.id, "halfKg");
      const currentFms = unit === "fms" ? newQty : getBranchUnitQty(product.id, branch.id, "fms");
      const branchTotal = currentKg + currentHalfKg + currentFms;

      await setDoc(
        docRef,
        {
          productId: product.id,
          productName: product.name,
          branchId: branch.id,
          branchName: branch.name,
          kg: currentKg,
          halfKg: currentHalfKg,
          fms: currentFms,
          quantity: branchTotal,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Clear any pending edit on this cell
      setPendingEdits((prev) => {
        const next = { ...prev };
        delete next[`${product.id}_${branch.id}_${unit}`];
        return next;
      });

      // Update total product stock
      const overallTotal = branches.reduce((sum, b) => {
        if (b.id === branch.id) {
          return sum + branchTotal;
        }
        return (
          sum +
          getBranchUnitQty(product.id, b.id, "kg") +
          getBranchUnitQty(product.id, b.id, "halfKg") +
          getBranchUnitQty(product.id, b.id, "fms")
        );
      }, 0);

      await updateDoc(doc(db, "products", product.id), {
        stock: overallTotal,
        updatedAt: serverTimestamp(),
      });

      const actionText = action === "add" ? "Added" : "Decreased";
      toast.success(
        `${actionText} ${count} ${UNIT_LABELS[unit]} ${
          action === "add" ? "to" : "from"
        } "${product.name}" at ${branch.name}. (New count: ${newQty})`
      );

      setAdjustModal((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
    } catch (err: any) {
      console.error("Stock adjust error:", err);
      toast.error("Failed to update stock: " + err.message);
      setAdjustModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Open Quick Distribute Modal
  const openDistributeModal = (prod: ProductRow) => {
    setSelectedProductForDistribute(prod);
    const initialBranchQtys: Record<
      string,
      { kg: number | ""; halfKg: number | ""; fms: number | "" }
    > = {};
    availableBranches.forEach((b) => {
      initialBranchQtys[b.id] = {
        kg: getBranchUnitQty(prod.id, b.id, "kg"),
        halfKg: getBranchUnitQty(prod.id, b.id, "halfKg"),
        fms: getBranchUnitQty(prod.id, b.id, "fms"),
      };
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

      availableBranches.forEach((b) => {
        const itemData = distributeBranchQuantities[b.id] || { kg: 0, halfKg: 0, fms: 0 };
        const kg = Number(itemData.kg) || 0;
        const halfKg = Number(itemData.halfKg) || 0;
        const fms = Number(itemData.fms) || 0;
        const branchTotal = kg + halfKg + fms;
        newTotal += branchTotal;

        const key = `${selectedProductForDistribute.id}_${b.id}`;
        const docRef = doc(db, "branch_stocks", key);

        batch.set(
          docRef,
          {
            productId: selectedProductForDistribute.id,
            productName: selectedProductForDistribute.name,
            branchId: b.id,
            branchName: b.name,
            kg,
            halfKg,
            fms,
            quantity: branchTotal,
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
          delete updated[`${selectedProductForDistribute.id}_${b.id}_kg`];
          delete updated[`${selectedProductForDistribute.id}_${b.id}_halfKg`];
          delete updated[`${selectedProductForDistribute.id}_${b.id}_fms`];
        });
        return updated;
      });

      toast.success(
        `Updated stock assignments for "${selectedProductForDistribute.name}" (${newTotal} total count)`
      );
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
    let totalKg = 0;
    let totalHalfKg = 0;
    let totalFms = 0;
    let totalUnits = 0;

    products.forEach((p) => {
      const kg = getProductTotalUnit(p.id, "kg");
      const halfKg = getProductTotalUnit(p.id, "halfKg");
      const fms = getProductTotalUnit(p.id, "fms");
      totalKg += kg;
      totalHalfKg += halfKg;
      totalFms += fms;
      totalUnits += kg + halfKg + fms;
    });

    const pendingKeys = Object.keys(pendingEdits);
    const affectedProductsCount = new Set(pendingKeys.map((k) => k.split("_")[0])).size;

    return {
      totalItems,
      totalKg,
      totalHalfKg,
      totalFms,
      totalUnits,
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

      // Add 3 columns per branch
      branches.forEach((b) => {
        row[`${b.name} - KG`] = getBranchUnitQty(prod.id, b.id, "kg");
        row[`${b.name} - 1/2KG`] = getBranchUnitQty(prod.id, b.id, "halfKg");
        row[`${b.name} - FMS`] = getBranchUnitQty(prod.id, b.id, "fms");
        row[`${b.name} - Total`] = getBranchCombinedQty(prod.id, b.id);
      });

      row["Overall Total KG"] = getProductTotalUnit(prod.id, "kg");
      row["Overall Total 1/2KG"] = getProductTotalUnit(prod.id, "halfKg");
      row["Overall Total FMS"] = getProductTotalUnit(prod.id, "fms");
      row["Grand Total Stock"] = getProductTotalUnit(prod.id);
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock_Assignments");
    XLSX.writeFile(workbook, `stock_assignment_matrix_${Date.now()}.xlsx`);
    toast.success(`Exported stock assignment matrix to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1800px] mx-auto space-y-4">
      {/* Top Header */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-5 h-5 text-blue-600" />
              <span>Stock Assignment</span>
            </h1>
            {metrics.pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold animate-pulse flex items-center gap-1 border border-amber-300">
                <span>{metrics.affectedProductsCount} item(s) modified</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manual stock management with 3 unit columns (<strong>KG</strong>, <strong>1/2 KG</strong>, <strong>FMS</strong>). Click <strong>+</strong> or <strong>-</strong> to adjust count, or edit directly in the box.
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
            <span>{isAllEditMode ? "Exit Edit All Mode" : "Edit All Cells"}</span>
          </button>

          {/* Save All Button */}
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
              <span>Save All Changes ({metrics.pendingCount})</span>
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

      {/* Quick Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Items</p>
            <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{metrics.totalItems}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <Package className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-blue-50/60 p-3.5 rounded-[6px] border border-blue-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">1 KG Units</p>
            <p className="text-lg font-extrabold text-blue-900 font-mono mt-0.5">{metrics.totalKg}</p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            KG
          </span>
        </div>

        <div className="bg-purple-50/60 p-3.5 rounded-[6px] border border-purple-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">1/2 KG Units</p>
            <p className="text-lg font-extrabold text-purple-900 font-mono mt-0.5">{metrics.totalHalfKg}</p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            1/2 KG
          </span>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-[6px] border border-emerald-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">FMS Units</p>
            <p className="text-lg font-extrabold text-emerald-900 font-mono mt-0.5">{metrics.totalFms}</p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            FMS
          </span>
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
            {/* Store Branch Filter */}
            <div className="w-48">
              <CustomSelect
                value={selectedBranchFilter}
                onChange={(val) => setSelectedBranchFilter(val)}
                options={[
                  { value: "all", label: "All Store Branches" },
                  ...availableBranches.map((b) => ({ value: b.id, label: b.name })),
                ]}
                searchable={true}
                className="w-full"
              />
            </div>

            {/* Category Filter */}
            <div className="w-44">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                options={categories.map((c) => ({ value: c, label: c }))}
                searchable={true}
                align="right"
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Matrix Table with Horizontal Scroll */}
        <div className="overflow-x-auto rounded-b-[6px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading stock assignments from Firestore...</p>
            </div>
          ) : availableBranches.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Store className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No active store branches assigned</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                You do not have any assigned branches for stock management.
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
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold sticky top-0 z-10">
                {/* Top Header Row: Branch Groups */}
                <tr className="border-b border-slate-200 bg-slate-100/80">
                  <th className="py-2.5 px-3 w-10 text-center text-[11px] font-bold text-slate-500" rowSpan={2}>
                    #
                  </th>
                  <th className="py-2.5 px-4 min-w-[240px] text-slate-800 font-bold" rowSpan={2}>
                    Product Information
                  </th>

                  {/* Branch Super Headers */}
                  {displayedBranches.map((b) => (
                    <th
                      key={b.id}
                      colSpan={3}
                      className="py-2 px-3 text-center bg-blue-50/80 border-l border-r border-blue-200"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="text-blue-950 font-extrabold truncate max-w-[240px]">
                          {b.name}
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="py-2.5 px-4 text-center min-w-[110px] bg-slate-100 font-bold text-slate-800 border-l border-slate-200" rowSpan={2}>
                    Total Count
                  </th>
                  <th className="py-2.5 px-4 text-center min-w-[120px] bg-slate-100 font-bold text-slate-800" rowSpan={2}>
                    Actions
                  </th>
                </tr>

                {/* Sub-Header Row: 3 Distinct Columns per Branch (KG, 1/2KG, FMS) */}
                <tr className="border-b border-slate-200">
                  {displayedBranches.map((b) => (
                    <Fragment key={b.id}>
                      {/* Sub-column 1: KG */}
                      <th
                        key={`${b.id}_kg_th`}
                        className="py-2 px-2 text-center min-w-[130px] w-[130px] bg-blue-50/50 border-l border-blue-100 text-blue-900 font-extrabold text-[11px]"
                      >
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-black tracking-wider">
                          KG
                        </span>
                      </th>
                      {/* Sub-column 2: 1/2 KG */}
                      <th
                        key={`${b.id}_halfKg_th`}
                        className="py-2 px-2 text-center min-w-[130px] w-[130px] bg-purple-50/50 border-l border-purple-100 text-purple-900 font-extrabold text-[11px]"
                      >
                        <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-black tracking-wider">
                          1/2 KG
                        </span>
                      </th>
                      {/* Sub-column 3: FMS */}
                      <th
                        key={`${b.id}_fms_th`}
                        className="py-2 px-2 text-center min-w-[130px] w-[130px] bg-emerald-50/50 border-l border-r border-emerald-100 text-emerald-900 font-extrabold text-[11px]"
                      >
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider">
                          FMS
                        </span>
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod, idx) => {
                  const isDirty = hasRowPendingEdits(prod.id);
                  const isEditing = isAllEditMode || editingRowIds.has(prod.id) || isDirty;
                  const isSavingThisRow = savingRowId === prod.id;
                  const totalRowUnits = getProductTotalUnit(prod.id);
                  const isLowBuffer = totalRowUnits <= prod.bufferStock;

                  return (
                    <tr
                      key={prod.id}
                      className={`transition-colors ${
                        isDirty
                          ? "bg-amber-50/40 hover:bg-amber-50/60"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* SL No */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Product Information */}
                      <td className="py-3 px-4">
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
                            <p className="font-bold text-slate-900 text-xs truncate max-w-[220px] leading-snug">
                              {prod.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                              <span className="font-mono text-slate-600 font-medium">
                                {prod.barcode || "No Barcode"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-medium text-slate-700">{prod.category}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-blue-700 font-mono">
                                Buffer: {prod.bufferStock}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3 Individual Sub-Column Cells for each Store Branch */}
                      {displayedBranches.map((b) => {
                        const units: UnitType[] = ["kg", "halfKg", "fms"];

                        return (
                          <Fragment key={b.id}>
                            {units.map((unit) => {
                              const editKey = `${prod.id}_${b.id}_${unit}`;
                              const currentVal = getBranchUnitQty(prod.id, b.id, unit);
                              const isEdited = pendingEdits[editKey] !== undefined;

                              return (
                                <td
                                  key={`${b.id}_${unit}_td`}
                                  className={`py-2 px-2 text-center border-l min-w-[130px] w-[130px] ${
                                    unit === "fms" ? "border-r border-emerald-100" : ""
                                  } ${
                                    unit === "kg"
                                      ? "bg-blue-50/20 border-blue-100/60"
                                      : unit === "halfKg"
                                      ? "bg-purple-50/20 border-purple-100/60"
                                      : "bg-emerald-50/20 border-emerald-100/60"
                                  }`}
                                >
                                  <div className="flex items-center justify-center">
                                    <div className="inline-flex items-center rounded-[5px] shadow-2xs border border-slate-300 bg-white overflow-hidden shrink-0">
                                      {/* Minus (-) Button */}
                                      <button
                                        type="button"
                                        title={`Decrease ${UNIT_LABELS[unit]} count`}
                                        onClick={() =>
                                          openAdjustModal(prod, b, unit, "decrease")
                                        }
                                        className="h-[30px] w-[30px] flex items-center justify-center bg-slate-50 hover:bg-rose-100 text-slate-700 hover:text-rose-700 border-r border-slate-200 transition-colors cursor-pointer shrink-0 active:scale-95"
                                      >
                                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                                      </button>

                                      {/* Count Input Box */}
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={currentVal === 0 && !isEdited ? "" : currentVal}
                                        placeholder="0"
                                        onWheel={(e) => (e.target as HTMLElement).blur()}
                                        onChange={(e) =>
                                          handleCellChange(prod.id, b.id, unit, e.target.value)
                                        }
                                        className={`w-[46px] h-[30px] px-1 text-center text-xs font-bold font-mono focus:outline-none transition-colors ${
                                          isEdited
                                            ? "bg-amber-50 text-amber-900 font-extrabold"
                                            : isEditing
                                            ? "bg-blue-50/40 text-slate-900"
                                            : "bg-white text-slate-900"
                                        }`}
                                      />

                                      {/* Plus (+) Button */}
                                      <button
                                        type="button"
                                        title={`Add ${UNIT_LABELS[unit]} count`}
                                        onClick={() =>
                                          openAdjustModal(prod, b, unit, "add")
                                        }
                                        className="h-[30px] w-[30px] flex items-center justify-center bg-slate-50 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 border-l border-slate-200 transition-colors cursor-pointer shrink-0 active:scale-95"
                                      >
                                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </Fragment>
                        );
                      })}

                      {/* Total Count */}
                      <td className="py-3 px-4 text-center bg-slate-50/60 border-l border-slate-200">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-extrabold text-xs font-mono border ${
                            isLowBuffer
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}
                        >
                          {totalRowUnits}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isDirty ? (
                            <>
                              {/* Save Row Button */}
                              <button
                                type="button"
                                onClick={() => handleSaveSingleRow(prod)}
                                disabled={isSavingThisRow}
                                title="Save changes for this row"
                                className="h-[30px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[5px] text-[11px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                {isSavingThisRow ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Save</span>
                              </button>

                              {/* Undo Row Button */}
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
                              {/* Distribute Modal Button */}
                              <button
                                type="button"
                                onClick={() => openDistributeModal(prod)}
                                title="Distribute stock across branches"
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
              <span>across {displayedBranches.length} store branch(es).</span>
            </div>

            {metrics.pendingCount > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-amber-700 font-bold text-xs">
                  {metrics.affectedProductsCount} item(s) modified ({metrics.pendingCount} cells)
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
                <span>All store branch stock assignments are up to date.</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. PLUS (+) / MINUS (-) ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {adjustModal.isOpen && adjustModal.product && adjustModal.branch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                adjustModal.action === "add"
                  ? "bg-emerald-50/70 border-emerald-100"
                  : "bg-rose-50/70 border-rose-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-[6px] flex items-center justify-center text-white font-bold ${
                    adjustModal.action === "add" ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {adjustModal.action === "add" ? (
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Minus className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {adjustModal.action === "add" ? "Add Stock Count (+)" : "Decrease Stock Count (-)"}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-600">
                    Unit: <span className="font-bold text-blue-700">{UNIT_LABELS[adjustModal.unit]}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setAdjustModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmAdjust} className="p-5 space-y-4 text-xs">
              {/* Product & Store Detail Box */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Product</span>
                  <span className="font-bold text-slate-900 truncate max-w-[220px]">
                    {adjustModal.product.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Store Branch</span>
                  <span className="font-bold text-slate-800">
                    {adjustModal.branch.name}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Current Stock</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {adjustModal.currentQty} {UNIT_LABELS[adjustModal.unit]}
                  </span>
                </div>
              </div>

              {/* Count Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {adjustModal.action === "add"
                    ? "Enter count to add:"
                    : "Enter count to decrease:"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    autoFocus
                    placeholder="e.g. 5"
                    value={adjustModal.inputQty}
                    onChange={(e) =>
                      setAdjustModal((prev) => ({
                        ...prev,
                        inputQty: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    className="w-full h-[42px] px-3 font-mono font-bold text-base bg-white border border-slate-300 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    {UNIT_LABELS[adjustModal.unit]}
                  </span>
                </div>

                {/* Quick Increment/Decrement Chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {(adjustModal.action === "add"
                    ? [1, 2, 5, 10, 20, 50]
                    : [1, 2, 5, 10]
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setAdjustModal((prev) => ({
                          ...prev,
                          inputQty: preset,
                        }))
                      }
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {adjustModal.action === "add" ? `+${preset}` : `-${preset}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Math Box */}
              {typeof adjustModal.inputQty === "number" && adjustModal.inputQty > 0 && (
                <div
                  className={`p-3 rounded-[6px] border flex items-center justify-between text-xs ${
                    adjustModal.action === "add"
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                      : "bg-rose-50/80 border-rose-200 text-rose-900"
                  }`}
                >
                  <span className="font-semibold">
                    Calculation: {adjustModal.currentQty}{" "}
                    {adjustModal.action === "add" ? "+" : "-"}{" "}
                    {adjustModal.inputQty}
                  </span>
                  <span className="font-mono font-extrabold text-sm">
                    = New:{" "}
                    {adjustModal.action === "add"
                      ? adjustModal.currentQty + adjustModal.inputQty
                      : Math.max(0, adjustModal.currentQty - adjustModal.inputQty)}{" "}
                    {UNIT_LABELS[adjustModal.unit]}
                  </span>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAdjustModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustModal.isSubmitting}
                  className={`h-[36px] px-5 rounded-[6px] font-bold text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    adjustModal.action === "add"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {adjustModal.isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : adjustModal.action === "add" ? (
                    <Plus className="w-4 h-4" />
                  ) : (
                    <Minus className="w-4 h-4" />
                  )}
                  <span>
                    {adjustModal.action === "add"
                      ? "Confirm Add Stock"
                      : "Confirm Decrease Stock"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK DISTRIBUTE MODAL */}
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
                  Assign Stock per Branch (KG, 1/2KG, FMS):
                </label>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {availableBranches.map((b) => {
                    const currentValues = distributeBranchQuantities[b.id] || {
                      kg: "",
                      halfKg: "",
                      fms: "",
                    };

                    return (
                      <div
                        key={b.id}
                        className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{b.name}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {/* KG Input */}
                          <div>
                            <label className="block text-[10px] font-bold text-blue-800 mb-0.5">
                              1 KG
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={currentValues.kg}
                              onWheel={(e) => (e.target as HTMLElement).blur()}
                              onChange={(e) =>
                                setDistributeBranchQuantities((prev) => ({
                                  ...prev,
                                  [b.id]: {
                                    ...prev[b.id],
                                    kg: e.target.value === "" ? "" : Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full h-[32px] px-2 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-[5px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* 1/2 KG Input */}
                          <div>
                            <label className="block text-[10px] font-bold text-purple-800 mb-0.5">
                              1/2 KG
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={currentValues.halfKg}
                              onWheel={(e) => (e.target as HTMLElement).blur()}
                              onChange={(e) =>
                                setDistributeBranchQuantities((prev) => ({
                                  ...prev,
                                  [b.id]: {
                                    ...prev[b.id],
                                    halfKg: e.target.value === "" ? "" : Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full h-[32px] px-2 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-[5px] focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>

                          {/* FMS Input */}
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                              FMS
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={currentValues.fms}
                              onWheel={(e) => (e.target as HTMLElement).blur()}
                              onChange={(e) =>
                                setDistributeBranchQuantities((prev) => ({
                                  ...prev,
                                  [b.id]: {
                                    ...prev[b.id],
                                    fms: e.target.value === "" ? "" : Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full h-[32px] px-2 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-[5px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
