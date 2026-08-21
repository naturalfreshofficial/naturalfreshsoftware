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
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Supplier, SupplierOrder, SupplierOrderItem } from "@/lib/types";
import {
  Truck,
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
  FileSpreadsheet,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Package,
  ArrowRight,
  Eye,
  Layers,
  FileText,
  Minus,
  Maximize2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

interface ProductOption {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
  category: string;
  imageUrl?: string;
}

export default function SuppliersPageClient() {
  const toast = useToast();

  // Active Tab State (First tab is Suppliers Orders, next tab is Suppliers)
  const [activeTab, setActiveTab] = useState<"orders" | "suppliers">("orders");

  // Firestore Data State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  // Add / Edit Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierStatus, setSupplierStatus] = useState<"active" | "inactive">("active");
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  // Add Supplier Order Modal State (Full Screen Item Name and Quantity only)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [orderItems, setOrderItems] = useState<
    { productId: string; name: string; quantity: number | "" }[]
  >([]);
  const [orderStatus, setOrderStatus] = useState<"pending" | "received">("pending");
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Order Details Inspection Modal
  const [inspectOrder, setInspectOrder] = useState<SupplierOrder | null>(null);

  // 1. Subscribe to Suppliers collection in Firestore
  useEffect(() => {
    setLoadingSuppliers(true);
    const unsub = onSnapshot(
      collection(db, "suppliers"),
      (snapshot) => {
        const items: Supplier[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as Supplier);
        });
        setSuppliers(items);
        setLoadingSuppliers(false);
      },
      (err) => {
        console.error("Suppliers sync error:", err);
        setLoadingSuppliers(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Supplier Orders collection in Firestore
  useEffect(() => {
    setLoadingOrders(true);
    const unsub = onSnapshot(
      collection(db, "supplier_orders"),
      (snapshot) => {
        const items: SupplierOrder[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as SupplierOrder);
        });
        // Sort newest first
        items.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return dateB - dateA;
        });
        setOrders(items);
        setLoadingOrders(false);
      },
      (err) => {
        console.error("Supplier orders sync error:", err);
        setLoadingOrders(false);
      }
    );
    return () => unsub();
  }, []);

  // 3. Subscribe to Products for Order selection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods: ProductOption[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "inactive") {
          prods.push({
            id: docSnap.id,
            name: data.name || "Product",
            price: Number(data.price) || 0,
            stock: Number(data.stock) ?? 0,
            barcode: data.barcode || "",
            category: data.category || "General",
            imageUrl: data.imageUrl || "/logo.png",
          });
        }
      });
      setAvailableProducts(prods);
    });
    return () => unsub();
  }, []);

  // ==========================================
  // TAB 1: SUPPLIERS ORDERS CALCULATIONS & ACTIONS
  // ==========================================
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter((ord) => {
      if (orderStatusFilter !== "all" && ord.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.supplierName.toLowerCase().includes(q) ||
        ord.supplierPhone.includes(q) ||
        ord.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [orders, searchQuery, orderStatusFilter]);

  const ordersKPI = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const received = orders.filter((o) => o.status === "received").length;
    const totalUnits = orders.reduce((acc, o) => acc + (o.totalQuantity || 0), 0);
    return { total, pending, received, totalUnits };
  }, [orders]);

  // Open Add Order Modal (Starts with empty selection without pre-selected product)
  const openAddOrderModal = (presetSupplierId?: string) => {
    if (suppliers.length === 0) {
      toast.warning("Please add at least one supplier first in the Suppliers tab.");
      setActiveTab("suppliers");
      setIsSupplierModalOpen(true);
      return;
    }

    setSelectedSupplierId(presetSupplierId || suppliers[0]?.id || "");
    // Start with 1 empty item row with NO pre-selected item and empty quantity
    setOrderItems([
      {
        productId: "",
        name: "",
        quantity: "",
      },
    ]);
    setOrderStatus("pending");
    setOrderNotes("");
    setIsOrderModalOpen(true);
  };

  // Add Item Row in Order Modal (prepends new items to the top with empty quantity)
  const addOrderItemRow = (count: number = 1) => {
    const newRows = Array.from({ length: count }, () => ({
      productId: "",
      name: "",
      quantity: "" as const,
    }));
    setOrderItems((prev) => [...newRows, ...prev]);
  };

  // Update Item in Order Modal (Item Name and Quantity only)
  const updateOrderItemRow = (
    index: number,
    field: "productId" | "quantity",
    val: any
  ) => {
    setOrderItems((prev) => {
      const next = [...prev];
      if (field === "productId") {
        const prod = availableProducts.find((p) => p.id === val);
        if (prod) {
          next[index] = {
            ...next[index],
            productId: prod.id,
            name: prod.name,
          };
        } else {
          next[index] = {
            ...next[index],
            productId: "",
            name: "",
          };
        }
      } else if (field === "quantity") {
        next[index] = {
          ...next[index],
          quantity: val === "" ? "" : Math.max(1, Number(val) || 1),
        };
      }
      return next;
    });
  };

  // Remove Item Row in Order Modal
  const removeOrderItemRow = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Supplier Order
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      toast.warning("Please select a supplier");
      return;
    }

    const validItems = orderItems.filter(
      (it) => it.productId && Number(it.quantity) > 0
    );
    if (validItems.length === 0) {
      toast.warning("Please select at least one product item with quantity");
      return;
    }

    const supplierObj = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplierObj) {
      toast.error("Selected supplier not found");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `PO-${dateStr}-${randomSuffix}`;

      const totalQuantity = validItems.reduce(
        (acc, it) => acc + (Number(it.quantity) || 0),
        0
      );

      const formattedItems: SupplierOrderItem[] = validItems.map((it) => ({
        productId: it.productId,
        name: it.name,
        quantity: Number(it.quantity) || 1,
      }));

      const orderData = {
        orderNumber,
        supplierId: supplierObj.id,
        supplierName: supplierObj.name,
        supplierPhone: supplierObj.phone,
        items: formattedItems,
        totalQuantity,
        status: orderStatus,
        notes: orderNotes.trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Create order in Firestore
      await addDoc(collection(db, "supplier_orders"), orderData);

      // 2. Increment supplier's total orders count
      await updateDoc(doc(db, "suppliers", supplierObj.id), {
        totalOrders: increment(1),
        updatedAt: serverTimestamp(),
      });

      // 3. If marked as 'received' right away, increment product stock in Firestore
      if (orderStatus === "received") {
        const batch = writeBatch(db);
        validItems.forEach((it) => {
          if (it.productId) {
            const prodRef = doc(db, "products", it.productId);
            batch.update(prodRef, {
              stock: increment(Number(it.quantity) || 1),
            });
          }
        });
        await batch.commit();
      }

      toast.success(
        `Supplier Order ${orderNumber} created successfully (${totalQuantity} units)${
          orderStatus === "received" ? " and stock updated!" : "!"
        }`
      );
      setIsOrderModalOpen(false);
    } catch (err: any) {
      console.error("Save order error:", err);
      toast.error("Failed to save order: " + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Mark Order as Received (increments inventory stock)
  const handleMarkOrderReceived = async (order: SupplierOrder) => {
    if (order.status === "received") return;
    if (
      confirm(
        `Mark order "${order.orderNumber}" as Received? This will automatically add ${order.totalQuantity} items to your stock.`
      )
    ) {
      try {
        // 1. Update order status
        await updateDoc(doc(db, "supplier_orders", order.id), {
          status: "received",
          updatedAt: serverTimestamp(),
        });

        // 2. Atomically increment inventory stock in Firestore
        const batch = writeBatch(db);
        order.items.forEach((it) => {
          if (it.productId) {
            const prodRef = doc(db, "products", it.productId);
            batch.update(prodRef, {
              stock: increment(it.quantity),
            });
          }
        });
        await batch.commit();

        toast.success(
          `Order ${order.orderNumber} marked as Received & stock updated!`
        );
      } catch (err: any) {
        console.error("Receive order error:", err);
        toast.error("Failed to receive order: " + err.message);
      }
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (confirm(`Are you sure you want to delete order "${orderNumber}"?`)) {
      try {
        await deleteDoc(doc(db, "supplier_orders", orderId));
        toast.success(`Order ${orderNumber} deleted.`);
      } catch (err: any) {
        toast.error("Error deleting order: " + err.message);
      }
    }
  };

  // Export Orders to Excel
  const handleExportOrdersExcel = () => {
    if (filteredOrders.length === 0) {
      toast.warning("No orders to export");
      return;
    }

    const data = filteredOrders.map((ord, idx) => ({
      "SL No": idx + 1,
      "Order Number": ord.orderNumber,
      "Supplier Name": ord.supplierName,
      "Supplier Phone": ord.supplierPhone,
      "Items Details": ord.items.map((it) => `${it.name} (${it.quantity})`).join(", "),
      "Total Quantity": ord.totalQuantity,
      "Status": ord.status.toUpperCase(),
      "Date": ord.createdAt?.toDate ? ord.createdAt.toDate().toLocaleString() : "—",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 25 },
      { wch: 18 },
      { wch: 35 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Supplier Orders");
    XLSX.writeFile(workbook, `supplier_orders_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredOrders.length} orders to Excel!`);
  };

  // ==========================================
  // TAB 2: SUPPLIERS CALCULATIONS & ACTIONS
  // ==========================================
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  // Open Supplier Modal
  const openSupplierModal = (sup?: Supplier) => {
    if (sup) {
      setEditingSupplier(sup);
      setSupplierName(sup.name);
      setSupplierPhone(sup.phone);
      setSupplierAddress(sup.address);
      setSupplierEmail(sup.email || "");
      setSupplierStatus(sup.status || "active");
    } else {
      setEditingSupplier(null);
      setSupplierName("");
      setSupplierPhone("");
      setSupplierAddress("");
      setSupplierEmail("");
      setSupplierStatus("active");
    }
    setIsSupplierModalOpen(true);
  };

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.warning("Please enter supplier name");
      return;
    }
    if (!supplierPhone.trim()) {
      toast.warning("Please enter supplier mobile number");
      return;
    }
    if (!supplierAddress.trim()) {
      toast.warning("Please enter supplier address");
      return;
    }

    setIsSubmittingSupplier(true);
    try {
      const supplierData = {
        name: supplierName.trim(),
        phone: supplierPhone.trim().replace(/\D/g, ""),
        address: supplierAddress.trim(),
        email: supplierEmail.trim() || "",
        status: supplierStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingSupplier) {
        await updateDoc(doc(db, "suppliers", editingSupplier.id), supplierData);
        toast.success(`Supplier "${supplierName.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "suppliers"), {
          ...supplierData,
          totalOrders: 0,
          createdAt: serverTimestamp(),
        });
        toast.success(`Supplier "${supplierName.trim()}" added successfully!`);
      }

      setIsSupplierModalOpen(false);
    } catch (err: any) {
      console.error("Save supplier error:", err);
      toast.error("Failed to save supplier: " + err.message);
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "suppliers", id));
        toast.success(`Supplier "${name}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting supplier: " + err.message);
      }
    }
  };

  // Export Suppliers to Excel
  const handleExportSuppliersExcel = () => {
    if (filteredSuppliers.length === 0) {
      toast.warning("No suppliers to export");
      return;
    }

    const data = filteredSuppliers.map((s, idx) => ({
      "SL No": idx + 1,
      "Supplier Name": s.name,
      "Mobile Number": s.phone,
      "Address": s.address,
      "Email Address": s.email || "—",
      "Total Orders": s.totalOrders || 0,
      "Status": s.status || "active",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 18 },
      { wch: 35 },
      { wch: 25 },
      { wch: 14 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suppliers");
    XLSX.writeFile(workbook, `suppliers_list_${Date.now()}.xlsx`);
    toast.success(`Exported ${filteredSuppliers.length} suppliers to Excel!`);
  };

  const activeSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card with Tabs */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Suppliers & Vendor Orders
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage vendor purchase orders, items restocking, and supplier contact directory.
          </p>
        </div>

        {/* Tab Buttons & Add Action */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[6px] border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("orders");
                setSearchQuery("");
              }}
              className={`px-3.5 h-[32px] rounded-[4px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Suppliers Orders</span>
              {orders.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "orders" ? "bg-white text-blue-700" : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {orders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("suppliers");
                setSearchQuery("");
              }}
              className={`px-3.5 h-[32px] rounded-[4px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "suppliers"
                  ? "bg-blue-600 text-white shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Suppliers</span>
              {suppliers.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === "suppliers" ? "bg-white text-blue-700" : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {suppliers.length}
                </span>
              )}
            </button>
          </div>

          {/* Action Button depending on active tab */}
          {activeTab === "orders" ? (
            <button
              type="button"
              onClick={() => openAddOrderModal()}
              className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Order</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openSupplierModal()}
              className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUPPLIERS ORDERS VIEW */}
      {/* ========================================================================= */}
      {activeTab === "orders" && (
        <>
          {/* Orders KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">Total Purchase Orders</p>
                <p className="text-2xl font-extrabold text-slate-900">{ordersKPI.total}</p>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">Pending Deliveries</p>
                <p className="text-2xl font-extrabold text-amber-600">{ordersKPI.pending}</p>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-[6px] border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">Received & Stocked</p>
                <p className="text-2xl font-extrabold text-emerald-600">{ordersKPI.received}</p>
              </div>
              <div className="w-10 h-10 rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Orders Table Container */}
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            {/* Search & Filter */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by order #, supplier name, phone, item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                <span className="text-xs font-semibold text-slate-500">Status:</span>
                <CustomSelect
                  value={orderStatusFilter}
                  onChange={(val) => setOrderStatusFilter(val)}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "pending", label: "Pending Orders" },
                    { value: "received", label: "Received Orders" },
                  ]}
                  className="w-40"
                />

                <button
                  type="button"
                  onClick={handleExportOrdersExcel}
                  className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loadingOrders ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-xs font-semibold">Loading orders from Firestore...</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No supplier orders found</p>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    {searchQuery
                      ? "Try changing your search query or status filter."
                      : "Create your first supplier purchase order to track restocking and deliveries."}
                  </p>
                  <button
                    type="button"
                    onClick={() => openAddOrderModal()}
                    className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Order</span>
                  </button>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Items & Quantities</th>
                      <th className="py-3 px-4 text-center">Total Quantity</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => {
                      const dateStr = ord.createdAt?.toDate
                        ? ord.createdAt.toDate().toLocaleDateString()
                        : "—";

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Order Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-xs">
                            {ord.orderNumber}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                            {dateStr}
                          </td>

                          {/* Supplier */}
                          <td className="py-3.5 px-4">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{ord.supplierName}</p>
                              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{ord.supplierPhone}</span>
                              </p>
                            </div>
                          </td>

                          {/* Items & Qty */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {ord.items.map((it, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200"
                                >
                                  <span>{it.name}</span>
                                  <span className="font-bold font-mono text-blue-700">×{it.quantity}</span>
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Total Quantity */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-extrabold text-xs border border-blue-100">
                              {ord.totalQuantity} units
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {ord.status === "received" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Received</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-300">
                                <Clock className="w-3 h-3" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {ord.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkOrderReceived(ord)}
                                  title="Mark as Received & Update Stock"
                                  className="h-[30px] px-2.5 inline-flex items-center gap-1 rounded-[5px] bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Receive</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setInspectOrder(ord)}
                                title="View PO Details"
                                className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(ord.id, ord.orderNumber)}
                                title="Delete Order"
                                className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUPPLIERS DIRECTORY VIEW */}
      {/* ========================================================================= */}
      {activeTab === "suppliers" && (
        <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          {/* Search Bar & Export */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by supplier name, mobile number, address, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleExportSuppliersExcel}
                className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Suppliers Table */}
          <div className="overflow-x-auto">
            {loadingSuppliers ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs font-semibold">Loading suppliers from Firestore...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <Truck className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No suppliers found</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {searchQuery
                    ? "Try searching with a different supplier name or mobile number."
                    : "Add your first supplier / vendor contact to place stock purchase orders."}
                </p>
                <button
                  type="button"
                  onClick={() => openSupplierModal()}
                  className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Supplier</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Orders Placed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[6px] bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{sup.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {sup.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{sup.phone}</span>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs max-w-sm">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{sup.address}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {sup.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{sup.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Orders Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100">
                          {sup.totalOrders || 0} Orders
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("orders");
                              openAddOrderModal(sup.id);
                            }}
                            title="Create Purchase Order for this Supplier"
                            className="h-[30px] px-2.5 inline-flex items-center gap-1 rounded-[5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openSupplierModal(sup)}
                            title="Edit Supplier"
                            className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                            title="Delete Supplier"
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT SUPPLIER MODAL */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingSupplier ? "Edit Supplier Details" : "Add New Supplier"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Supplier / Vendor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amul Dairy Distributors, ITC Supply"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
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
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Industrial Area Phase 2, Guntur, AP"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. orders@amuldist.com"
                  value={supplierEmail}
                  onChange={(e) => setSupplierEmail(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSupplier}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSupplier ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FULL-SCREEN PROFESSIONAL PURCHASE ORDER BUILDER MODAL */}
      {/* ========================================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-2xl w-full h-full max-w-[1500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Full-Screen Modal Top Bar */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Create Supplier Purchase Order</h2>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold font-mono">
                      {orderItems.filter((it) => it.productId).length} items •{" "}
                      {orderItems.reduce((acc, it) => acc + (it.productId ? (Number(it.quantity) || 0) : 0), 0)} units
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Fast product lookup via item name, barcode, or ID.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="h-[34px] w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-[6px] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - 2 Columns (Main Items Grid + Side Info Panel) */}
            <form onSubmit={handleSaveOrder} className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/50">
              {/* Left Column: Product Items Table (70% width) */}
              <div className="flex-1 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
                {/* Table Header Bar */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Order Items List
                    </h3>
                    <span className="px-2 py-0.5 rounded-[4px] bg-slate-200 text-slate-700 font-mono text-[11px] font-bold">
                      {orderItems.length} rows
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addOrderItemRow(1)}
                      className="h-[32px] px-3 rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addOrderItemRow(5)}
                      className="h-[32px] px-3 rounded-[6px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer"
                    >
                      <span>+5 Rows</span>
                    </button>
                  </div>
                </div>

                {/* Items Table Container */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                  {orderItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[8px] p-6 text-center">
                      <Package className="w-10 h-10 text-slate-300 mb-2" />
                      <p className="text-sm font-bold text-slate-700">No product items in order yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">
                        Click &quot;Add Product Row&quot; above to select products from your inventory.
                      </p>
                      <button
                        type="button"
                        onClick={() => addOrderItemRow(1)}
                        className="mt-4 h-[34px] px-4 rounded-[6px] bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add First Item</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-[8px] overflow-visible bg-white shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                            <th className="py-2.5 px-4 min-w-[320px]">Product Item (Search Name, Barcode, ID)</th>
                            <th className="py-2.5 px-4 w-48 text-center">Order Quantity</th>
                            <th className="py-2.5 px-3 w-16 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {orderItems.map((item, idx) => {
                            const prodObj = availableProducts.find((p) => p.id === item.productId);

                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                {/* Row Number */}
                                <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                                  {idx + 1}
                                </td>

                                {/* Product Selector with Name, Barcode, ID search */}
                                <td className="py-3 px-4">
                                  <CustomSelect
                                    value={item.productId}
                                    placeholder="Search by product name, barcode, or ID..."
                                    onChange={(val) => updateOrderItemRow(idx, "productId", val)}
                                    options={availableProducts.map((p) => ({
                                      value: p.id,
                                      label: p.name,
                                      subtext: p.barcode
                                        ? `Barcode: ${p.barcode} • ID: ${p.id.slice(0, 8)} • Stock: ${p.stock}`
                                        : `ID: ${p.id.slice(0, 8)} • Stock: ${p.stock}`,
                                      badge: `Stock: ${p.stock}`,
                                      searchTerms: `${p.name} ${p.barcode || ""} ${p.id}`.toLowerCase(),
                                    }))}
                                    searchable={true}
                                    className="w-full"
                                  />
                                </td>

                                {/* Quantity Input with Stepper */}
                                <td className="py-3 px-4 text-center">
                                  <div className="inline-flex items-center border border-slate-200 rounded-[6px] bg-slate-50 overflow-hidden shadow-2xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateOrderItemRow(
                                          idx,
                                          "quantity",
                                          Math.max(1, (Number(item.quantity) || 1) - 1)
                                        )
                                      }
                                      className="h-[34px] w-[32px] flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      required
                                      placeholder="Qty"
                                      value={item.quantity}
                                      onWheel={(e) => (e.target as HTMLElement).blur()}
                                      onChange={(e) => updateOrderItemRow(idx, "quantity", e.target.value)}
                                      className="w-20 h-[34px] text-center font-mono font-extrabold text-slate-900 bg-white border-x border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateOrderItemRow(
                                          idx,
                                          "quantity",
                                          (Number(item.quantity) || 0) + 1
                                        )
                                      }
                                      className="h-[34px] w-[32px] flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>

                                {/* Remove Row */}
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeOrderItemRow(idx)}
                                    title="Remove Row"
                                    className="h-[32px] w-[32px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[6px] transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Order Settings & Summary Sidebar (30% width / max-w-sm) */}
              <div className="w-full lg:w-[380px] bg-slate-50 border-t lg:border-t-0 border-slate-200 flex flex-col justify-between shrink-0 p-5 overflow-y-auto space-y-4">
                <div className="space-y-4">
                  {/* Supplier Info Card */}
                  <div className="bg-white p-4 rounded-[8px] border border-slate-200 shadow-2xs space-y-3">
                    <label className="block text-xs font-bold text-slate-900">
                      Supplier / Vendor <span className="text-red-500">*</span>
                    </label>
                    <CustomSelect
                      value={selectedSupplierId}
                      onChange={(val) => setSelectedSupplierId(val)}
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.phone})`,
                      }))}
                      searchable={true}
                      className="w-full"
                    />

                    {activeSupplier && (
                      <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-600">
                        <p className="font-bold text-slate-800 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{activeSupplier.name}</span>
                        </p>
                        <p className="flex items-center gap-1 font-mono text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{activeSupplier.phone}</span>
                        </p>
                        <p className="text-slate-500 text-[10px] leading-tight">
                          {activeSupplier.address}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Order Status */}
                  <div className="bg-white p-4 rounded-[8px] border border-slate-200 shadow-2xs space-y-2">
                    <label className="block text-xs font-bold text-slate-900">
                      Order Status
                    </label>
                    <CustomSelect
                      value={orderStatus}
                      onChange={(val) => setOrderStatus(val as any)}
                      options={[
                        { value: "pending", label: "Pending Delivery (Stock Not Added Yet)" },
                        { value: "received", label: "Received Immediately (Auto-Increment Stock)" },
                      ]}
                      className="w-full"
                    />
                  </div>

                  {/* Order Notes */}
                  <div className="bg-white p-4 rounded-[8px] border border-slate-200 shadow-2xs space-y-2">
                    <label className="block text-xs font-bold text-slate-900">
                      Order Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Urgent morning restock delivery batch"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                    />
                  </div>

                  {/* Order Summary Stats Card */}
                  <div className="bg-blue-50/80 border border-blue-200 rounded-[8px] p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-blue-900 font-medium">
                      <span>Total Distinct Items:</span>
                      <span className="font-bold font-mono">
                        {orderItems.filter((it) => it.productId).length} products
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-blue-950 font-extrabold text-sm border-t border-blue-200/60 pt-2">
                      <span>Total Restock Units:</span>
                      <span className="font-mono text-base font-black text-blue-700">
                        {orderItems.reduce((acc, it) => acc + (it.productId ? (Number(it.quantity) || 0) : 0), 0)} units
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Sticky Action Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="flex-1 h-[40px] px-4 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOrder}
                    className="flex-1 h-[40px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {isSubmittingOrder ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Order</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ORDER INSPECTION MODAL */}
      {/* ========================================================================= */}
      {inspectOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Purchase Order Details</h3>
                  <p className="text-[10px] font-mono text-slate-500">{inspectOrder.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Supplier Info */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-xs">{inspectOrder.supplierName}</p>
                  <p className="text-slate-500 font-mono">{inspectOrder.supplierPhone}</p>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      inspectOrder.status === "received"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {inspectOrder.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                    <th className="py-2">Item Name</th>
                    <th className="py-2 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectOrder.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-slate-800">{it.name}</td>
                      <td className="py-2 text-right font-bold text-blue-700 font-mono">
                        {it.quantity} units
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between text-sm font-extrabold text-slate-900">
                <span>Total Quantity:</span>
                <span className="font-mono text-blue-700">{inspectOrder.totalQuantity} units</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectOrder(null)}
                className="h-[34px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
