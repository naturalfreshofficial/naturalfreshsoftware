"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Expense, Branch } from "@/lib/types";
import {
  Receipt,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  RefreshCw,
  FileSpreadsheet,
  IndianRupee,
  Calendar,
  Store,
  CreditCard,
  TrendingDown,
  Clock,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/AuthContext";
import CustomSelect from "@/components/CustomSelect";
import CustomDatePicker from "@/components/CustomDatePicker";

export default function ExpensesPageClient() {
  const toast = useToast();
  const { user } = useAuth();

  // Firestore Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // Available branches strictly filtered for staff
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") {
      return branches;
    }
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Auto select first assigned branch for staff
  useEffect(() => {
    if (user?.role === "staff" && availableBranches.length > 0) {
      if (selectedBranchFilter === "all" || !availableBranches.some((b) => b.id === selectedBranchFilter)) {
        setSelectedBranchFilter(availableBranches[0].id);
      }
    }
  }, [user, availableBranches, selectedBranchFilter]);


  // Date Range Filters (Default to 'all_time')
  const [datePreset, setDatePreset] = useState<string>("all_time");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form Fields (Empty initial state without pre-built values)
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [branchId, setBranchId] = useState("");
  const [category, setCategory] = useState("Electricity & Utilities");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card" | "Bank Transfer">("Cash");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Subscribe to Expenses collection in Firestore
  useEffect(() => {
    setLoadingExpenses(true);
    const unsub = onSnapshot(
      collection(db, "expenses"),
      (snapshot) => {
        const items: Expense[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Expense);
        });
        // Sort newest date first
        items.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return dateB - dateA;
        });
        setExpenses(items);
        setLoadingExpenses(false);
      },
      (err) => {
        console.error("Expenses sync error:", err);
        setLoadingExpenses(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Branches collection in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), (snapshot) => {
      const bList: Branch[] = [];
      snapshot.forEach((docSnap) => {
        bList.push({ id: docSnap.id, ...docSnap.data() } as Branch);
      });
      setBranches(bList);
    });
    return () => unsub();
  }, []);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return expenses.filter((exp) => {
      // Branch filter
      if (selectedBranchFilter !== "all" && exp.branchId !== selectedBranchFilter) {
        return false;
      }

      // Category filter
      if (selectedCategoryFilter !== "all" && exp.category !== selectedCategoryFilter) {
        return false;
      }

      // Date Range Filter
      if (datePreset !== "all_time") {
        let expDateStr = "";
        if (exp.date) {
          expDateStr = typeof exp.date === "string" ? exp.date : "";
        } else if (exp.createdAt?.toDate) {
          expDateStr = exp.createdAt.toDate().toISOString().split("T")[0];
        }

        if (expDateStr) {
          if (expDateStr < customStartDate || expDateStr > customEndDate) {
            return false;
          }
        }
      }

      // Search Query
      if (q) {
        return (
          exp.title.toLowerCase().includes(q) ||
          exp.branchName.toLowerCase().includes(q) ||
          (exp.category && exp.category.toLowerCase().includes(q)) ||
          (exp.paymentMethod && exp.paymentMethod.toLowerCase().includes(q)) ||
          (exp.notes && exp.notes.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [
    expenses,
    searchQuery,
    selectedBranchFilter,
    selectedCategoryFilter,
    datePreset,
    customStartDate,
    customEndDate,
  ]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalAmount = filteredExpenses.reduce(
      (acc, e) => acc + (Number(e.amount) || 0),
      0
    );

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().split("T")[0];

    const thisMonthAmount = expenses.reduce((acc, e) => {
      const d = e.date || (e.createdAt?.toDate ? e.createdAt.toDate().toISOString().split("T")[0] : "");
      return d && d.startsWith(currentMonthStr) ? acc + (Number(e.amount) || 0) : acc;
    }, 0);

    const todayAmount = expenses.reduce((acc, e) => {
      const d = e.date || (e.createdAt?.toDate ? e.createdAt.toDate().toISOString().split("T")[0] : "");
      return d === todayStr ? acc + (Number(e.amount) || 0) : acc;
    }, 0);

    return {
      totalCount: filteredExpenses.length,
      filteredTotal: totalAmount,
      thisMonthTotal: thisMonthAmount,
      todayTotal: todayAmount,
    };
  }, [filteredExpenses, expenses]);

  // Open Modal (New or Edit)
  const openModal = (exp?: Expense) => {
    if (exp) {
      setEditingExpense(exp);
      setTitle(exp.title);
      setAmount(exp.amount ?? "");
      setBranchId(exp.branchId || "");
      setCategory(exp.category || "Electricity & Utilities");
      setPaymentMethod(exp.paymentMethod || "Cash");
      setExpenseDate(
        exp.date || (exp.createdAt?.toDate ? exp.createdAt.toDate().toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
      );
      setNotes(exp.notes || "");
    } else {
      setEditingExpense(null);
      setTitle("");
      setAmount("");
      setBranchId(branches[0]?.id || "");
      setCategory("Electricity & Utilities");
      setPaymentMethod("Cash");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
    setIsModalOpen(true);
  };

  // Save Expense to Firestore
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning("Please enter expense title");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      toast.warning("Please enter a valid expense amount");
      return;
    }
    if (!branchId) {
      toast.warning("Please select a store branch");
      return;
    }

    const selectedBranch = branches.find((b) => b.id === branchId);
    const branchName = selectedBranch ? selectedBranch.name : "Main Store";

    setIsSubmitting(true);
    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(amount),
        branchId,
        branchName,
        category,
        paymentMethod,
        date: expenseDate,
        notes: notes.trim() || "",
        updatedAt: serverTimestamp(),
      };

      if (editingExpense) {
        await updateDoc(doc(db, "expenses", editingExpense.id), expenseData);
        toast.success(`Expense "${title.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "expenses"), {
          ...expenseData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Expense "${title.trim()}" recorded (₹ ${Number(amount).toLocaleString("en-IN")})`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save expense error:", err);
      toast.error("Failed to save expense: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Expense
  const handleDelete = async (id: string, expTitle: string) => {
    if (confirm(`Are you sure you want to delete expense "${expTitle}"?`)) {
      try {
        await deleteDoc(doc(db, "expenses", id));
        toast.success(`Expense "${expTitle}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting expense: " + err.message);
      }
    }
  };

  // Export Expenses to Excel
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      toast.warning("No expense records to export");
      return;
    }

    const data = filteredExpenses.map((exp, idx) => ({
      "SL No": idx + 1,
      "Expense Title": exp.title,
      "Amount (INR)": exp.amount,
      "Store Branch": exp.branchName,
      "Category": exp.category || "General",
      "Payment Mode": exp.paymentMethod || "Cash",
      "Expense Date": exp.date || "—",
      "Notes / Remarks": exp.notes || "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 32 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Store Expenses");
    XLSX.writeFile(workbook, `expenses_report_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredExpenses.length} expense records to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Expenses & Outgoings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track daily operating expenses, branch utilities, rent, maintenance, and petty cash.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Filtered Expenses Total */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Filtered Total Expenses</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">
              ₹ {stats.filteredTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* This Month Total */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">This Month Expenses</p>
            <p className="text-xl font-extrabold text-amber-700 font-mono">
              ₹ {stats.thisMonthTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Today&apos;s Expenses</p>
            <p className="text-xl font-extrabold text-emerald-700 font-mono">
              ₹ {stats.todayTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Total Records */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Records</p>
            <p className="text-2xl font-extrabold text-slate-900">{stats.totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-slate-100 text-slate-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by expense title, branch, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Custom Date Picker */}
            <CustomDatePicker
              isRange={true}
              startDate={customStartDate}
              endDate={customEndDate}
              preset={datePreset}
              onPresetChange={(p) => setDatePreset(p)}
              onChange={(start, end) => {
                setCustomStartDate(start);
                if (end) setCustomEndDate(end);
                setDatePreset("custom");
              }}
            />

            {/* Branch Filter */}
            <CustomSelect
              value={selectedBranchFilter}
              onChange={(val) => setSelectedBranchFilter(val)}
              options={[
                ...(user?.role === "super_admin"
                  ? [{ value: "all", label: "All Branches" }]
                  : []),
                ...availableBranches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              searchable={true}
              className="w-40"
            />

            {/* Category Filter */}
            <CustomSelect
              value={selectedCategoryFilter}
              onChange={(val) => setSelectedCategoryFilter(val)}
              options={[
                { value: "all", label: "All Categories" },
                { value: "Electricity & Utilities", label: "Electricity & Utilities" },
                { value: "Rent & Store Lease", label: "Rent & Store Lease" },
                { value: "Repairs & Maintenance", label: "Repairs & Maintenance" },
                { value: "Packaging & Supplies", label: "Packaging & Supplies" },
                { value: "Logistics & Transport", label: "Logistics & Transport" },
                { value: "Staff Refreshments & Food", label: "Staff Refreshments & Food" },
                { value: "Marketing & Ads", label: "Marketing & Ads" },
                { value: "Other General", label: "Other General" },
              ]}
              searchable={true}
              className="w-44"
            />

            {/* Export Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          {loadingExpenses ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading expenses from Firestore...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Receipt className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No expense records found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "Try changing your search keywords or date filter."
                  : "Record your first operating expense to keep track of branch outgoings."}
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record First Expense</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                      {exp.date || (exp.createdAt?.toDate ? exp.createdAt.toDate().toLocaleDateString() : "—")}
                    </td>

                    {/* Title & Notes */}
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{exp.title}</p>
                        {exp.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">{exp.notes}</p>
                        )}
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{exp.branchName}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                        {exp.category || "General"}
                      </span>
                    </td>

                    {/* Payment Mode */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                        <CreditCard className="w-2.5 h-2.5 text-slate-500" />
                        <span>{exp.paymentMethod || "Cash"}</span>
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-red-600 text-xs">
                      ₹ {Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openModal(exp)}
                          title="Edit Expense"
                          className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id, exp.title)}
                          title="Delete Expense"
                          className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT EXPENSE MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExpense ? "Edit Expense Entry" : "Record New Expense"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              {/* Expense Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Title / Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Electricity Bill, Store Signboard Repair"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Amount & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 3500"
                    value={amount}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) =>
                      setAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Store Branch <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={branchId}
                    onChange={(val) => setBranchId(val)}
                    options={availableBranches.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }))}
                    searchable={true}
                    placeholder="Select branch..."
                    className="w-full"
                  />
                </div>
              </div>

              {/* Category & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Category
                  </label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => setCategory(val)}
                    options={[
                      { value: "Electricity & Utilities", label: "Electricity & Utilities" },
                      { value: "Rent & Store Lease", label: "Rent & Store Lease" },
                      { value: "Repairs & Maintenance", label: "Repairs & Maintenance" },
                      { value: "Packaging & Supplies", label: "Packaging & Supplies" },
                      { value: "Logistics & Transport", label: "Logistics & Transport" },
                      { value: "Staff Refreshments & Food", label: "Staff Refreshments & Food" },
                      { value: "Marketing & Ads", label: "Marketing & Ads" },
                      { value: "Other General", label: "Other General" },
                    ]}
                    searchable={true}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Payment Method
                  </label>
                  <CustomSelect
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val as any)}
                    options={[
                      { value: "Cash", label: "Cash" },
                      { value: "UPI", label: "UPI" },
                      { value: "Card", label: "Card" },
                      { value: "Bank Transfer", label: "Bank Transfer" },
                    ]}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Date
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Bill Reference <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid to APCPDCL electricity bill #9872"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
