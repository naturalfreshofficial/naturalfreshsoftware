"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  where,
  getDocs,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer, Invoice, InvoiceItem } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Minus,
  Trash2,
  Bookmark,
  FileText,
  User,
  ArrowRight,
  Package,
  Check,
  X,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  FolderOpen,
  Store,
} from "lucide-react";
import { Branch } from "@/lib/types";

export interface POSProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  stock: number;
  bufferStock?: number;
  status: "active" | "inactive";
  imageUrl?: string;
  isFavorite?: boolean;
}

export interface POSCartItem {
  product: POSProduct;
  quantity: number;
}

export default function POSBillingView() {
  const toast = useToast();
  // Branches state from Firestore
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  // Mapping of `${productId}_${branchId}` -> quantity
  const [branchStockMap, setBranchStockMap] = useState<Record<string, number>>({});

  // Products & Categories dynamic state from Firestore
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(["All Categories"]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Customers dynamic state from Firestore
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  // Add Customer Form state
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Cart State (Initialized empty with NO static data)
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash" | "Card">("UPI");

  // Drafts & Completed Invoices
  const [draftBills, setDraftBills] = useState<Invoice[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Checkout / Receipt Modal
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // 1. Subscribe to Branches in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branches"), (snapshot) => {
      const bList: Branch[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status !== "inactive") {
          bList.push({ id: docSnap.id, ...d } as Branch);
        }
      });
      bList.sort((a, b) => a.name.localeCompare(b.name));
      setBranches(bList);

      // Auto select saved or first branch
      const savedBranch = typeof window !== "undefined" ? localStorage.getItem("pos_selected_branch_id") : null;
      if (savedBranch && bList.some((b) => b.id === savedBranch)) {
        setSelectedBranchId(savedBranch);
      } else if (bList.length > 0) {
        setSelectedBranchId(bList[0].id);
      }
    });
    return () => unsub();
  }, []);

  // 2. Subscribe to Branch Stocks in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "branch_stocks"), (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.productId && d.branchId) {
          map[`${d.productId}_${d.branchId}`] = Number(d.quantity) || 0;
        }
      });
      setBranchStockMap(map);
    });
    return () => unsub();
  }, []);

  // 3. Subscribe to Products in Firestore
  useEffect(() => {
    setLoadingProducts(true);
    const unsub = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const items: POSProduct[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== "inactive") {
            items.push({
              id: docSnap.id,
              name: data.name || "Unnamed Product",
              barcode: data.barcode || "",
              category: data.category || "General",
              price: Number(data.price) || 0,
              stock: Number(data.stock) ?? 0,
              bufferStock: Number(data.bufferStock) ?? 0,
              status: data.status || "active",
              imageUrl: data.imageUrl || "/logo.png",
              isFavorite: Boolean(data.isFavorite),
            });
          }
        });
        setProducts(items);
        setLoadingProducts(false);
      },
      (err) => {
        console.error("POS products sync error:", err);
        setLoadingProducts(false);
      }
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Categories in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snapshot) => {
      const catList: string[] = ["All Categories"];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name && !catList.includes(data.name)) {
          catList.push(data.name);
        }
      });
      setCategories(catList);
    });
    return () => unsub();
  }, []);

  // 3. Subscribe to Customers in Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "customers"), (snapshot) => {
      const custs: Customer[] = [];
      snapshot.forEach((docSnap) => {
        custs.push({ id: docSnap.id, ...docSnap.data() } as Customer);
      });
      setCustomers(custs);
    });
    return () => unsub();
  }, []);

  // 4. Subscribe to Draft Bills in Firestore (status === "draft")
  useEffect(() => {
    const q = query(
      collection(db, "invoices"),
      where("status", "==", "draft")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const drafts: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          drafts.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
        });
        setDraftBills(drafts);
      },
      (err) => {
        console.warn("Drafts sync warning:", err);
      }
    );
    return () => unsub();
  }, []);

  // Branch helpers
  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_selected_branch_id", branchId);
    }
  };

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || null;
  }, [branches, selectedBranchId]);

  const getProductStockForSelectedBranch = (productId: string, fallbackStock: number): number => {
    if (!selectedBranchId) return fallbackStock;
    const key = `${productId}_${selectedBranchId}`;
    return branchStockMap[key] !== undefined ? branchStockMap[key] : 0;
  };

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered Products for Display
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All Categories" || product.category === selectedCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Matching Customers for Auto-complete
  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return customers.slice(0, 8);
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, customerSearchQuery]);

  // Cart Quantities Map (for fast lookup to show active view in grid)
  const cartQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      map.set(item.product.id, item.quantity);
    });
    return map;
  }, [cart]);

  // Cart Actions with branch stock check
  const addToCart = (product: POSProduct) => {
    const availableStock = getProductStockForSelectedBranch(product.id, product.stock);
    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (availableStock <= 0) {
      toast.warning(`"${product.name}" is OUT OF STOCK at ${selectedBranch?.name || "this branch"}.`);
      return;
    }

    if (currentQty + 1 > availableStock) {
      toast.warning(`Cannot add more. Only ${availableStock} units available at ${selectedBranch?.name || "this branch"}.`);
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const itemInCart = cart.find((item) => item.product.id === productId);
    if (!itemInCart) return;

    if (delta > 0) {
      const availableStock = getProductStockForSelectedBranch(productId, itemInCart.product.stock);
      if (itemInCart.quantity + delta > availableStock) {
        toast.warning(`Cannot add more. Only ${availableStock} units available at ${selectedBranch?.name || "this branch"}.`);
        return;
      }
    }

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountPercent(0);
    setNote("");
    setActiveDraftId(null);
  };

  // Calculations
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstTax = taxableAmount * 0.05; // 5% standard GST
  const totalPayable = taxableAmount + gstTax;

  // Save new Customer and auto-select
  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.warning("Please enter customer name");
      return;
    }
    if (!newCustPhone.trim()) {
      toast.warning("Please enter customer mobile number");
      return;
    }

    setIsSavingCustomer(true);
    try {
      const newCustData = {
        name: newCustName.trim(),
        phone: newCustPhone.trim().replace(/\D/g, ""),
        email: newCustEmail.trim() || "",
        address: newCustAddress.trim() || "",
        totalOrders: 0,
        totalSpent: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "customers"), newCustData);
      const createdCust: Customer = { id: docRef.id, ...newCustData };

      // Auto-select this newly created customer!
      setSelectedCustomer(createdCust);
      setCustomerSearchQuery("");
      setIsCustomerDropdownOpen(false);
      setIsAddCustomerModalOpen(false);
      toast.success(`Customer "${createdCust.name}" added & selected!`);

      // Reset form
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustAddress("");
    } catch (err: any) {
      console.error("Save customer error:", err);
      toast.error("Failed to save customer: " + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Generate Unique Invoice Number
  const generateInvoiceNumber = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${dateStr}-${randomSuffix}`;
  };

  // SAVE TO DRAFT (Hold Bill)
  const handleSaveToDraft = async () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty. Please add products before saving as draft.");
      return;
    }

    if (!selectedCustomer) {
      toast.warning("Customer selection is mandatory! Please select or add a customer.");
      setIsCustomerDropdownOpen(true);
      return;
    }

    setIsSubmittingBill(true);
    try {
      const invoiceItems: InvoiceItem[] = cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        barcode: item.product.barcode,
        imageUrl: item.product.imageUrl || "/logo.png",
        total: item.product.price * item.quantity,
      }));

      const draftData: Partial<Invoice> = {
        invoiceNumber: activeDraftId ? draftBills.find((d) => d.id === activeDraftId)?.invoiceNumber || generateInvoiceNumber() : generateInvoiceNumber(),
        customer: {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          phone: selectedCustomer.phone,
          email: selectedCustomer.email || "",
          address: selectedCustomer.address || "",
        },
        items: invoiceItems,
        itemCount: totalItemsCount,
        subtotal,
        discountPercent,
        discountAmount,
        taxableAmount,
        taxPercent: 5,
        taxAmount: gstTax,
        totalPayable,
        paymentMethod,
        status: "draft", // Will NOT count towards completed sales reports
        note: note.trim() || "",
        updatedAt: serverTimestamp(),
      };

      if (activeDraftId) {
        // Update existing draft
        await updateDoc(doc(db, "invoices", activeDraftId), draftData as any);
        toast.success("Draft bill updated successfully!");
      } else {
        // Create new draft
        await addDoc(collection(db, "invoices"), {
          ...draftData,
          createdAt: serverTimestamp(),
        });
        toast.success("Bill saved to drafts! You can resume it anytime from 'Saved Draft Bills'.");
      }

      clearCart();
    } catch (err: any) {
      console.error("Save draft error:", err);
      toast.error("Failed to save draft: " + err.message);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // LOAD SAVED DRAFT BILL
  const handleLoadDraftBill = (draft: Invoice) => {
    // 1. Reconstruct cart items with product objects
    const restoredCart: POSCartItem[] = draft.items.map((item) => {
      const existingProduct = products.find((p) => p.id === item.productId);
      return {
        product: existingProduct || {
          id: item.productId,
          name: item.name,
          price: item.price,
          barcode: item.barcode || "",
          category: "General",
          stock: 99,
          status: "active",
          imageUrl: item.imageUrl || "/logo.png",
        },
        quantity: item.quantity,
      };
    });

    setCart(restoredCart);
    setDiscountPercent(draft.discountPercent || 0);
    setNote(draft.note || "");
    setPaymentMethod(draft.paymentMethod || "UPI");
    setActiveDraftId(draft.id);

    // 2. Set customer
    if (draft.customer) {
      setSelectedCustomer({
        id: draft.customer.id || "",
        name: draft.customer.name,
        phone: draft.customer.phone,
        email: draft.customer.email,
        address: draft.customer.address,
      });
    }

    setIsDraftsModalOpen(false);
    toast.info(`Loaded draft bill (${draft.invoiceNumber}) into cart.`);
  };

  // DELETE DRAFT BILL
  const handleDeleteDraftBill = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this saved draft bill?")) {
      try {
        await deleteDoc(doc(db, "invoices", draftId));
        if (activeDraftId === draftId) {
          setActiveDraftId(null);
        }
        toast.success("Draft bill deleted.");
      } catch (err: any) {
        toast.error("Error deleting draft: " + err.message);
      }
    }
  };

  // COMPLETE SALE / PROCEED TO PAYMENT
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty! Click products on the left to add items.");
      return;
    }

    if (!selectedCustomer) {
      toast.warning("Customer selection is MANDATORY. Please search or add customer in Order Summary before checkout.");
      setIsCustomerDropdownOpen(true);
      return;
    }

    setIsSubmittingBill(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const invoiceItems: InvoiceItem[] = cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        barcode: item.product.barcode,
        imageUrl: item.product.imageUrl || "/logo.png",
        total: item.product.price * item.quantity,
      }));

      const invoiceData = {
        invoiceNumber,
        branchId: selectedBranch?.id || "",
        branchName: selectedBranch?.name || "Main Store",
        customer: {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          phone: selectedCustomer.phone,
          email: selectedCustomer.email || "",
          address: selectedCustomer.address || "",
        },
        items: invoiceItems,
        itemCount: totalItemsCount,
        subtotal,
        discountPercent,
        discountAmount,
        taxableAmount,
        taxPercent: 5,
        taxAmount: gstTax,
        totalPayable,
        paymentMethod,
        status: "completed",
        note: note.trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Create completed invoice
      const invoiceRef = await addDoc(collection(db, "invoices"), invoiceData);

      // 2. If it was an existing draft, delete the old draft record
      if (activeDraftId) {
        try {
          await deleteDoc(doc(db, "invoices", activeDraftId));
        } catch (e) {
          console.warn("Draft cleanup error:", e);
        }
      }

      // 3. Atomically decrement stock in Firestore branch_stocks and products
      try {
        const batch = writeBatch(db);
        cart.forEach((item) => {
          if (item.product.id) {
            // Decrement total product stock
            const prodRef = doc(db, "products", item.product.id);
            batch.update(prodRef, {
              stock: increment(-item.quantity),
            });

            // Decrement specific branch stock
            if (selectedBranch?.id) {
              const branchStockRef = doc(db, "branch_stocks", `${item.product.id}_${selectedBranch.id}`);
              batch.set(
                branchStockRef,
                {
                  productId: item.product.id,
                  productName: item.product.name,
                  branchId: selectedBranch.id,
                  branchName: selectedBranch.name,
                  quantity: increment(-item.quantity),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
          }
        });
        await batch.commit();
      } catch (stockErr) {
        console.warn("Stock decrement warning:", stockErr);
      }

      // 4. Update customer stats
      if (selectedCustomer.id) {
        try {
          await updateDoc(doc(db, "customers", selectedCustomer.id), {
            totalOrders: increment(1),
            totalSpent: increment(totalPayable),
            updatedAt: serverTimestamp(),
          });
        } catch (custErr) {
          console.warn("Customer stat update warning:", custErr);
        }
      }

      // Set completed invoice for receipt modal
      setCompletedInvoice({
        id: invoiceRef.id,
        ...invoiceData,
        createdAt: new Date(),
      } as any);
      setIsReceiptModalOpen(true);
      toast.success(`Sale completed! Invoice ${invoiceNumber} created.`);

      // Reset cart for next customer
      clearCart();
    } catch (err: any) {
      console.error("Complete sale error:", err);
      toast.error("Failed to complete sale: " + err.message);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col lg:flex-row gap-4 p-4 lg:p-6 max-w-[1700px] mx-auto">
      {/* ========================================================================= */}
      {/* LEFT / CENTER: Dynamic Product Catalog Browser */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-[6px] border border-slate-200 shadow-xs">
        {/* Top Outlet / Branch Selector Bar */}
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-t-[6px] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[6px] bg-blue-600 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Active Billing Outlet</p>
              <p className="text-sm font-bold text-white truncate">{selectedBranch?.name || "Main Store"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-300 whitespace-nowrap font-medium">Switch Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="h-[34px] px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-[5px] text-xs font-bold border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-56"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  📍 {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="border-b border-slate-200 px-4 md:px-6 flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-none h-[48px] bg-slate-50/50">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-full flex items-center text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors relative cursor-pointer ${
                  isSelected ? "text-blue-600 font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat}
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-[2px]"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter and Search Bar Row */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[6px] border border-slate-200 h-[36px]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`h-[30px] w-[30px] flex items-center justify-center rounded-[4px] transition-colors cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`h-[30px] w-[30px] flex items-center justify-center rounded-[4px] transition-colors cursor-pointer ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Grid / List Display */}
        <div className="p-4 md:p-6">
          {loadingProducts ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs font-semibold">Loading catalog from Firestore...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Package className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No products match your criteria</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {searchQuery
                  ? "Try changing your search term or select another category."
                  : "Add products in the Products page or allocate stock in Stock Assignment."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredProducts.map((product) => {
                const inCartQty = cartQuantities.get(product.id) || 0;
                const isSelectedInCart = inCartQty > 0;
                const branchStock = getProductStockForSelectedBranch(product.id, product.stock);
                const isOutOfStock = branchStock <= 0;
                const isLowStock = branchStock > 0 && branchStock <= (product.bufferStock || 5);

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`group bg-white rounded-[6px] border transition-all duration-150 p-3.5 flex flex-col justify-between cursor-pointer relative ${
                      isOutOfStock
                        ? "border-slate-200 bg-slate-50/60 opacity-75"
                        : isSelectedInCart
                        ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/10 shadow-xs"
                        : "border-slate-200/90 hover:border-blue-400 hover:shadow-2xs"
                    }`}
                  >
                    {/* Active In-Cart Badge */}
                    {isSelectedInCart && (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-2">
                        <Check className="w-3 h-3" />
                        <span>In Cart: {inCartQty}</span>
                      </div>
                    )}

                    {/* Product Image Thumbnail */}
                    <div className="h-28 bg-slate-50 rounded-[4px] flex items-center justify-center mb-2.5 p-2 overflow-hidden border border-slate-100 relative">
                      <img
                        src={product.imageUrl || "/logo.png"}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/logo.png";
                        }}
                      />
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                          <span className="px-2 py-0.5 bg-red-600 text-white font-bold text-[10px] rounded-[3px]">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-extrabold text-slate-900">
                          ₹ {Number(product.price).toFixed(2)}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {product.barcode.slice(-5) || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Category tag & Branch Stock info */}
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                      <span className="truncate max-w-[90px] font-medium">{product.category}</span>
                      <span
                        className={
                          isOutOfStock
                            ? "text-red-600 font-extrabold"
                            : isLowStock
                            ? "text-amber-600 font-bold"
                            : "text-slate-700 font-semibold"
                        }
                      >
                        {isOutOfStock ? "Out of Stock" : `Stock: ${branchStock} units`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const inCartQty = cartQuantities.get(product.id) || 0;
                const isSelectedInCart = inCartQty > 0;
                const branchStock = getProductStockForSelectedBranch(product.id, product.stock);
                const isOutOfStock = branchStock <= 0;
                const isLowStock = branchStock > 0 && branchStock <= (product.bufferStock || 5);

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`flex items-center justify-between p-3 bg-white rounded-[6px] border transition-all cursor-pointer ${
                      isOutOfStock
                        ? "border-slate-200 bg-slate-50/60 opacity-75"
                        : isSelectedInCart
                        ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/10"
                        : "border-slate-200 hover:border-blue-400 hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-50 rounded-[4px] border border-slate-100 flex items-center justify-center shrink-0 p-1">
                        <img
                          src={product.imageUrl || "/logo.png"}
                          alt={product.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png";
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{product.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span>{product.category}</span>
                          <span>•</span>
                          <span className="font-mono">{product.barcode || "No Barcode"}</span>
                          <span>•</span>
                          <span
                            className={
                              isOutOfStock
                                ? "text-red-600 font-extrabold"
                                : isLowStock
                                ? "text-amber-600 font-bold"
                                : "text-slate-600 font-semibold"
                            }
                          >
                            {isOutOfStock ? "Out of Stock" : `Stock: ${branchStock} units`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-extrabold text-slate-900">
                        ₹ {Number(product.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`h-[32px] px-3 text-xs font-bold rounded-[5px] transition-colors ${
                          isOutOfStock
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : isSelectedInCart
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                        }`}
                      >
                        {isOutOfStock ? "Unavailable" : isSelectedInCart ? `In Cart (${inCartQty})` : "+ Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT: Order Summary & Checkout Panel */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[420px] bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col shrink-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
            {activeDraftId && (
              <span className="px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-800 text-[10px] font-bold">
                Editing Draft
              </span>
            )}
          </div>

          {/* Saved Draft Bills Button */}
          <button
            type="button"
            onClick={() => setIsDraftsModalOpen(true)}
            title="View saved draft bills"
            className="h-[34px] flex items-center gap-1.5 px-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-[6px] shadow-2xs transition-colors cursor-pointer relative"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Drafts</span>
            {draftBills.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                {draftBills.length}
              </span>
            )}
          </button>
        </div>

        {/* CUSTOMER SELECTION BAR (MANDATORY REQUIREMENT) */}
        <div className="p-4 border-b border-slate-100 bg-white relative" ref={customerDropdownRef}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>Customer</span>
              <span className="text-red-500">* (Mandatory)</span>
            </label>
            <button
              type="button"
              onClick={() => setIsAddCustomerModalOpen(true)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add New Customer</span>
            </button>
          </div>

          {selectedCustomer ? (
            /* Selected Customer Active Card */
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-[6px] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">{selectedCustomer.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" />
                    <span>{selectedCustomer.phone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                title="Change Customer"
                className="h-[28px] px-2 text-[11px] font-semibold text-slate-600 hover:text-red-600 hover:bg-white rounded-[4px] transition-colors cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            /* Customer Search Input & Dropdown */
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-[36px] flex items-center gap-2 px-3 bg-slate-50 border border-slate-300 focus-within:border-blue-500 focus-within:bg-white rounded-[6px] transition-all">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by Mobile No or Name..."
                    value={customerSearchQuery}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(true)}
                  title="Add Customer"
                  className="h-[36px] px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>

              {/* Customer Auto-complete Dropdown Menu */}
              {isCustomerDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-[6px] shadow-xl z-20 max-h-56 overflow-y-auto divide-y divide-slate-100 scrollbar-thin animate-in fade-in zoom-in-95 duration-100">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      <p>No customer found matching &quot;{customerSearchQuery}&quot;</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustPhone(customerSearchQuery.replace(/\D/g, ""));
                          setNewCustName(customerSearchQuery.replace(/[0-9]/g, ""));
                          setIsCustomerDropdownOpen(false);
                          setIsAddCustomerModalOpen(true);
                        }}
                        className="mt-2 text-xs font-bold text-blue-600 hover:underline"
                      >
                        + Create customer &quot;{customerSearchQuery}&quot;
                      </button>
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearchQuery("");
                        }}
                        className="p-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{cust.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{cust.phone}</p>
                        </div>
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-[4px]">
                          Select
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Items Header */}
        <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 grid grid-cols-12 text-[11px] font-semibold text-slate-400">
          <div className="col-span-5">Item</div>
          <div className="col-span-3 text-center">Qty</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">Total</div>
        </div>

        {/* Cart Items List */}
        <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center text-slate-400 text-center">
              <Package className="w-8 h-8 text-slate-300 mb-1.5" />
              <p className="text-xs font-semibold text-slate-600">Cart is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Click any product to add to bill</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = item.product.price * item.quantity;
              return (
                <div
                  key={item.product.id}
                  className="grid grid-cols-12 items-center gap-1 text-xs text-slate-800 border-b border-slate-100 pb-2.5"
                >
                  {/* Item info */}
                  <div className="col-span-5 flex items-center gap-2 min-w-0 pr-1">
                    <div className="w-7 h-7 bg-slate-50 rounded-[4px] border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                      <img
                        src={item.product.imageUrl || "/logo.png"}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/logo.png";
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{item.product.barcode || "—"}</p>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="col-span-3 flex items-center justify-center">
                    <div className="h-[30px] flex items-center border border-slate-200 rounded-[5px] bg-white overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="h-full px-1.5 hover:bg-slate-100 text-slate-500 cursor-pointer flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 text-xs font-bold text-slate-800 min-w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="h-full px-1.5 hover:bg-slate-100 text-slate-500 cursor-pointer flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 text-right font-medium text-slate-600 text-[11px]">
                    ₹ {Number(item.product.price).toFixed(2)}
                  </div>

                  {/* Total & Trash */}
                  <div className="col-span-2 flex items-center justify-end gap-1 text-right font-bold text-slate-900 text-xs">
                    <span>₹ {itemTotal.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="h-[24px] w-[24px] flex items-center justify-center text-slate-300 hover:text-red-500 rounded-[4px] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Add Note Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                const promptNote = window.prompt("Enter bill / invoice note:", note);
                if (promptNote !== null) setNote(promptNote);
              }}
              className="h-[30px] flex items-center gap-1.5 px-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-[4px] transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{note ? `Note: ${note}` : "+ Add note to invoice"}</span>
            </button>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 font-medium">
            <span>Subtotal ({totalItemsCount} Items)</span>
            <span className="font-bold text-slate-800">₹ {subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-2">
              <span>Discount</span>
              <div className="h-[28px] flex items-center bg-white border border-slate-200 rounded-[4px] px-1.5 text-[11px]">
                <span className="text-slate-400 font-semibold">%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="w-8 text-right font-bold text-slate-800 focus:outline-none ml-1"
                />
              </div>
            </div>
            <span className="font-bold text-red-500">- ₹ {discountAmount.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600 font-medium">
            <span>GST Tax (5%)</span>
            <span className="font-bold text-slate-800">₹ {gstTax.toFixed(2)}</span>
          </div>

          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Total Payable</span>
            <span className="text-lg font-black text-slate-950">₹ {totalPayable.toFixed(2)}</span>
          </div>
        </div>

        {/* PAYMENT METHOD SELECTION & CHECKOUT ACTIONS */}
        <div className="p-4 border-t border-slate-100 space-y-3.5 bg-white">
          {/* Payment Mode Selector: UPI / Cash / Card */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* UPI */}
              <button
                type="button"
                onClick={() => setPaymentMethod("UPI")}
                className={`h-[42px] px-2 rounded-[6px] border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === "UPI"
                    ? "border-blue-600 bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-500"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>UPI</span>
              </button>

              {/* Cash */}
              <button
                type="button"
                onClick={() => setPaymentMethod("Cash")}
                className={`h-[42px] px-2 rounded-[6px] border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === "Cash"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs ring-1 ring-emerald-500"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Cash</span>
              </button>

              {/* Card */}
              <button
                type="button"
                onClick={() => setPaymentMethod("Card")}
                className={`h-[42px] px-2 rounded-[6px] border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  paymentMethod === "Card"
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs ring-1 ring-indigo-500"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Card</span>
              </button>
            </div>
          </div>

          {/* Action Buttons: Save to Draft & Proceed to Payment */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSaveToDraft}
              disabled={isSubmittingBill || cart.length === 0}
              className="h-[40px] flex items-center justify-center gap-1.5 px-3 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-[6px] text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Bookmark className="w-4 h-4 text-amber-600" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={isSubmittingBill || cart.length === 0}
              className="h-[40px] flex items-center justify-center gap-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmittingBill ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Complete Sale</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {cart.length > 0 && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
              >
                Clear Cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD CUSTOMER MODAL */}
      {/* ========================================================================= */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
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
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@gmail.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Address / City <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Main Bazaar, Guntur, AP"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingCustomer ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save & Select Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SAVED DRAFT BILLS MODAL */}
      {/* ========================================================================= */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-amber-500 text-white flex items-center justify-center">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Saved Draft Bills ({draftBills.length})</h3>
                  <p className="text-[11px] text-slate-500">
                    Drafts are held bills not counted in completed sales revenue.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto divide-y divide-slate-100 scrollbar-thin text-xs">
              {draftBills.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center">
                  <Bookmark className="w-8 h-8 text-slate-300 mb-1.5" />
                  <p className="text-sm font-semibold text-slate-700">No saved drafts</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click &quot;Save as Draft&quot; on the POS screen to hold an unfinished sale.
                  </p>
                </div>
              ) : (
                draftBills.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => handleLoadDraftBill(draft)}
                    className="py-3 px-3 hover:bg-blue-50/80 rounded-[6px] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{draft.invoiceNumber}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-[3px]">
                          Draft
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-semibold">
                        Customer: {draft.customer?.name} ({draft.customer?.phone})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {draft.items?.length || 0} Products • Payment Mode: {draft.paymentMethod}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-slate-900">
                          ₹ {Number(draft.totalPayable).toFixed(2)}
                        </p>
                        <span className="text-[10px] text-blue-600 font-bold hover:underline">
                          Resume Bill →
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDraftBill(e, draft.id)}
                        title="Delete draft"
                        className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                className="h-[34px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INVOICE / RECEIPT MODAL AFTER COMPLETION */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-100" />
                <h3 className="text-base font-bold">Sale Completed Successfully!</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="h-[32px] w-[32px] flex items-center justify-center text-white/80 hover:text-white rounded-[6px] hover:bg-emerald-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Receipt Area */}
            <div id="pos-printable-receipt" className="p-6 space-y-4 text-xs bg-white text-slate-800">
              {/* Store Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="w-12 h-12 mx-auto mb-1 rounded-[6px] overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">NATURAL FRESH</h4>
                <p className="text-[11px] font-bold text-blue-700">
                  Outlet: {completedInvoice.branchName || selectedBranch?.name || "Main Store"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {selectedBranch?.address || "Guntur, Andhra Pradesh"}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">GSTIN: 37AAAAA0000A1Z5</p>
              </div>

              {/* Invoice Metadata */}
              <div className="flex items-center justify-between text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div>
                  <p className="font-bold text-slate-900 font-mono">{completedInvoice.invoiceNumber}</p>
                  <p className="text-slate-500">Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{completedInvoice.customer?.name}</p>
                  <p className="text-slate-500 font-mono">{completedInvoice.customer?.phone}</p>
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
                  {completedInvoice.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-medium text-slate-800">{it.name}</td>
                      <td className="py-1.5 text-center text-slate-600">{it.quantity}</td>
                      <td className="py-1.5 text-right text-slate-600">₹{it.price.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-bold text-slate-900">₹{it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculations Breakdown */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹ {completedInvoice.subtotal.toFixed(2)}</span>
                </div>
                {completedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({completedInvoice.discountPercent}%)</span>
                    <span>- ₹ {completedInvoice.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>GST Tax (5%)</span>
                  <span className="font-semibold">₹ {completedInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-extrabold text-slate-950">
                  <span>Total Amount Paid</span>
                  <span>₹ {completedInvoice.totalPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-blue-600 uppercase">{completedInvoice.paymentMethod}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-dashed border-slate-200">
                <p>Thank you for shopping with us!</p>
                <p>Please visit again.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="h-[36px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
