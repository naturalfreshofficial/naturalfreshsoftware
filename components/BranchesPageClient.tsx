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
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Branch } from "@/lib/types";
import {
  Store,
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  Mail,
  X,
  Check,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

export default function BranchesPageClient() {
  const toast = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchEmail, setBranchEmail] = useState("");
  const [branchStatus, setBranchStatus] = useState<"active" | "inactive">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to Firestore branches collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "branches"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: Branch[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Branch);
        });
        setBranches(items);
        setLoading(false);
      },
      (err) => {
        console.warn("Branches query fallback:", err);
        const fallbackUnsub = onSnapshot(collection(db, "branches"), (snapshot) => {
          const items: Branch[] = [];
          snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...docSnap.data() } as Branch);
          });
          setBranches(items);
          setLoading(false);
        });
        return () => fallbackUnsub();
      }
    );

    return () => unsub();
  }, []);

  // Filtered Branches
  const filteredBranches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return branches.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.phone && b.phone.includes(q)) ||
        (b.address && b.address.toLowerCase().includes(q)) ||
        (b.email && b.email.toLowerCase().includes(q))
      );
    });
  }, [branches, searchQuery, statusFilter]);

  // Statistics
  const totalBranchesCount = branches.length;
  const activeBranchesCount = branches.filter((b) => b.status !== "inactive").length;

  // Open Add/Edit Modal
  const openModal = (b?: Branch) => {
    if (b) {
      setEditingBranch(b);
      setBranchName(b.name);
      setBranchPhone(b.phone);
      setBranchAddress(b.address);
      setBranchEmail(b.email || "");
      setBranchStatus(b.status || "active");
    } else {
      setEditingBranch(null);
      setBranchName("");
      setBranchPhone("");
      setBranchAddress("");
      setBranchEmail("");
      setBranchStatus("active");
    }
    setIsModalOpen(true);
  };

  // Save Branch (Create or Edit)
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      toast.warning("Please enter branch name");
      return;
    }
    if (!branchPhone.trim()) {
      toast.warning("Please enter branch mobile number");
      return;
    }
    if (!branchAddress.trim()) {
      toast.warning("Please enter branch address");
      return;
    }

    setIsSubmitting(true);
    try {
      const branchData = {
        name: branchName.trim(),
        phone: branchPhone.trim().replace(/\D/g, ""),
        address: branchAddress.trim(),
        email: branchEmail.trim() || "",
        status: branchStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingBranch) {
        await updateDoc(doc(db, "branches", editingBranch.id), branchData);
        toast.success(`Branch "${branchName.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "branches"), {
          ...branchData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Branch "${branchName.trim()}" added successfully!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save branch error:", err);
      toast.error("Failed to save branch: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Branch
  const handleDeleteBranch = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete branch "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "branches", id));
        toast.success(`Branch "${name}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting branch: " + err.message);
      }
    }
  };

  // Export Branches to Excel
  const handleExportExcel = () => {
    if (filteredBranches.length === 0) {
      toast.warning("No branches to export");
      return;
    }

    const data = filteredBranches.map((b, idx) => ({
      "SL No": idx + 1,
      "Branch Name": b.name,
      "Mobile Number": b.phone,
      "Address": b.address,
      "Email Address": b.email || "—",
      "Status": b.status || "active",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 35 },
      { wch: 25 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branches");
    XLSX.writeFile(workbook, `branches_list_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredBranches.length} branches to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Branches Management</h1>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {totalBranchesCount} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage physical retail store branches, contact mobile numbers, and street addresses.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => openModal()}
            className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Branch</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Store Outlets</p>
            <p className="text-2xl font-extrabold text-slate-900">{totalBranchesCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Active Operational</p>
            <p className="text-2xl font-extrabold text-emerald-600">{activeBranchesCount}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Inactive / Closed</p>
            <p className="text-2xl font-extrabold text-slate-400">
              {Math.max(0, totalBranchesCount - activeBranchesCount)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-slate-100 text-slate-500 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Branches Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search branch name, mobile number, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              className="w-36"
            />
          </div>
        </div>

        {/* Branches Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading branches from Firestore...</p>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No branches found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "No branches matched your search. Try a different query."
                  : "Add your first retail store branch outlet to manage multi-store operations."}
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Branch</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Branch Details</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Branch Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[6px] bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{branch.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID: {branch.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{branch.phone}</span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 text-slate-700 text-xs max-w-sm">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{branch.address}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {branch.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{branch.email}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                          branch.status === "inactive"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {branch.status === "inactive" ? "Inactive" : "Active"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openModal(branch)}
                          title="Edit Branch"
                          className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBranch(branch.id, branch.name)}
                          title="Delete Branch"
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
      {/* ADD / EDIT BRANCH MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingBranch ? "Edit Branch Details" : "Add New Branch"}
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

            <form onSubmit={handleSaveBranch} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Guntur Main Branch, Vijayawada Outlet"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Door No 4-5-6, Brodipet Main Road, Guntur, AP - 522002"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. guntur@naturalfresh.com"
                  value={branchEmail}
                  onChange={(e) => setBranchEmail(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <CustomSelect
                  value={branchStatus}
                  onChange={(val) => setBranchStatus(val as any)}
                  options={[
                    { value: "active", label: "Active (Operational)" },
                    { value: "inactive", label: "Inactive (Closed / Temporary)" },
                  ]}
                  className="w-full"
                />
              </div>

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
                  <span>Save Branch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
