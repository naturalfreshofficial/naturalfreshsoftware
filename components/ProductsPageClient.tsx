"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  FolderTree,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Edit2,
  Trash2,
  UploadCloud,
  X,
  Check,
  Barcode,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
} from "lucide-react";
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
import BulkImportModal from "@/components/BulkImportModal";
import { downloadSampleExcel } from "@/lib/sampleProducts";
import { useToast } from "@/components/ToastProvider";
import CustomSelect from "@/components/CustomSelect";

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  category: string;
  barcode: string;
  isFavorite: boolean;
  stock: number;
  bufferStock: number;
  status: "active" | "inactive";
  imageUrl?: string;
  createdAt?: any;
}

export interface CategoryItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt?: any;
}

const DEFAULT_CATEGORIES = [
  "Groceries",
  "Beverages",
  "Snacks",
  "Personal Care",
  "Household",
  "Dairy",
  "Ice Creams",
];

const DEFAULT_SEED_PRODUCTS = [
  {
    name: "Aashirvaad Atta 1kg",
    price: 52.0,
    category: "Groceries",
    barcode: "8901207000730",
    isFavorite: true,
    stock: 45,
    bufferStock: 10,
    status: "active" as const,
  },
  {
    name: "Fortune Sunflower Oil 1L",
    price: 132.0,
    category: "Groceries",
    barcode: "8901030820217",
    isFavorite: true,
    stock: 28,
    bufferStock: 8,
    status: "active" as const,
  },
  {
    name: "Tata Salt 1kg",
    price: 20.0,
    category: "Groceries",
    barcode: "8901056308512",
    isFavorite: false,
    stock: 60,
    bufferStock: 15,
    status: "active" as const,
  },
  {
    name: "Surf Excel Matic 1kg",
    price: 145.0,
    category: "Household",
    barcode: "8901030900721",
    isFavorite: false,
    stock: 18,
    bufferStock: 5,
    status: "active" as const,
  },
  {
    name: "Brooke Bond Red Label 250g",
    price: 135.0,
    category: "Beverages",
    barcode: "8901030811210",
    isFavorite: true,
    stock: 22,
    bufferStock: 6,
    status: "active" as const,
  },
  {
    name: "Parle-G Biscuit 200g",
    price: 20.0,
    category: "Snacks",
    barcode: "8901715000050",
    isFavorite: true,
    stock: 80,
    bufferStock: 20,
    status: "active" as const,
  },
];

export default function ProductsPageClient() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "categories">("products");

  // State for Firestore data
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "favorites">("all");

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<ProductItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product Form state (Only Buffer Stock, no Current Stock)
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState<number | "">("");
  const [productCategory, setProductCategory] = useState("");
  const [hasCustomBarcode, setHasCustomBarcode] = useState(false);
  const [productBarcode, setProductBarcode] = useState("");
  const [productIsFavorite, setProductIsFavorite] = useState(false);
  const [productBufferStock, setProductBufferStock] = useState<number | "">("");
  const [productStatus, setProductStatus] = useState<"active" | "inactive">("active");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category Form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryStatus, setCategoryStatus] = useState<"active" | "inactive">("active");

  // Subscribe to Firebase Firestore collections
  useEffect(() => {
    setLoading(true);
    let unsubProducts = () => {};
    let unsubCategories = () => {};

    try {
      // Products listener
      const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
      unsubProducts = onSnapshot(
        productsQuery,
        (snapshot) => {
          const items: ProductItem[] = [];
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as ProductItem);
          });
          setProducts(items);
          setLoading(false);
        },
        (error) => {
          console.warn("Firestore products listener fallback:", error);
          // Try without orderBy if index is building or empty
          const fallbackUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
            const items: ProductItem[] = [];
            snapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() } as ProductItem);
            });
            setProducts(items);
            setLoading(false);
          });
          unsubProducts = fallbackUnsub;
        }
      );

      // Categories listener
      const categoriesQuery = query(collection(db, "categories"), orderBy("name", "asc"));
      unsubCategories = onSnapshot(
        categoriesQuery,
        (snapshot) => {
          const items: CategoryItem[] = [];
          snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as CategoryItem);
          });
          setCategories(items);
        },
        (error) => {
          console.warn("Firestore categories listener fallback:", error);
          const fallbackUnsub = onSnapshot(collection(db, "categories"), (snapshot) => {
            const items: CategoryItem[] = [];
            snapshot.forEach((doc) => {
              items.push({ id: doc.id, ...doc.data() } as CategoryItem);
            });
            setCategories(items);
          });
          unsubCategories = fallbackUnsub;
        }
      );
    } catch (err: any) {
      console.error("Firebase init error:", err);
      setSyncError(err.message);
      setLoading(false);
    }

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  // Quick seed database helper if collections are empty
  const handleSeedDefaults = async () => {
    setIsSubmitting(true);
    try {
      for (const catName of DEFAULT_CATEGORIES) {
        if (!categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
          await addDoc(collection(db, "categories"), {
            name: catName,
            status: "active",
            createdAt: serverTimestamp(),
          });
        }
      }

      for (const prod of DEFAULT_SEED_PRODUCTS) {
        if (!products.some((p) => p.name.toLowerCase() === prod.name.toLowerCase())) {
          await addDoc(collection(db, "products"), {
            ...prod,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (err: any) {
      toast.error("Seeding error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate product count per category
  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((prod) => {
      if (prod.category) {
        counts[prod.category] = (counts[prod.category] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategoryFilter === "All" || item.category === selectedCategoryFilter;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? item.status === "active"
          : statusFilter === "inactive"
          ? item.status === "inactive"
          : statusFilter === "favorites"
          ? item.isFavorite
          : true;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategoryFilter, statusFilter]);

  // Pagination: 45 items per page
  const ITEMS_PER_PAGE = 45;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever filters or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  // Helper unique numeric barcode generator
  const generateUniqueNumericBarcode = () => {
    let candidate = "";
    const existingBarcodes = new Set(products.map((p) => p.barcode));
    let attempts = 0;
    do {
      // 13-digit numeric barcode (only digits 0-9)
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      candidate = `890${randomDigits}`;
      attempts++;
    } while (existingBarcodes.has(candidate) && attempts < 100);

    return candidate;
  };

  // Open modal for Add/Edit product
  const openProductModal = (product?: ProductItem) => {
    if (product) {
      setEditingProduct(product);
      setProductName(product.name);
      setProductPrice(product.price);
      setProductCategory(product.category || (categories[0]?.name || "Groceries"));
      const isAutoGenerated = !product.barcode || product.barcode.startsWith("890");
      setHasCustomBarcode(!isAutoGenerated);
      setProductBarcode(product.barcode || generateUniqueNumericBarcode());
      setProductIsFavorite(product.isFavorite);
      setProductBufferStock(product.bufferStock);
      setProductStatus(product.status);
      setImageFile(null);
      setImagePreview(product.imageUrl || null);
    } else {
      setEditingProduct(null);
      setProductName("");
      setProductPrice("");
      setProductCategory(categories[0]?.name || "Groceries");
      setHasCustomBarcode(false);
      setProductBarcode(generateUniqueNumericBarcode());
      setProductIsFavorite(false);
      setProductBufferStock("");
      setProductStatus("active");
      setImageFile(null);
      setImagePreview(null);
    }
    setIsProductModalOpen(true);
  };

  // Open modal for Add/Edit category
  const openCategoryModal = (category?: CategoryItem) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryStatus(category.status);
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryStatus("active");
    }
    setIsCategoryModalOpen(true);
  };

  // Handle local image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning("Image file size must be under 5MB");
        return;
      }
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  // Save Product (Upload to ImageKit first if image selected, then Firestore)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      toast.warning("Please enter a product name");
      return;
    }
    if (productPrice === "" || Number(productPrice) < 0) {
      toast.warning("Please enter a valid price");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = imagePreview || "";

      // 1. If a new image file is chosen, upload to ImageKit via API route
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("fileName", `${productName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`);

        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Image upload failed");
        }
        finalImageUrl = uploadData.url;
      }

      // Auto-create category in Firestore if it doesn't already exist
      const targetCategory = (productCategory || "General").trim();
      const catExists = categories.some(
        (c) => c.name.toLowerCase().trim() === targetCategory.toLowerCase()
      );
      if (!catExists && targetCategory) {
        try {
          await addDoc(collection(db, "categories"), {
            name: targetCategory,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (catErr) {
          console.warn("Auto-create category warning:", catErr);
        }
      }

      // 2. Prepare Firestore document data
      const productData = {
        name: productName.trim(),
        price: Number(productPrice),
        category: targetCategory,
        barcode: (productBarcode.trim() || generateUniqueNumericBarcode()).replace(/\D/g, ""),
        isFavorite: Boolean(productIsFavorite),
        stock: editingProduct ? editingProduct.stock : 0,
        bufferStock: Number(productBufferStock) || 0,
        status: productStatus,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingProduct) {
        // Update existing product
        await updateDoc(doc(db, "products", editingProduct.id), productData);
        toast.success(`Product "${productName.trim()}" updated successfully!`);
      } else {
        // Create new product
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Product "${productName.trim()}" created successfully!`);
      }

      setIsProductModalOpen(false);
    } catch (err: any) {
      console.error("Save product error:", err);
      toast.error("Failed to save product: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.warning("Please enter a category name");
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryData = {
        name: categoryName.trim(),
        status: categoryStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingCategory) {
        await updateDoc(doc(db, "categories", editingCategory.id), categoryData);
        toast.success(`Category "${categoryName.trim()}" updated successfully!`);
      } else {
        await addDoc(collection(db, "categories"), {
          ...categoryData,
          createdAt: serverTimestamp(),
        });
        toast.success(`Category "${categoryName.trim()}" created successfully!`);
      }

      setIsCategoryModalOpen(false);
    } catch (err: any) {
      console.error("Save category error:", err);
      toast.error("Failed to save category: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteDoc(doc(db, "products", id));
        toast.success(`Product "${name}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting product: " + err.message);
      }
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: string, name: string) => {
    const assignedCount = productCountByCategory[name] || 0;
    const confirmMsg =
      assignedCount > 0
        ? `"${name}" has ${assignedCount} assigned product(s). Are you sure you want to delete it?`
        : `Are you sure you want to delete "${name}"?`;

    if (confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, "categories", id));
        toast.success(`Category "${name}" deleted.`);
      } catch (err: any) {
        toast.error("Error deleting category: " + err.message);
      }
    }
  };

  // Toggle Favorite
  const toggleFavorite = async (product: ProductItem) => {
    try {
      await updateDoc(doc(db, "products", product.id), {
        isFavorite: !product.isFavorite,
      });
    } catch (err: any) {
      console.error("Toggle favorite error:", err);
    }
  };

  // Toggle Status
  const toggleStatus = async (product: ProductItem) => {
    try {
      const newStatus = product.status === "active" ? "inactive" : "active";
      await updateDoc(doc(db, "products", product.id), {
        status: newStatus,
      });
    } catch (err: any) {
      console.error("Toggle status error:", err);
    }
  };

  return (
    <div className="min-h-full flex flex-col p-4 lg:p-6 max-w-[1700px] mx-auto space-y-4">
      {/* Top Header Card with Tabs & Actions */}
      <div className="bg-white rounded-[6px] border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-[6px] border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`h-[36px] px-4 flex items-center gap-2 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === "products"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`h-[36px] px-4 flex items-center gap-2 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
              activeTab === "categories"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Categories ({categories.length})</span>
          </button>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Download Sample Excel */}
          <button
            type="button"
            onClick={() => downloadSampleExcel()}
            title="Download 300 Sample Products Excel File"
            className="h-[36px] px-3.5 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Sample Excel (300)</span>
          </button>

          {/* Bulk Import Button */}
          <button
            type="button"
            onClick={() => setIsBulkImportOpen(true)}
            className="h-[36px] px-3.5 flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[6px] text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Import</span>
          </button>

          {products.length === 0 && categories.length === 0 && !loading && (
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={isSubmitting}
              className="h-[36px] px-3.5 flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Load Sample Data</span>
            </button>
          )}

          {activeTab === "products" ? (
            <button
              type="button"
              onClick={() => openProductModal()}
              className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openCategoryModal()}
              className="h-[36px] px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[6px] border border-slate-200 shadow-xs flex flex-col">
        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "products"
                  ? "Search products by name, barcode..."
                  : "Search category name..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[36px] pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {activeTab === "products" && (
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Category Filter Dropdown */}
              <CustomSelect
                value={selectedCategoryFilter}
                onChange={(val) => setSelectedCategoryFilter(val)}
                options={[
                  { value: "All", label: "All Categories" },
                  ...categories.map((c) => ({ value: c.name, label: c.name })),
                ]}
                searchable={true}
                className="w-48"
              />

              {/* Status Filter */}
              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as any)}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active Only" },
                  { value: "inactive", label: "Inactive Only" },
                  { value: "favorites", label: "Favorites ⭐" },
                ]}
                className="w-40"
              />
            </div>
          )}
        </div>

        {/* TAB 1: PRODUCTS TABLE */}
        {activeTab === "products" && (
          <div className="flex flex-col">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs font-medium">Loading products from Firestore...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <Package className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No products found</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {searchQuery
                    ? "Try adjusting your search or category filters."
                    : "Get started by adding your first product with ImageKit upload and Firestore sync."}
                </p>
                <button
                  type="button"
                  onClick={() => openProductModal()}
                  className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Product</span>
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Fav</th>
                        <th className="py-3 px-4">Product Info</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Barcode ID</th>
                        <th className="py-3 px-4 text-right">Price</th>
                        <th className="py-3 px-4 text-center">Buffer Stock</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedProducts.map((prod) => {
                        return (
                          <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Favorite star */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleFavorite(prod)}
                                className="text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    prod.isFavorite
                                      ? "text-amber-400 fill-amber-400"
                                      : "text-slate-300"
                                  }`}
                                />
                              </button>
                            </td>

                            {/* Product info with image */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                                  <img
                                    src={prod.imageUrl || "/logo.png"}
                                    alt={prod.name}
                                    className="w-full h-full object-contain p-0.5"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/logo.png";
                                    }}
                                  />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{prod.name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    ID: {prod.id.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-[4px] bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                                {prod.category}
                              </span>
                            </td>

                            {/* Barcode */}
                            <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                              {prod.barcode || "—"}
                            </td>

                            {/* Price */}
                            <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                              ₹ {Number(prod.price).toFixed(2)}
                            </td>

                            {/* Buffer Stock */}
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100 font-mono">
                                {prod.bufferStock} units
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => toggleStatus(prod)}
                                className={`h-[26px] px-2.5 rounded-[4px] text-[11px] font-semibold transition-all cursor-pointer border ${
                                  prod.status === "active"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {prod.status === "active" ? "Active" : "Inactive"}
                              </button>
                            </td>

                            {/* Actions (View, Edit, Delete) */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setViewProduct(prod)}
                                  title="View product details"
                                  className="h-[32px] w-[32px] flex items-center justify-center rounded-[6px] border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openProductModal(prod)}
                                  title="Edit product"
                                  className="h-[32px] w-[32px] flex items-center justify-center rounded-[6px] border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  title="Delete product"
                                  className="h-[32px] w-[32px] flex items-center justify-center rounded-[6px] border border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
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
                </div>

                {/* Pagination Controls */}
                {filteredProducts.length > 0 && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    {/* Left: Summary */}
                    <div className="text-slate-600 font-medium">
                      Showing{" "}
                      <span className="font-bold text-slate-900">
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-bold text-slate-900">
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-slate-900">
                        {filteredProducts.length}
                      </span>{" "}
                      products
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-200 text-slate-700 text-[10px] font-bold">
                        45 / page
                      </span>
                    </div>

                    {/* Right: Page Buttons */}
                    <div className="flex items-center gap-1">
                      {/* First Page */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        title="First page"
                        className="h-[32px] w-[32px] flex items-center justify-center rounded-[5px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 cursor-pointer shadow-2xs transition-colors"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>

                      {/* Previous Page */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        title="Previous page"
                        className="h-[32px] px-2.5 flex items-center gap-1 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-semibold cursor-pointer shadow-2xs transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      {/* Numbered Page Buttons */}
                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((pageNum) => {
                            if (totalPages <= 7) return true;
                            if (pageNum === 1 || pageNum === totalPages) return true;
                            return Math.abs(pageNum - currentPage) <= 1;
                          })
                          .map((pageNum, idx, array) => {
                            const showEllipsisBefore = idx > 0 && pageNum - array[idx - 1] > 1;
                            return (
                              <div key={pageNum} className="flex items-center gap-1">
                                {showEllipsisBefore && (
                                  <span className="px-1 text-slate-400 font-bold select-none">...</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`h-[32px] min-w-[32px] px-2.5 rounded-[5px] font-bold text-xs transition-all cursor-pointer ${
                                    currentPage === pageNum
                                      ? "bg-blue-600 text-white shadow-xs"
                                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              </div>
                            );
                          })}
                      </div>

                      {/* Next Page */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        title="Next page"
                        className="h-[32px] px-2.5 flex items-center gap-1 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-semibold cursor-pointer shadow-2xs transition-colors"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Last Page */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        title="Last page"
                        className="h-[32px] w-[32px] flex items-center justify-center rounded-[5px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 cursor-pointer shadow-2xs transition-colors"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES TABLE */}
        {activeTab === "categories" && (
          <div className="flex-1 overflow-auto scrollbar-thin">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-xs font-medium">Loading categories...</p>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <FolderTree className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No categories found</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Create categories to organize your retail catalog and POS billing filters.
                </p>
                <button
                  type="button"
                  onClick={() => openCategoryModal()}
                  className="mt-4 h-[36px] px-4 flex items-center gap-2 bg-blue-600 text-white rounded-[6px] text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Category</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-5">
                  <tr>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4 text-center">Products Assigned</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.map((cat) => {
                    const count = productCountByCategory[cat.name] || 0;
                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                              {cat.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{cat.name}</span>
                          </div>
                        </td>

                        {/* Number of products assigned to that collection */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100">
                            <Package className="w-3.5 h-3.5" />
                            {count} {count === 1 ? "Product" : "Products"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-[4px] text-[11px] font-semibold border ${
                              cat.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {cat.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCategoryModal(cat)}
                              title="Edit Category"
                              className="h-[32px] w-[32px] flex items-center justify-center rounded-[6px] border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              title="Delete Category"
                              className="h-[32px] w-[32px] flex items-center justify-center rounded-[6px] border border-slate-200 hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
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
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT PRODUCT MODAL */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="h-[36px] w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs scrollbar-thin">
              {/* Image upload (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Product Image (Optional - Uploads to ImageKit)
                  </label>
                  {!imagePreview && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Defaults to store logo (/logo.png)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-[6px] border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 flex flex-col items-center justify-center p-1 text-center cursor-pointer transition-colors shrink-0 overflow-hidden relative group"
                  >
                    <img
                      src={imagePreview || "/logo.png"}
                      alt="Preview"
                      className="w-full h-full object-contain rounded-[4px] p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/logo.png";
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white rounded-[4px]">
                      <UploadCloud className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-bold">Change Image</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="text-[11px] text-slate-500">
                      Upload high quality JPG, PNG, or WebP. If left blank, the product will automatically use the store logo.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-[36px] px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        Choose File
                      </button>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          className="h-[36px] px-3 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-[6px] border border-red-200 transition-colors cursor-pointer"
                        >
                          Reset to Default Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Product Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aashirvaad Atta 1kg"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category Selection <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    value={productCategory || (categories[0]?.name || "Groceries")}
                    onChange={(val) => setProductCategory(val)}
                    options={
                      categories.length === 0
                        ? [{ value: "Groceries", label: "Groceries (Default)" }]
                        : categories.map((c) => ({ value: c.name, label: c.name }))
                    }
                    searchable={true}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Price & Barcode ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={productPrice}
                    onChange={(e) =>
                      setProductPrice(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Barcode ID <span className="text-[10px] font-normal text-slate-400">(Numerics only)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasCustomBarcode}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasCustomBarcode(checked);
                          if (!checked) {
                            setProductBarcode(generateUniqueNumericBarcode());
                          } else if (!productBarcode || productBarcode.length === 0) {
                            setProductBarcode("");
                          }
                        }}
                        className="w-3.5 h-3.5 text-blue-600 rounded-[3px] border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                        Has barcode
                      </span>
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      readOnly={!hasCustomBarcode}
                      placeholder={hasCustomBarcode ? "Enter numeric barcode..." : "Auto-generating unique barcode..."}
                      value={productBarcode}
                      onChange={(e) => {
                        if (hasCustomBarcode) {
                          // Allow only numeric digits
                          const numericOnly = e.target.value.replace(/\D/g, "");
                          setProductBarcode(numericOnly);
                        }
                      }}
                      className={`w-full h-[36px] px-3 border rounded-[6px] text-xs font-mono font-bold transition-all ${
                        hasCustomBarcode
                          ? "bg-white border-blue-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed select-none"
                      }`}
                    />
                    {!hasCustomBarcode && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setProductBarcode(generateUniqueNumericBarcode())}
                          title="Generate new unique barcode"
                          className="h-[26px] px-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {hasCustomBarcode
                      ? "Custom barcode active. Type or scan numeric barcode on the package."
                      : "Auto-generated unique numeric barcode (read-only). Check 'Has barcode' above to enter custom."}
                  </p>
                </div>
              </div>

              {/* Buffer Stock (Alert Threshold) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Buffer Stock (Alert Threshold)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={productBufferStock}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) =>
                    setProductBufferStock(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono"
                />
              </div>

              {/* Status & Favorites */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <CustomSelect
                    value={productStatus}
                    onChange={(val) => setProductStatus(val as any)}
                    options={[
                      { value: "active", label: "Active (Available in POS)" },
                      { value: "inactive", label: "Inactive (Hidden)" },
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productIsFavorite}
                      onChange={(e) => setProductIsFavorite(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded-[4px] border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      Add to Favourites ⭐
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Product</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT CATEGORY MODAL */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[6px] border border-slate-200 shadow-xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FolderTree className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="h-[36px] w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ice Creams, Beverages, Dairy..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full h-[36px] px-3 bg-slate-50 border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <CustomSelect
                  value={categoryStatus}
                  onChange={(val) => setCategoryStatus(val as any)}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  className="w-full"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="h-[36px] px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[36px] px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* BULK IMPORT MODAL */}
      {/* ========================================================================= */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        existingCategories={categories}
      />

      {/* ========================================================================= */}
      {/* VIEW PRODUCT DETAILS MODAL */}
      {/* ========================================================================= */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-md w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-blue-600 text-white flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Product Details</h3>
                  <p className="text-[10px] font-mono text-slate-500">ID: {viewProduct.id.slice(0, 10)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="h-[32px] w-[32px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-[6px] hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Image & Main Info */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-[8px] border border-slate-200">
                <div className="w-20 h-20 rounded-[6px] bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-2xs">
                  <img
                    src={viewProduct.imageUrl || "/logo.png"}
                    alt={viewProduct.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/logo.png";
                    }}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="inline-flex px-2 py-0.5 rounded-[4px] bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                    {viewProduct.category}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{viewProduct.name}</h4>
                  <p className="text-base font-extrabold text-slate-900 font-mono">
                    ₹ {Number(viewProduct.price).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Buffer Stock Limit</p>
                  <p className="text-sm font-bold text-blue-700 font-mono">{viewProduct.bufferStock} units</p>
                </div>

                <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                  <p className="text-sm font-bold capitalize">
                    <span className={viewProduct.status === "active" ? "text-emerald-700 font-bold" : "text-slate-600"}>
                      {viewProduct.status}
                    </span>
                  </p>
                </div>

                <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-0.5 col-span-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Barcode ID</p>
                  <p className="text-xs font-bold text-slate-800 font-mono flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                    <span>{viewProduct.barcode || "No Barcode Assigned"}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const p = viewProduct;
                  setViewProduct(null);
                  openProductModal(p);
                }}
                className="h-[34px] px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[6px] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Product</span>
              </button>

              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="h-[34px] px-4 bg-white border border-slate-200 text-slate-700 rounded-[6px] text-xs font-semibold hover:bg-slate-100 cursor-pointer"
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
