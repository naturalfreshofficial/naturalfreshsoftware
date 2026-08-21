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
import { Employee, Branch } from "@/lib/types";
import {
  UserCheck,
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
  IndianRupee,
  Calendar,
  Users,
  Store,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

export default function EmployeesPageClient() {
  const toast = useToast();

  // Firestore Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form Fields (Empty initial state without pre-built values)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [monthlySalary, setMonthlySalary] = useState<number | "">("");
  const [acceptedLeaves, setAcceptedLeaves] = useState<number | "">("");
  const [branchId, setBranchId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Real-time Firestore Sync for Employees
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "employees"),
      (snapshot) => {
        const items: Employee[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Employee);
        });
        // Sort alphabetically
        items.sort((a, b) => a.name.localeCompare(b.name));
        setEmployees(items);
        setLoading(false);
      },
      (err) => {
        console.error("Employees sync error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Real-time Firestore Sync for Branches
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

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter((emp) => {
      if (selectedBranchFilter !== "all" && emp.branchId !== selectedBranchFilter) {
        return false;
      }
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.phone.includes(q) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.branchName && emp.branchName.toLowerCase().includes(q))
      );
    });
  }, [employees, searchQuery, selectedBranchFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = employees.length;
    const totalPayroll = employees.reduce(
      (acc, e) => acc + (Number(e.monthlySalary) || 0),
      0
    );
    const avgLeaves =
      total > 0
        ? (
            employees.reduce((acc, e) => acc + (Number(e.acceptedLeaves) || 0), 0) /
            total
          ).toFixed(1)
        : "0";

    return { total, totalPayroll, avgLeaves };
  }, [employees]);

  // Open Modal (New or Edit)
  const openModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setName(emp.name);
      setPhone(emp.phone);
      setEmail(emp.email || "");
      setMonthlySalary(emp.monthlySalary ?? "");
      setAcceptedLeaves(emp.acceptedLeaves ?? "");
      setBranchId(emp.branchId || (branches[0]?.id || ""));
    } else {
      setEditingEmployee(null);
      setName("");
      setPhone("");
      setEmail("");
      setMonthlySalary("");
      setAcceptedLeaves("");
      setBranchId(branches[0]?.id || "");
    }
    setIsModalOpen(true);
  };

  // Save Employee to Firestore
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning("Please enter employee name");
      return;
    }
    if (!phone.trim()) {
      toast.warning("Please enter employee mobile number");
      return;
    }
    if (monthlySalary === "" || Number(monthlySalary) < 0) {
      toast.warning("Please enter a valid monthly salary amount");
      return;
    }
    if (acceptedLeaves === "" || Number(acceptedLeaves) < 0) {
      toast.warning("Please enter accepted leaves count");
      return;
    }
    if (!branchId && branches.length > 0) {
      toast.warning("Please select an assigned store branch");
      return;
    }

    const assignedBranch = branches.find((b) => b.id === branchId);
    const branchName = assignedBranch ? assignedBranch.name : "Main Store";

    setIsSubmitting(true);
    try {
      const employeeData = {
        name: name.trim(),
        phone: phone.trim().replace(/\D/g, ""),
        email: email.trim() || "",
        monthlySalary: Number(monthlySalary),
        acceptedLeaves: Number(acceptedLeaves),
        branchId,
        branchName,
        status: "active" as const,
        updatedAt: serverTimestamp(),
      };

      if (editingEmployee) {
        await updateDoc(doc(db, "employees", editingEmployee.id), employeeData);
        toast.success(`Employee "${name.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "employees"), {
          ...employeeData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Employee "${name.trim()}" added successfully!`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save employee error:", err);
      toast.error("Failed to save employee: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Employee
  const handleDelete = async (id: string, empName: string) => {
    if (confirm(`Are you sure you want to delete employee record for "${empName}"?`)) {
      try {
        await deleteDoc(doc(db, "employees", id));
        toast.success(`Employee "${empName}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting employee: " + err.message);
      }
    }
  };

  // Export Employees to Excel
  const handleExportExcel = () => {
    if (filteredEmployees.length === 0) {
      toast.warning("No employee records to export");
      return;
    }

    const data = filteredEmployees.map((emp, idx) => ({
      "SL No": idx + 1,
      "Employee Name": emp.name,
      "Mobile Number": emp.phone,
      "Email Address": emp.email || "—",
      "Store Branch": emp.branchName || "—",
      "Monthly Salary (INR)": emp.monthlySalary,
      "Accepted Leaves": emp.acceptedLeaves,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, `employees_list_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredEmployees.length} employees to Excel!`);
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Employees & Staff Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage staff directory, branch assignments, monthly salaries, and accepted leaves.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openModal()}
            className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Total Staff */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Total Staff Members</p>
            <p className="text-2xl font-extrabold text-slate-900">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Monthly Payroll Total */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Monthly Payroll</p>
            <p className="text-xl font-extrabold text-blue-700 font-mono">
              ₹ {stats.totalPayroll.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Avg Accepted Leaves */}
        <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">Avg Accepted Leaves</p>
            <p className="text-2xl font-extrabold text-slate-800 font-mono">
              {stats.avgLeaves} <span className="text-xs font-normal text-slate-500">days/mo</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col relative z-10">
        {/* Search, Branch Filter & Export Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-30">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by employee name, mobile, branch, or email..."
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

        {/* Employees Table */}
        <div className="overflow-x-auto rounded-b-[6px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading employees from Firestore...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Users className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No employees found</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "Try searching with a different name or mobile number."
                  : "Add your store staff members to manage monthly salaries, assigned branches, and accepted leaves."}
              </p>
              <button
                type="button"
                onClick={() => openModal()}
                className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Employee</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Store Branch</th>
                  <th className="py-3 px-4 text-right">Monthly Salary</th>
                  <th className="py-3 px-4 text-center">Accepted Leaves</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                          {emp.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{emp.name}</p>
                          {emp.email ? (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" />
                              <span>{emp.email}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-mono">
                              ID: {emp.id.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-700 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{emp.phone}</span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-750 font-medium text-xs border border-slate-200">
                        <Store className="w-3 h-3 text-blue-600 shrink-0" />
                        <span>{emp.branchName || "Main Branch"}</span>
                      </span>
                    </td>

                    {/* Monthly Salary */}
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-blue-700 text-xs">
                      ₹ {Number(emp.monthlySalary).toLocaleString("en-IN")}
                    </td>

                    {/* Accepted Leaves */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200">
                        <Calendar className="w-3 h-3" />
                        <span>{emp.acceptedLeaves} days / mo</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openModal(emp)}
                          title="Edit Employee"
                          className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(emp.id, emp.name)}
                          title="Delete Employee"
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
      {/* ADD / EDIT EMPLOYEE MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmployee ? "Edit Employee Details" : "Add New Employee"}
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
              {/* Employee Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Employee Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar, Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Mobile Number & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@naturalfresh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Branch Selection Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Store Branch <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={branchId}
                  onChange={(val) => setBranchId(val)}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: b.name,
                  }))}
                  searchable={true}
                  placeholder="Select branch..."
                  className="w-full"
                />
              </div>

              {/* Monthly Salary & Accepted Leaves */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monthly Salary (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 18000"
                    value={monthlySalary}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) =>
                      setMonthlySalary(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Accepted Leaves (Days/Mo) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 2"
                    value={acceptedLeaves}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) =>
                      setAcceptedLeaves(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                  />
                </div>
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
                  <span>Save Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
