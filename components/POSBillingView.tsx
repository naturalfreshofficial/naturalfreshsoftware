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
import { Customer, Invoice, InvoiceItem, ProductVariant, Branch } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/lib/AuthContext";
import { usePrinter } from "@/lib/PrinterContext";
import { getItemKgWeight, formatKgStock, getApproximateScoops } from "@/lib/stockUtils";
import { getItemDisplayName, getReceiptItemName } from "@/lib/escpos";
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
  ShoppingBag,
  Layers,
  Tag,
  Sparkles,
} from "lucide-react";

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
  hasVariations?: boolean;
  variants?: ProductVariant[];
}

export interface POSCartItem {
  cartItemId: string; // `${product.id}_${variant?.name || 'base'}_${mixKey}`
  product: POSProduct;
  variant?: ProductVariant;
  quantity: number;
  mixItems?: string[];
}

export default function POSBillingView() {
  const toast = useToast();
  const { user, selectedBranchId: authBranchId, setSelectedBranchId: setAuthBranchId } = useAuth();
  const printer = usePrinter();
  
  // Branches state from Firestore
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  // Mapping of `${productId}_${branchId}` -> quantity
  const [branchStockMap, setBranchStockMap] = useState<Record<string, number>>({});

  // Strictly filter branches accessible to the logged-in user
  const availableBranches = useMemo(() => {
    if (!user || user.role === "super_admin") {
      return branches;
    }
    return branches.filter((b) => user.branchIds?.includes(b.id));
  }, [branches, user]);

  // Sync selected branch with available branches and auth context
  useEffect(() => {
    if (availableBranches.length > 0) {
      if (authBranchId && availableBranches.some((b) => b.id === authBranchId)) {
        setSelectedBranchId(authBranchId);
      } else if (!availableBranches.some((b) => b.id === selectedBranchId)) {
        const fallbackId = availableBranches[0].id;
        setSelectedBranchId(fallbackId);
        setAuthBranchId(fallbackId);
      }
    }
  }, [availableBranches, authBranchId, selectedBranchId, setAuthBranchId]);

  // Products & Categories dynamic state from Firestore
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(["All Categories"]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Variation Selection Modal State
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<POSProduct | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  // Mix Category Item Selection Modal State
  const [selectedProductForMix, setSelectedProductForMix] = useState<POSProduct | null>(null);
  const [selectedMixVariant, setSelectedMixVariant] = useState<ProductVariant | undefined>(undefined);
  const [selectedMixItemNames, setSelectedMixItemNames] = useState<string[]>([]);
  const [mixSearchQuery, setMixSearchQuery] = useState("");
  const [isMixModalOpen, setIsMixModalOpen] = useState(false);
  const [editingMixCartItemId, setEditingMixCartItemId] = useState<string | null>(null);

  // Helper to detect Mix Category product
  const isMixProduct = (category: string) => {
    const cat = (category || "").trim().toLowerCase();
    return cat === "mix" || cat === "mixes" || cat === "mixed" || cat.includes("mix");
  };

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
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash" | "Card" | "Split">("UPI");
  const [splitCash, setSplitCash] = useState<number | "">("");
  const [splitUpi, setSplitUpi] = useState<number | "">("");
  const [splitCard, setSplitCard] = useState<number | "">("");

  // Drafts & Completed Invoices
  const [draftBills, setDraftBills] = useState<Invoice[]>([]);
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Checkout / Receipt Modal
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);

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
              hasVariations: Boolean(data.hasVariations),
              variants: Array.isArray(data.variants) ? data.variants : [],
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

  // 4. Subscribe to Categories in Firestore
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

  // 5. Subscribe to Customers in Firestore
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

  // 6. Subscribe to Draft Bills in Firestore (status === "draft")
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
    setAuthBranchId(branchId);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_selected_branch_id", branchId);
    }
  };

  const selectedBranch = useMemo(() => {
    return availableBranches.find((b) => b.id === selectedBranchId) || availableBranches[0] || null;
  }, [availableBranches, selectedBranchId]);

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
        product.barcode.includes(searchQuery) ||
        (product.hasVariations &&
          product.variants?.some((v) =>
            v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.barcode && v.barcode.includes(searchQuery))
          ));
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

  // Total in-cart count per product (sum across all variants)
  const cartProductQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      const current = map.get(item.product.id) || 0;
      map.set(item.product.id, current + item.quantity);
    });
    return map;
  }, [cart]);

  // In-cart count per specific cart item (product + variant combo)
  const cartItemQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      map.set(item.cartItemId, item.quantity);
    });
    return map;
  }, [cart]);

  // Cart Actions with branch stock check and variation support
  const addToCart = (product: POSProduct, variant?: ProductVariant, mixItems?: string[]) => {
    // 1. If product has variations and no specific variant is passed, open variant modal!
    if (!variant && product.hasVariations && product.variants && product.variants.length > 0) {
      setSelectedProductForVariants(product);
      setIsVariantModalOpen(true);
      return;
    }

    // 2. If product belongs to Mix category and no mix items chosen yet, open Mix Selection Modal!
    if (isMixProduct(product.category) && (!mixItems || mixItems.length === 0)) {
      setSelectedProductForMix(product);
      setSelectedMixVariant(variant);
      setSelectedMixItemNames([]);
      setMixSearchQuery("");
      setEditingMixCartItemId(null);
      setIsMixModalOpen(true);
      return;
    }

    const availableStockKg = getProductStockForSelectedBranch(product.id, product.stock);
    const mixKey = mixItems && mixItems.length > 0 ? `_mix_${[...mixItems].sort().join(",")}` : "";
    const cartItemId = variant ? `${product.id}_${variant.name}${mixKey}` : `${product.id}${mixKey}`;
    const existing = cart.find((item) => item.cartItemId === cartItemId);
    
    // Calculate total KG of this product currently in cart across all variants
    const currentTotalProductKgInCart = cart
      .filter((item) => item.product.id === product.id)
      .reduce((sum, item) => sum + getItemKgWeight(item.variant?.name, item.variant?.weightInKg) * item.quantity, 0);

    const requiredItemKg = getItemKgWeight(variant?.name, variant?.weightInKg);

    if (availableStockKg <= 0) {
      toast.warning(`"${product.name}" is OUT OF STOCK at ${selectedBranch?.name || "this branch"}.`);
      return;
    }

    if (currentTotalProductKgInCart + requiredItemKg > availableStockKg) {
      toast.warning(`Cannot add more. Only ${formatKgStock(availableStockKg)} available at ${selectedBranch?.name || "this branch"}.`);
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { cartItemId, product, variant, quantity: 1, mixItems }];
    });

    const itemDisplayName = variant ? `${product.name} (${variant.name})` : product.name;
    toast.success(`Added ${itemDisplayName} to cart!`);
  };

  // Open Mix Modal to edit existing mix in cart
  const openEditMixModal = (item: POSCartItem) => {
    setSelectedProductForMix(item.product);
    setSelectedMixVariant(item.variant);
    setSelectedMixItemNames(item.mixItems || []);
    setMixSearchQuery("");
    setEditingMixCartItemId(item.cartItemId);
    setIsMixModalOpen(true);
  };

  // Confirm Mix Selection from Modal
  const handleConfirmMixSelection = () => {
    if (!selectedProductForMix) return;
    if (selectedMixItemNames.length === 0) {
      toast.warning("Please select at least 1 flavour/item for this mix.");
      return;
    }

    if (editingMixCartItemId) {
      setCart((prev) =>
        prev.map((it) =>
          it.cartItemId === editingMixCartItemId
            ? { ...it, mixItems: [...selectedMixItemNames] }
            : it
        )
      );
      toast.success("Mix items updated!");
    } else {
      addToCart(selectedProductForMix, selectedMixVariant, [...selectedMixItemNames]);
    }

    setIsMixModalOpen(false);
    setSelectedProductForMix(null);
    setSelectedMixVariant(undefined);
    setSelectedMixItemNames([]);
    setEditingMixCartItemId(null);
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    const itemInCart = cart.find((item) => item.cartItemId === cartItemId);
    if (!itemInCart) return;

    if (delta > 0) {
      const availableStockKg = getProductStockForSelectedBranch(itemInCart.product.id, itemInCart.product.stock);
      const totalProductKg = cart
        .filter((item) => item.product.id === itemInCart.product.id)
        .reduce((sum, item) => sum + getItemKgWeight(item.variant?.name, item.variant?.weightInKg) * item.quantity, 0);

      const requiredDeltaKg = getItemKgWeight(itemInCart.variant?.name, itemInCart.variant?.weightInKg) * delta;

      if (totalProductKg + requiredDeltaKg > availableStockKg) {
        toast.warning(`Cannot add more. Only ${formatKgStock(availableStockKg)} available at ${selectedBranch?.name || "this branch"}.`);
        return;
      }
    }

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountPercent(0);
    setNote("");
    setPaymentMethod("UPI");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
    setActiveDraftId(null);
  };

  // Calculations based on dynamic GST Settings
  const isGstEnabled = printer.settings.enableGst ?? true;
  const cgstPercent = isGstEnabled ? Number(printer.settings.cgstPercent ?? 2.5) : 0;
  const sgstPercent = isGstEnabled ? Number(printer.settings.sgstPercent ?? 2.5) : 0;
  const totalGstRate = cgstPercent + sgstPercent;

  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => {
    const effectivePrice = item.variant ? item.variant.price : item.product.price;
    return acc + effectivePrice * item.quantity;
  }, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const cgstAmount = isGstEnabled ? (taxableAmount * cgstPercent) / 100 : 0;
  const sgstAmount = isGstEnabled ? (taxableAmount * sgstPercent) / 100 : 0;
  const gstTax = isGstEnabled ? cgstAmount + sgstAmount : 0;
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

      setSelectedCustomer(createdCust);
      setCustomerSearchQuery("");
      setIsCustomerDropdownOpen(false);
      setIsAddCustomerModalOpen(false);
      toast.success(`Customer "${createdCust.name}" added & selected!`);

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
      const invoiceItems: InvoiceItem[] = cart.map((item) => {
        const itemPrice = item.variant ? item.variant.price : item.product.price;
        const itemBarcode = item.variant?.barcode || item.product.barcode;
        const itemName = item.product.name.trim();

        return {
          productId: item.product.id,
          name: itemName,
          price: itemPrice,
          quantity: item.quantity,
          barcode: itemBarcode,
          imageUrl: item.product.imageUrl || "/logo.png",
          total: itemPrice * item.quantity,
          variantId: item.variant?.id || "",
          variantName: item.variant?.name || "",
          ...(item.mixItems && item.mixItems.length > 0 ? { mixItems: item.mixItems } : {}),
        };
      });

      const draftData: any = {
        invoiceNumber: activeDraftId
          ? draftBills.find((d) => d.id === activeDraftId)?.invoiceNumber || generateInvoiceNumber()
          : generateInvoiceNumber(),
        customer: {
          id: selectedCustomer?.id || "walk_in",
          name: selectedCustomer?.name || "Walk-in Customer",
          phone: selectedCustomer?.phone || "",
          email: selectedCustomer?.email || "",
          address: selectedCustomer?.address || "",
        },
        items: invoiceItems,
        itemCount: totalItemsCount,
        subtotal,
        discountPercent,
        discountAmount,
        taxableAmount,
        taxPercent: isGstEnabled ? totalGstRate : 0,
        taxAmount: gstTax,
        cgstPercent,
        sgstPercent,
        cgstAmount,
        sgstAmount,
        totalPayable,
        paymentMethod,
        ...(paymentMethod === "Split"
          ? {
              splitPayments: {
                cash: Number(splitCash || 0),
                upi: Number(splitUpi || 0),
                card: Number(splitCard || 0),
              },
            }
          : {}),
        status: "draft",
        note: note.trim() || "",
        updatedAt: serverTimestamp(),
      };

      if (activeDraftId) {
        await updateDoc(doc(db, "invoices", activeDraftId), draftData as any);
        toast.success("Draft bill updated successfully!");
      } else {
        await addDoc(collection(db, "invoices"), {
          ...draftData,
          createdAt: serverTimestamp(),
        });
        toast.success("Bill saved to drafts! You can resume it anytime from 'Saved Draft Bills'.");
      }

      clearCart();
      setIsMobileCheckoutOpen(false);
    } catch (err: any) {
      console.error("Save draft error:", err);
      toast.error("Failed to save draft: " + err.message);
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // LOAD SAVED DRAFT BILL
  const handleLoadDraftBill = (draft: Invoice) => {
    const restoredCart: POSCartItem[] = draft.items.map((item) => {
      const existingProduct = products.find((p) => p.id === item.productId);
      const matchedVariant = existingProduct?.variants?.find(
        (v) => v.name === item.variantName || v.id === item.variantId
      );
      const mixKey = item.mixItems && item.mixItems.length > 0 ? `_mix_${[...item.mixItems].sort().join(",")}` : "";
      const cartItemId = item.variantName
        ? `${item.productId}_${item.variantName}${mixKey}`
        : `${item.productId}${mixKey}`;

      return {
        cartItemId,
        product: existingProduct || {
          id: item.productId,
          name: item.name,
          price: item.price,
          category: "General",
          imageUrl: item.imageUrl || "/logo.png",
          barcode: item.barcode || "",
          stock: 999,
          status: "active",
        },
        variant: matchedVariant || (item.variantName ? { id: item.variantId || item.variantName, name: item.variantName, price: item.price, status: "active" as const } : undefined),
        quantity: item.quantity,
        mixItems: item.mixItems || undefined,
      };
    });

    setCart(restoredCart);
    setDiscountPercent(draft.discountPercent || 0);
    setNote(draft.note || "");
    setPaymentMethod((draft.paymentMethod as any) || "UPI");
    if (draft.splitPayments) {
      setSplitCash(draft.splitPayments.cash || "");
      setSplitUpi(draft.splitPayments.upi || "");
      setSplitCard(draft.splitPayments.card || "");
    } else {
      setSplitCash("");
      setSplitUpi("");
      setSplitCard("");
    }
    setActiveDraftId(draft.id);

    if (draft.customer && draft.customer.name !== "Walk-in Customer") {
      setSelectedCustomer({
        id: draft.customer.id || "",
        name: draft.customer.name,
        phone: draft.customer.phone,
        email: draft.customer.email,
        address: draft.customer.address,
      });
    } else {
      setSelectedCustomer(null);
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

    if (paymentMethod === "Split") {
      const totalSplit = Number(
        (Number(splitCash || 0) + Number(splitUpi || 0) + Number(splitCard || 0)).toFixed(2)
      );
      if (Math.abs(totalSplit - totalPayable) > 0.5) {
        toast.error(
          `Split amounts total (₹${totalSplit.toFixed(2)}) must equal Total Payable (₹${totalPayable.toFixed(2)}). Remaining: ₹${(totalPayable - totalSplit).toFixed(2)}`
        );
        return;
      }
    }

    setIsSubmittingBill(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const invoiceItems: InvoiceItem[] = cart.map((item) => {
        const itemPrice = item.variant ? item.variant.price : item.product.price;
        const itemBarcode = item.variant?.barcode || item.product.barcode;
        const itemName = item.product.name.trim();

        return {
          productId: item.product.id,
          name: itemName,
          price: itemPrice,
          quantity: item.quantity,
          barcode: itemBarcode,
          imageUrl: item.product.imageUrl || "/logo.png",
          total: itemPrice * item.quantity,
          variantId: item.variant?.id || "",
          variantName: item.variant?.name || "",
          ...(item.mixItems && item.mixItems.length > 0 ? { mixItems: item.mixItems } : {}),
        };
      });

      const invoiceData: any = {
        invoiceNumber,
        branchId: selectedBranch?.id || "",
        branchName: selectedBranch?.name || "Main Store",
        customer: {
          id: selectedCustomer?.id || "walk_in",
          name: selectedCustomer?.name || "Walk-in Customer",
          phone: selectedCustomer?.phone || "",
          email: selectedCustomer?.email || "",
          address: selectedCustomer?.address || "",
        },
        items: invoiceItems,
        itemCount: totalItemsCount,
        subtotal,
        discountPercent,
        discountAmount,
        taxableAmount,
        taxPercent: isGstEnabled ? totalGstRate : 0,
        taxAmount: gstTax,
        cgstPercent,
        sgstPercent,
        cgstAmount,
        sgstAmount,
        totalPayable,
        paymentMethod,
        ...(paymentMethod === "Split"
          ? {
              splitPayments: {
                cash: Number(splitCash || 0),
                upi: Number(splitUpi || 0),
                card: Number(splitCard || 0),
              },
            }
          : {}),
        status: "completed",
        note: note.trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 1. Create completed invoice
      const invoiceRef = await addDoc(collection(db, "invoices"), invoiceData);

      // 2. If it was an existing draft, delete old draft record
      if (activeDraftId) {
        try {
          await deleteDoc(doc(db, "invoices", activeDraftId));
        } catch (e) {
          console.warn("Draft cleanup error:", e);
        }
      }

      // 3. Atomically decrement stock in Firestore branch_stocks and products (in KGs)
      // Core rule: 12 single scoops = 1 KG => 1 single scoop = 1/12 KG = ~0.0833 KG
      try {
        const batch = writeBatch(db);
        cart.forEach((item) => {
          if (item.product.id) {
            const itemKg = getItemKgWeight(item.variant?.name, item.variant?.weightInKg);
            const totalKgDeduction = Number((itemKg * item.quantity).toFixed(4));

            const prodRef = doc(db, "products", item.product.id);
            batch.update(prodRef, {
              stock: increment(-totalKgDeduction),
            });

            if (selectedBranch?.id) {
              const branchStockRef = doc(db, "branch_stocks", `${item.product.id}_${selectedBranch.id}`);
              batch.set(
                branchStockRef,
                {
                  productId: item.product.id,
                  productName: item.product.name,
                  branchId: selectedBranch.id,
                  branchName: selectedBranch.name,
                  quantity: increment(-totalKgDeduction),
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

      // 4. Update customer stats (if registered customer)
      if (selectedCustomer?.id && selectedCustomer.id !== "walk_in") {
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

      clearCart();
      setIsMobileCheckoutOpen(false);
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
        <div className="bg-slate-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-[6px] flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[6px] bg-blue-600 flex items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase tracking-wider hidden xs:block">
                Active Outlet
              </p>
              <p className="text-xs sm:text-sm font-bold text-white truncate">
                {selectedBranch?.name || "Main Store"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Thermal Printer Status */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-[5px] bg-slate-800 border border-slate-700 text-[11px]">
              <Printer className={`w-3.5 h-3.5 ${printer.isConnected ? "text-emerald-400" : "text-slate-400"}`} />
              <span className="text-slate-300 font-medium">
                {printer.isConnected
                  ? `${printer.connectionType?.toUpperCase()}`
                  : "Thermal: Off"}
              </span>
            </div>

            {availableBranches.length > 1 && (
              <select
                value={selectedBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="h-[30px] sm:h-[34px] px-2 sm:px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-[5px] text-xs font-bold border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[135px] sm:max-w-[190px]"
              >
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                    📍 {b.name}
                  </option>
                ))}
              </select>
            )}
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
              placeholder="Search products by name, variant, or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
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
                const inCartTotalQty = cartProductQuantities.get(product.id) || 0;
                const isSelectedInCart = inCartTotalQty > 0;
                const branchStock = getProductStockForSelectedBranch(product.id, product.stock);
                const isOutOfStock = branchStock <= 0;
                const isLowStock = branchStock > 0 && branchStock <= (product.bufferStock || 5);
                const hasVariants = product.hasVariations && product.variants && product.variants.length > 0;
                const minPrice = hasVariants ? Math.min(...product.variants!.map((v) => v.price)) : product.price;

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
                        <span>In Cart: {inCartTotalQty}</span>
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

                      {/* Multi-variant indicator badge on image */}
                      {hasVariants && !isOutOfStock && (
                        <div className="absolute bottom-1.5 left-1.5 bg-purple-600/95 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] shadow-xs flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{product.variants!.length} Options</span>
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
                          {hasVariants ? `From ₹ ${minPrice.toFixed(2)}` : `₹ ${Number(product.price).toFixed(2)}`}
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
                        {isOutOfStock ? "Out of Stock" : `Stock: ${formatKgStock(branchStock)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => {
                const inCartTotalQty = cartProductQuantities.get(product.id) || 0;
                const isSelectedInCart = inCartTotalQty > 0;
                const branchStock = getProductStockForSelectedBranch(product.id, product.stock);
                const isOutOfStock = branchStock <= 0;
                const isLowStock = branchStock > 0 && branchStock <= (product.bufferStock || 5);
                const hasVariants = product.hasVariations && product.variants && product.variants.length > 0;
                const minPrice = hasVariants ? Math.min(...product.variants!.map((v) => v.price)) : product.price;

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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800">{product.name}</h4>
                          {hasVariants && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                              {product.variants!.length} Options
                            </span>
                          )}
                        </div>
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
                            {isOutOfStock ? "Out of Stock" : `Stock: ${formatKgStock(branchStock)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-extrabold text-slate-900">
                        {hasVariants ? `From ₹ ${minPrice.toFixed(2)}` : `₹ ${Number(product.price).toFixed(2)}`}
                      </span>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`h-[32px] px-3 text-xs font-bold rounded-[5px] transition-colors ${
                          isOutOfStock
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : isSelectedInCart
                            ? "bg-blue-600 text-white"
                            : hasVariants
                            ? "bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                        }`}
                      >
                        {isOutOfStock
                          ? "Unavailable"
                          : isSelectedInCart
                          ? `In Cart (${inCartTotalQty})`
                          : hasVariants
                          ? "Select Option"
                          : "+ Add"}
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
      {/* RIGHT: Order Summary & Checkout Panel (Desktop View Only) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex w-[420px] bg-white rounded-[6px] border border-slate-200 shadow-xs flex-col shrink-0">
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

          <button
            type="button"
            onClick={() => setIsDraftsModalOpen(true)}
            title="Saved Draft Bills"
            className="h-[32px] px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-[5px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Drafts ({draftBills.length})</span>
          </button>
        </div>

        {/* Customer Selector Card */}
        <div ref={customerDropdownRef} className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>Customer Details</span>
              <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
            </label>
            <span className="text-[10px] text-slate-500 font-medium">
              {selectedCustomer ? "Selected" : "Walk-in by default"}
            </span>
          </div>

          {selectedCustomer ? (
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-[6px] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">{selectedCustomer.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedCustomer.phone}</p>
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
              const effectivePrice = item.variant ? item.variant.price : item.product.price;
              const itemTotal = effectivePrice * item.quantity;
              return (
                <div
                  key={item.cartItemId}
                  className="grid grid-cols-12 items-center gap-1 text-xs text-slate-800 border-b border-slate-100 pb-2.5"
                >
                  {/* Item info with variation & mix badge */}
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
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{item.product.name}</p>
                      
                      <div className="flex items-center gap-1 flex-wrap mt-0.5">
                        {item.variant && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded-[3px] bg-purple-50 text-purple-700 font-bold text-[9px] border border-purple-200">
                            {item.variant.name}
                          </span>
                        )}
                        {item.mixItems && item.mixItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openEditMixModal(item)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-[3px] bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium text-[9px] border border-amber-200 cursor-pointer"
                            title="Click to edit chosen mix flavours"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            <span className="truncate max-w-[110px]">Mix: {item.mixItems.join(", ")}</span>
                          </button>
                        )}
                        {!item.variant && !item.mixItems && (
                          <p className="text-[10px] text-slate-400 truncate">{item.product.barcode || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="col-span-3 flex items-center justify-center">
                    <div className="h-[30px] flex items-center border border-slate-200 rounded-[5px] bg-white overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartItemId, -1)}
                        className="h-full px-1.5 hover:bg-slate-100 text-slate-500 cursor-pointer flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 text-xs font-bold text-slate-800 min-w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartItemId, 1)}
                        className="h-full px-1.5 hover:bg-slate-100 text-slate-500 cursor-pointer flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 text-right font-medium text-slate-600 text-[11px]">
                    ₹ {Number(effectivePrice).toFixed(2)}
                  </div>

                  {/* Total & Trash */}
                  <div className="col-span-2 flex items-center justify-end gap-1 text-right font-bold text-slate-900 text-xs">
                    <span>₹ {itemTotal.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cartItemId)}
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
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDiscountPercent(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      discountPercent === d
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>
            <span className="font-semibold text-red-600">- ₹ {discountAmount.toFixed(2)}</span>
          </div>

          {isGstEnabled && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <span>GST Tax</span>
                <span className="text-[10px] text-slate-400">({totalGstRate}%)</span>
              </span>
              <span className="font-semibold text-slate-700">₹ {gstTax.toFixed(2)}</span>
            </div>
          )}

          <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-slate-900">
            <span className="text-sm font-bold">Total Payable</span>
            <span className="text-lg font-extrabold text-blue-600">₹ {totalPayable.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-3">
          <label className="block text-xs font-bold text-slate-700">Select Payment Mode</label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setPaymentMethod("UPI")}
              className={`h-[40px] flex flex-col sm:flex-row items-center justify-center gap-1 rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === "UPI"
                  ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-purple-600" />
              <span>UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("Cash")}
              className={`h-[40px] flex flex-col sm:flex-row items-center justify-center gap-1 rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === "Cash"
                  ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("Card")}
              className={`h-[40px] flex flex-col sm:flex-row items-center justify-center gap-1 rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === "Card"
                  ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/20"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span>Card</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentMethod("Split");
                if (!splitCash && !splitUpi && !splitCard) {
                  setSplitCash(totalPayable);
                  setSplitUpi("");
                  setSplitCard("");
                }
              }}
              className={`h-[40px] flex flex-col sm:flex-row items-center justify-center gap-1 rounded-[6px] border text-xs font-bold transition-all cursor-pointer ${
                paymentMethod === "Split"
                  ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              <span>Split</span>
            </button>
          </div>

          {/* Interactive Split Payment Breakdown Panel */}
          {paymentMethod === "Split" && (
            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-[8px] space-y-2 text-xs animate-in fade-in duration-100">
              <div className="flex items-center justify-between font-bold text-amber-900 border-b border-amber-200/60 pb-1.5">
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                  <span>Split Payment Breakdown</span>
                </span>
                {(() => {
                  const totalSplit = Number(
                    (Number(splitCash || 0) + Number(splitUpi || 0) + Number(splitCard || 0)).toFixed(2)
                  );
                  const rem = Number((totalPayable - totalSplit).toFixed(2));
                  const isExact = Math.abs(rem) < 0.01;
                  return (
                    <span className={isExact ? "text-emerald-700 font-extrabold" : "text-amber-800 font-bold"}>
                      {isExact ? "✓ Matched (₹ " + totalPayable.toFixed(2) + ")" : "Remaining: ₹ " + rem.toFixed(2)}
                    </span>
                  );
                })()}
              </div>

              {/* Cash Input */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-14 text-slate-700 font-semibold shrink-0">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cash</span>
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className="w-full h-[32px] pl-6 pr-2 bg-white border border-slate-200 rounded-[5px] text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const others = Number(splitUpi || 0) + Number(splitCard || 0);
                    setSplitCash(Math.max(0, Number((totalPayable - others).toFixed(2))));
                  }}
                  className="h-[32px] px-2 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-[5px] shrink-0 cursor-pointer"
                  title="Fill remaining amount to Cash"
                >
                  Fill Rest
                </button>
              </div>

              {/* UPI Input */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-14 text-slate-700 font-semibold shrink-0">
                  <QrCode className="w-3.5 h-3.5 text-purple-600" />
                  <span>UPI</span>
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className="w-full h-[32px] pl-6 pr-2 bg-white border border-slate-200 rounded-[5px] text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const others = Number(splitCash || 0) + Number(splitCard || 0);
                    setSplitUpi(Math.max(0, Number((totalPayable - others).toFixed(2))));
                  }}
                  className="h-[32px] px-2 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-[5px] shrink-0 cursor-pointer"
                  title="Fill remaining amount to UPI"
                >
                  Fill Rest
                </button>
              </div>

              {/* Card Input */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-14 text-slate-700 font-semibold shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Card</span>
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                    className="w-full h-[32px] pl-6 pr-2 bg-white border border-slate-200 rounded-[5px] text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const others = Number(splitCash || 0) + Number(splitUpi || 0);
                    setSplitCard(Math.max(0, Number((totalPayable - others).toFixed(2))));
                  }}
                  className="h-[32px] px-2 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 rounded-[5px] shrink-0 cursor-pointer"
                  title="Fill remaining amount to Card"
                >
                  Fill Rest
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleSaveToDraft}
              disabled={isSubmittingBill || cart.length === 0}
              className="h-[42px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-[6px] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Bookmark className="w-4 h-4 text-amber-600" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={isSubmittingBill || cart.length === 0}
              className="h-[42px] bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
      {/* MOBILE BOTTOM FLOATING CART FLYOUT BAR */}
      {/* ========================================================================= */}
      {cart.length > 0 && (
        <div className="fixed bottom-14 left-0 right-0 p-3 z-30 lg:hidden animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-[12px] shadow-2xl border border-white/10 flex items-center justify-between gap-3">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
              onClick={() => setIsMobileCheckoutOpen(true)}
            >
              <div className="w-10 h-10 rounded-[8px] bg-blue-600 flex items-center justify-center font-bold text-white shrink-0 relative shadow-xs">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] font-extrabold flex items-center justify-center">
                  {totalItemsCount}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {totalItemsCount} Item{totalItemsCount > 1 ? "s" : ""} in Cart
                </p>
                <p className="text-sm font-extrabold text-emerald-400 font-mono">
                  ₹ {totalPayable.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileCheckoutOpen(true)}
              className="h-[38px] px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[8px] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/30 cursor-pointer shrink-0"
            >
              <span>Checkout & Pay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VARIANT SELECTION POPUP ON ITEM CLICK */}
      {/* ========================================================================= */}
      {isVariantModalOpen && selectedProductForVariants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-purple-600 text-white flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Select Variation</h3>
                  <p className="text-[11px] text-purple-700 font-medium">
                    {selectedProductForVariants.name} • {selectedProductForVariants.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsVariantModalOpen(false);
                  setSelectedProductForVariants(null);
                }}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Overview Card */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-[6px] bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-2xs">
                <img
                  src={selectedProductForVariants.imageUrl || "/logo.png"}
                  alt={selectedProductForVariants.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo.png";
                  }}
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  {selectedProductForVariants.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Available in {selectedProductForVariants.variants?.length || 0} variations. Tap any variation below to add to bill:
                </p>
              </div>
            </div>

            {/* Variations Grid / List */}
            <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin">
              {selectedProductForVariants.variants?.map((v) => {
                const cartKey = `${selectedProductForVariants.id}_${v.name}`;
                const inCartQty = cartItemQuantities.get(cartKey) || 0;
                const isSelected = inCartQty > 0;

                return (
                  <div
                    key={v.name}
                    onClick={() => {
                      if (isMixProduct(selectedProductForVariants.category)) {
                        setIsVariantModalOpen(false);
                        setSelectedProductForMix(selectedProductForVariants);
                        setSelectedMixVariant(v);
                        setSelectedMixItemNames([]);
                        setMixSearchQuery("");
                        setEditingMixCartItemId(null);
                        setIsMixModalOpen(true);
                      } else {
                        addToCart(selectedProductForVariants, v);
                      }
                    }}
                    className={`p-3.5 rounded-[8px] border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-purple-400 hover:bg-purple-50/20 hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? "bg-purple-600 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-900">{v.name}</p>
                          <span className="text-[10px] text-purple-700 font-semibold font-mono bg-purple-100/70 px-1.5 py-0.2 rounded">
                            {formatKgStock(getItemKgWeight(v.name, v.weightInKg))}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 bg-purple-600 text-white text-[9px] font-bold rounded-full">
                              In Cart: {inCartQty}
                            </span>
                          )}
                        </div>
                        {v.barcode && (
                          <p className="text-[10px] text-slate-400 font-mono">Barcode: {v.barcode}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        ₹ {Number(v.price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className={`h-[30px] px-3 text-xs font-bold rounded-[6px] transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-purple-600 text-white"
                            : "bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white"
                        }`}
                      >
                        {isSelected ? `+ Add (${inCartQty})` : "+ Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total in cart for item:{" "}
                <strong className="text-slate-900 font-bold">
                  {cartProductQuantities.get(selectedProductForVariants.id) || 0} units
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsVariantModalOpen(false);
                  setSelectedProductForVariants(null);
                }}
                className="h-[34px] px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MIX CATEGORY ITEM SELECTION POPUP */}
      {/* ========================================================================= */}
      {isMixModalOpen && selectedProductForMix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-[10px] border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Choose Mix Items / Flavours</h3>
                  <p className="text-[11px] text-amber-800 font-medium">
                    {selectedProductForMix.name}
                    {selectedMixVariant ? ` (${selectedMixVariant.name})` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMixModalOpen(false);
                  setSelectedProductForMix(null);
                  setSelectedMixVariant(undefined);
                  setSelectedMixItemNames([]);
                  setEditingMixCartItemId(null);
                }}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Items Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Selected Items ({selectedMixItemNames.length}):
                </span>
                {selectedMixItemNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMixItemNames([])}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {selectedMixItemNames.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No flavours/items chosen yet. Tap below to add to mix:</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {selectedMixItemNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-300"
                    >
                      <span>{name}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMixItemNames((prev) => prev.filter((n) => n !== name))}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Search Filter for Mix Items */}
            <div className="p-3 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products / flavours to include in mix..."
                  value={mixSearchQuery}
                  onChange={(e) => setMixSearchQuery(e.target.value)}
                  className="w-full h-[34px] pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Available Products List */}
            <div className="p-3 space-y-1.5 flex-1 overflow-y-auto max-h-64 scrollbar-thin">
              {products
                .filter((p) => {
                  if (p.id === selectedProductForMix.id) return false;
                  if (!mixSearchQuery.trim()) return true;
                  const q = mixSearchQuery.toLowerCase().trim();
                  return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
                })
                .map((prod) => {
                  const isChosen = selectedMixItemNames.includes(prod.name);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        if (isChosen) {
                          setSelectedMixItemNames((prev) => prev.filter((n) => n !== prod.name));
                        } else {
                          setSelectedMixItemNames((prev) => [...prev, prod.name]);
                        }
                      }}
                      className={`p-2.5 rounded-[6px] border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isChosen
                          ? "bg-amber-50/90 border-amber-500 ring-1 ring-amber-500/20"
                          : "bg-white border-slate-200 hover:border-amber-400 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-[4px] border flex items-center justify-center transition-colors shrink-0 ${
                            isChosen ? "bg-amber-600 border-amber-600 text-white" : "border-slate-300 bg-white"
                          }`}
                        >
                          {isChosen && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{prod.name}</p>
                          <p className="text-[10px] text-slate-400">{prod.category}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          isChosen ? "bg-amber-200/80 text-amber-900" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isChosen ? "Selected" : "+ Add"}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsMixModalOpen(false);
                  setSelectedProductForMix(null);
                  setSelectedMixVariant(undefined);
                  setSelectedMixItemNames([]);
                  setEditingMixCartItemId(null);
                }}
                className="h-[36px] px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-[6px] text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMixSelection}
                disabled={selectedMixItemNames.length === 0}
                className="h-[36px] px-5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {editingMixCartItemId ? "Update Mix Items" : `Add to Bill (${selectedMixItemNames.length} items)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0: MOBILE FULL ORDER CHECKOUT DRAWER / MODAL */}
      {/* ========================================================================= */}
      {isMobileCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileCheckoutOpen(false)}
          />

          <div className="relative bg-white w-full max-h-[92vh] rounded-t-[20px] shadow-2xl flex flex-col z-10 animate-in slide-in-from-bottom duration-300 overflow-hidden border-t border-slate-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Order Summary & Checkout</h3>
                  <p className="text-[10px] text-slate-500">{totalItemsCount} items • {selectedBranch?.name || "Main Store"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(true)}
                  title="Draft Bills"
                  className="h-[30px] px-2 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-[5px] flex items-center gap-1"
                >
                  <Bookmark className="w-3 h-3 text-blue-600" />
                  <span>Drafts ({draftBills.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileCheckoutOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-4 flex-1">
              {/* Customer Selector */}
              <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Customer</span>
                    <span className="text-red-500">* (Required)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(true)}
                    className="text-[11px] font-bold text-blue-600 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>

                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-2 bg-white rounded-[6px] border border-blue-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate">{selectedCustomer.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{selectedCustomer.phone}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      className="text-[11px] font-bold text-red-600 px-2 py-1 bg-red-50 rounded"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search Customer by Name or Mobile..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full h-[34px] px-3 bg-white border border-slate-300 rounded-[6px] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {customerSearchQuery && filteredCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-[6px] shadow-xl z-30 max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {filteredCustomers.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setCustomerSearchQuery("");
                            }}
                            className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">{cust.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{cust.phone}</p>
                            </div>
                            <span className="text-[10px] text-blue-600 font-bold">Select</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Items List in Cart */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">Cart Items ({cart.length})</span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.map((item) => {
                    const price = item.variant ? item.variant.price : item.product.price;
                    return (
                      <div
                        key={item.cartItemId}
                        className="p-2.5 bg-slate-50 rounded-[8px] border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.product.name}</p>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {item.variant && (
                              <span className="inline-flex px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold text-[9px] border border-purple-200">
                                {item.variant.name}
                              </span>
                            )}
                            {item.mixItems && item.mixItems.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMobileCheckoutOpen(false);
                                  openEditMixModal(item);
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-medium text-[9px] border border-amber-200"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                <span>Mix: {item.mixItems.join(", ")}</span>
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            ₹{price.toFixed(2)} × {item.quantity} = <strong className="text-slate-900 font-extrabold">₹{(price * item.quantity).toFixed(2)}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, -1)}
                            className="w-6 h-6 rounded bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, 1)}
                            className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartItemId)}
                            className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discount & Payment Modes */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Discount (%)</label>
                  <div className="flex items-center gap-1">
                    {[0, 5, 10, 15].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDiscountPercent(d)}
                        className={`flex-1 py-1 rounded text-[11px] font-bold border transition-colors ${
                          discountPercent === d
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        {d}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Method</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["UPI", "Cash", "Card", "Split"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(mode);
                          if (mode === "Split" && !splitCash && !splitUpi && !splitCard) {
                            setSplitCash(totalPayable);
                            setSplitUpi("");
                            setSplitCard("");
                          }
                        }}
                        className={`py-1.5 rounded text-[11px] font-bold border transition-colors ${
                          paymentMethod === mode
                            ? "bg-blue-600 text-white border-blue-600 font-extrabold"
                            : "bg-white text-slate-700 border-slate-200"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Split Inputs */}
                {paymentMethod === "Split" && (
                  <div className="p-2.5 bg-amber-50 rounded-[8px] border border-amber-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-amber-900">
                      <span>Split Allocation</span>
                      {(() => {
                        const totalSplit = Number(
                          (Number(splitCash || 0) + Number(splitUpi || 0) + Number(splitCard || 0)).toFixed(2)
                        );
                        const rem = Number((totalPayable - totalSplit).toFixed(2));
                        return (
                          <span className={Math.abs(rem) < 0.01 ? "text-emerald-700" : "text-amber-800"}>
                            {Math.abs(rem) < 0.01 ? "✓ Matched" : "Rem: ₹" + rem.toFixed(2)}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Cash (₹)</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={splitCash}
                          onChange={(e) => setSplitCash(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                          className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">UPI (₹)</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={splitUpi}
                          onChange={(e) => setSplitUpi(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                          className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Card (₹)</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={splitCard}
                          onChange={(e) => setSplitCard(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                          className="w-full h-[30px] px-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-slate-100 rounded-[8px] space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">₹ {subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({discountPercent}%)</span>
                    <span className="font-semibold">- ₹ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {isGstEnabled && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({totalGstRate}%)</span>
                    <span className="font-semibold">₹ {gstTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-1 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>Payable</span>
                  <span className="text-blue-600 font-mono">₹ {totalPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSaveToDraft}
                disabled={isSubmittingBill}
                className="h-[42px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-[8px] text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Bookmark className="w-4 h-4 text-amber-600" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={isSubmittingBill}
                className="h-[42px] bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                {isSubmittingBill ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Complete Sale</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div id="pos-printable-receipt" className="p-6 space-y-4 text-xs bg-white text-slate-800">
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-0.5">
                <div className="w-12 h-12 mx-auto mb-1 rounded-[6px] overflow-hidden">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900 uppercase">
                  {printer.settings.storeName || "NATURAL FRESH"}
                </h4>
                {printer.settings.tagline && (
                  <p className="text-[10px] text-slate-500 font-medium">
                    {printer.settings.tagline}
                  </p>
                )}
                <p className="text-[11px] font-bold text-blue-700">
                  Outlet: {completedInvoice.branchName || selectedBranch?.name || "Main Store"}
                </p>
                <p className="text-[11px] text-slate-600">
                  {printer.settings.storeAddress || selectedBranch?.address || "Guntur, Andhra Pradesh"}
                </p>
                {printer.settings.storePhone && (
                  <p className="text-[11px] text-slate-600 font-mono">
                    Ph: {printer.settings.storePhone}
                  </p>
                )}
                {printer.settings.enableGst && printer.settings.storeGst && (
                  <p className="text-[11px] text-slate-700 font-bold font-mono">
                    GSTIN: {printer.settings.storeGst}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div>
                  <p className="font-bold text-slate-900 font-mono">
                    Bill No: {completedInvoice.invoiceNumber}
                  </p>
                  <p className="text-slate-500">
                    Date & Time: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })} {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </p>
                </div>
                {completedInvoice.customer?.name && (
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{completedInvoice.customer?.name}</p>
                    {completedInvoice.customer?.phone && (
                      <p className="text-slate-500 font-mono">{completedInvoice.customer?.phone}</p>
                    )}
                  </div>
                )}
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-center">Qty</th>
                    <th className="py-1.5 text-right">Price</th>
                    <th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {completedInvoice.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-medium text-slate-800">
                        <span>{getReceiptItemName(it.name)}</span>
                      </td>
                      <td className="py-1.5 text-center text-slate-600 font-mono">{it.quantity}</td>
                      <td className="py-1.5 text-right text-slate-600 font-mono">₹{it.price.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-bold text-slate-900 font-mono">₹{it.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({completedInvoice.itemCount || completedInvoice.items?.length} items)</span>
                  <span className="font-semibold font-mono">₹ {completedInvoice.subtotal.toFixed(2)}</span>
                </div>

                {completedInvoice.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({completedInvoice.discountPercent}%)</span>
                    <span className="font-semibold font-mono">- ₹ {completedInvoice.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                {isGstEnabled && completedInvoice.taxAmount > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST ({completedInvoice.cgstPercent || (completedInvoice.taxPercent ? completedInvoice.taxPercent / 2 : 2.5)}%)</span>
                      <span className="font-mono">
                        ₹ {(completedInvoice.cgstAmount ?? completedInvoice.taxAmount / 2).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST ({completedInvoice.sgstPercent || (completedInvoice.taxPercent ? completedInvoice.taxPercent / 2 : 2.5)}%)</span>
                      <span className="font-mono">
                        ₹ {(completedInvoice.sgstAmount ?? completedInvoice.taxAmount / 2).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-semibold">
                      <span>Total GST ({completedInvoice.taxPercent || 5}%)</span>
                      <span className="font-mono">₹ {completedInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}

                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-extrabold text-slate-950">
                  <span>GRAND TOTAL</span>
                  <span className="text-blue-600 font-mono">₹ {completedInvoice.totalPayable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Payment Mode:</span>
                  <span className="font-bold text-blue-600 uppercase">
                    {completedInvoice.paymentMethod === "Split" ? "SPLIT PAYMENT" : completedInvoice.paymentMethod}
                  </span>
                </div>
                {completedInvoice.paymentMethod === "Split" && completedInvoice.splitPayments && (
                  <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[10px] space-y-0.5 mt-1 font-mono">
                    {Number(completedInvoice.splitPayments.cash || 0) > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>• Cash:</span>
                        <span className="font-bold">₹ {Number(completedInvoice.splitPayments.cash).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(completedInvoice.splitPayments.upi || 0) > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>• UPI / QR:</span>
                        <span className="font-bold">₹ {Number(completedInvoice.splitPayments.upi).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(completedInvoice.splitPayments.card || 0) > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>• Card:</span>
                        <span className="font-bold">₹ {Number(completedInvoice.splitPayments.card).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thank you message from Settings */}
              <div className="text-center pt-2 text-[10px] text-slate-500 border-t border-dashed border-slate-200 space-y-0.5">
                <p className="font-semibold">
                  {printer.settings.footerMessage || "Thank you for shopping with us! Please visit again."}
                </p>
                <p className="text-[9px] text-slate-400">Software by GamaNext</p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="w-full sm:w-auto h-[36px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-[36px] px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-[6px] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>System Print</span>
                </button>

                {printer.isConnected ? (
                  <button
                    type="button"
                    onClick={() => printer.printInvoice(completedInvoice, selectedBranch?.name)}
                    disabled={printer.isPrinting}
                    className="h-[36px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {printer.isPrinting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>Thermal Print ({printer.connectionType?.toUpperCase()})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (printer.isWebUsbSupported) {
                        await printer.connectUSB();
                      } else if (printer.isWebBluetoothSupported) {
                        await printer.connectBluetooth();
                      } else {
                        toast.info("Please open Settings to configure your thermal printer.");
                      }
                    }}
                    className="h-[36px] px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Connect Thermal</span>
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
