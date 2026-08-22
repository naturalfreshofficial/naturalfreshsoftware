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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Staff, Branch } from "@/lib/types";
import { AVAILABLE_STAFF_PAGES, PageDefinition } from "@/lib/pagesConfig";
import {
  ShieldCheck,
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  X,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Store,
  Users,
  CheckSquare,
  Square,
  Lock,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

export default function StaffPageClient() {
  const toast = useToast();

  // Firestore State
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Sync Staff from Firestore
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "staff"),
      (snapshot) => {
        const list: Staff[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Staff);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStaffList(list);
        setLoading(false);
      },
      (err) => {
        console.error("Staff sync error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Sync Branches from Firestore
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

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return staffList.filter((st) => {
      if (selectedBranchFilter !== "all" && !st.branchIds?.includes(selectedBranchFilter)) {
        return false;
      }
      if (statusFilter !== "all" && st.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        st.name.toLowerCase().includes(q) ||
        st.phone.includes(q) ||
        (st.email && st.email.toLowerCase().includes(q)) ||
        st.branchNames?.some((b) => b.toLowerCase().includes(q))
      );
    });
  }, [staffList, searchQuery, selectedBranchFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.status === "active").length;
    const multiStore = staffList.filter((s) => s.branchIds && s.branchIds.length > 1).length;
    return { total, active, multiStore };
  }, [staffList]);

  // Open Modal (Add or Edit)
  const openModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setName(staff.name);
      setPhone(staff.phone);
      setEmail(staff.email || "");
      setSelectedBranches(staff.branchIds || []);
      setSelectedPages(staff.allowedPages || []);
      setStatus(staff.status || "active");
    } else {
      setEditingStaff(null);
      setName("");
      setPhone("");
      setEmail("");
      // Default select first branch if available
      setSelectedBranches(branches.length > 0 ? [branches[0].id] : []);
      // Default to POS Billing & Invoices
      setSelectedPages(["/pos-billing", "/invoices"]);
      setStatus("active");
    }
    setIsModalOpen(true);
  };

  // Toggle Branch in Multi-Select
  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  // Toggle Page in Multi-Select
  const togglePage = (pageHref: string) => {
    setSelectedPages((prev) =>
      prev.includes(pageHref) ? prev.filter((p) => p !== pageHref) : [...prev, pageHref]
    );
  };

  // Select / Deselect All Pages
  const handleSelectAllPages = () => {
    if (selectedPages.length === AVAILABLE_STAFF_PAGES.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(AVAILABLE_STAFF_PAGES.map((p) => p.href));
    }
  };

  // Select / Deselect All Branches
  const handleSelectAllBranches = () => {
    if (selectedBranches.length === branches.length) {
      setSelectedBranches([]);
    } else {
      setSelectedBranches(branches.map((b) => b.id));
    }
  };

  // Save Staff to Firestore
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.warning("Please enter staff full name");
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.warning("Please enter a valid 10-digit mobile number for OTP login");
      return;
    }

    if (selectedBranches.length === 0 && branches.length > 0) {
      toast.warning("Please select at least one store branch for this staff member");
      return;
    }

    if (selectedPages.length === 0) {
      toast.warning("Please select at least one page permission for staff access");
      return;
    }

    // Resolve branch names
    const branchNames = selectedBranches
      .map((id) => branches.find((b) => b.id === id)?.name)
      .filter(Boolean) as string[];

    setIsSubmitting(true);
    try {
      const staffPayload = {
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim() || "",
        branchIds: selectedBranches,
        branchNames: branchNames.length > 0 ? branchNames : ["Main Store"],
        allowedPages: selectedPages,
        status,
        updatedAt: serverTimestamp(),
      };

      if (editingStaff) {
        await updateDoc(doc(db, "staff", editingStaff.id), staffPayload);
        toast.success(`Staff "${name.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "staff"), {
          ...staffPayload,
          createdAt: serverTimestamp(),
        });
        toast.success(`Staff member "${name.trim()}" added with Descope OTP access!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save staff error:", err);
      toast.error("Failed to save staff: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Staff Status (Active / Inactive)
  const handleToggleStatus = async (staff: Staff) => {
    const nextStatus = staff.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "staff", staff.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      toast.info(`Staff "${staff.name}" marked as ${nextStatus.toUpperCase()}`);
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Delete Staff
  const handleDelete = async (id: string, staffName: string) => {
    if (confirm(`Are you sure you want to remove staff member "${staffName}"? They will lose access immediately.`)) {
      try {
        await deleteDoc(doc(db, "staff", id));
        toast.success(`Staff member "${staffName}" removed.`);
      } catch (err: any) {
        toast.error("Error deleting staff: " + err.message);
      }
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredStaff.length === 0) {
      toast.warning("No staff records to export");
      return;
    }

    const data = filteredStaff.map((st, idx) => ({
      "SL No": idx + 1,
      "Staff Name": st.name,
      "Mobile Number (OTP)": st.phone,
      "Email Address": st.email || "—",
      "Assigned Branches": st.branchNames?.join(", ") || "—",
      "Allowed Pages Count": st.allowedPages?.length || 0,
      "Allowed Pages": st.allowedPages?.join(", ") || "—",
      "Account Status": st.status.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 20 },
      { wch: 25 },
      { wch: 30 },
      { wch: 18 },
      { wch: 45 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Staff Directory");
    XLSX.writeFile(workbook, `staff_access_list_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredStaff.length} staff records!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Staff & Access Control
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage store staff credentials, mobile OTP authentication, multi-store access, and page permissions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Staff Accounts</p>
            <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Active OTP Logins</p>
            <p className="text-2xl font-extrabold text-emerald-600 font-mono">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Multi-Store Staff</p>
            <p className="text-2xl font-extrabold text-blue-700 font-mono">{stats.multiStore}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Staff List Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col relative z-10">
        {/* Search, Filter & Export Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-30">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name, mobile, branch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
            {branches.length > 0 && (
              <CustomSelect
                value={selectedBranchFilter}
                onChange={(val) => setSelectedBranchFilter(val)}
                options={[
                  { value: "all", label: "All Branches" },
                  ...branches.map((b) => ({ value: b.id, label: b.name })),
                ]}
                searchable={true}
                align="right"
                className="w-44"
              />
            )}

            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active Only" },
                { value: "inactive", label: "Inactive Only" },
              ]}
              align="right"
              className="w-36"
            />

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

        {/* Staff Table */}
        <div className="overflow-x-auto rounded-b-[6px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading staff credentials from Firestore...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <ShieldCheck className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No staff members found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "Try searching with a different name or mobile number."
                  : "Add store staff members with mobile OTP authentication, multi-store access, and granular page permissions."}
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Staff Member</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Mobile Number (OTP)</th>
                  <th className="py-3 px-4">Assigned Stores / Branches</th>
                  <th className="py-3 px-4">Page Permissions</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                          {st.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{st.name}</p>
                          {st.email ? (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              <span>{st.email}</span>
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-400">Staff Account</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-600" />
                        <span>+91 {st.phone}</span>
                      </div>
                    </td>

                    {/* Assigned Branches */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {st.branchNames && st.branchNames.length > 0 ? (
                          st.branchNames.map((bName, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200"
                            >
                              <Store className="w-2.5 h-2.5 text-blue-600" />
                              <span>{bName}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">All Branches</span>
                        )}
                      </div>
                    </td>

                    {/* Page Permissions */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                          {st.allowedPages?.length || 0} Modules Allowed
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {st.allowedPages?.slice(0, 3).map((pageHref, idx) => {
                            const def = AVAILABLE_STAFF_PAGES.find((p) => p.href === pageHref);
                            return (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-600 text-[10px]"
                              >
                                {def?.name || pageHref}
                              </span>
                            );
                          })}
                          {(st.allowedPages?.length || 0) > 3 && (
                            <span className="text-[10px] text-slate-400 font-semibold self-center">
                              +{(st.allowedPages?.length || 0) - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(st)}
                        title={`Click to ${st.status === "active" ? "deactivate" : "activate"}`}
                        className="inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        {st.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 hover:bg-emerald-100 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] border border-slate-200 hover:bg-slate-200 transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Inactive</span>
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openModal(st)}
                          title="Edit Staff Permissions"
                          className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(st.id, st.name)}
                          title="Delete Staff Member"
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
      {/* ADD / EDIT STAFF MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingStaff ? "Edit Staff & Access Permissions" : "Add New Staff Member"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure staff mobile number for Descope OTP login, assign multiple stores, and set page permissions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staff Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma, Suman V"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number (For Descope OTP) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-xs font-bold">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full h-[36px] pl-11 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="staff@naturalfresh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <div className="flex items-center gap-3 h-[36px]">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status"
                        checked={status === "active"}
                        onChange={() => setStatus("active")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Active (Can Log In)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status"
                        checked={status === "inactive"}
                        onChange={() => setStatus("inactive")}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Inactive (Blocked)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Multi-Store Branch Selection */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Store Branch Assignment (Multi-Store Selection) <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Staff will only be able to view and manage data from selected store branches.
                    </p>
                  </div>
                  {branches.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAllBranches}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      {selectedBranches.length === branches.length ? "Deselect All" : "Select All Branches"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-[6px] border border-slate-200">
                  {branches.length === 0 ? (
                    <p className="text-slate-400 italic text-xs col-span-2">
                      No branches found. Please create branches first.
                    </p>
                  ) : (
                    branches.map((b) => {
                      const isSelected = selectedBranches.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => toggleBranch(b.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-[6px] border cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-[4px] flex items-center justify-center text-white shrink-0 ${
                              isSelected ? "bg-blue-600" : "border border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{b.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{b.address || "Main outlet"}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Multi-Page Access Permissions */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Page & Module Access Permissions <span className="text-red-500">*</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                        {selectedPages.length} of {AVAILABLE_STAFF_PAGES.length} Selected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Check each page this staff member is permitted to access. (Dashboard is permanently excluded for staff).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllPages}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    {selectedPages.length === AVAILABLE_STAFF_PAGES.length
                      ? "Deselect All"
                      : "Select All Pages"}
                  </button>
                </div>

                {/* Grid of Pages */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-[6px] border border-slate-200 max-h-60 overflow-y-auto">
                  {AVAILABLE_STAFF_PAGES.map((p) => {
                    const isSelected = selectedPages.includes(p.href);
                    const Icon = p.icon;
                    return (
                      <div
                        key={p.id}
                        onClick={() => togglePage(p.href)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-[6px] border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white border-blue-400 shadow-2xs text-blue-900"
                            : "bg-white/60 border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-[4px] mt-0.5 flex items-center justify-center text-white shrink-0 ${
                            isSelected ? "bg-blue-600" : "border border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
                            <p className="text-xs font-bold text-slate-900">{p.name}</p>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Secured with Descope SMS OTP</span>
                </p>
                <div className="flex items-center gap-2">
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
                    <span>{editingStaff ? "Update Staff" : "Save Staff & Permissions"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
