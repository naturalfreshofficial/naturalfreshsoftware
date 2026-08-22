export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalOrders?: number;
  totalSpent?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface CategoryItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt?: any;
  updatedAt?: any;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  barcode?: string;
  status?: "active" | "inactive";
  weightInKg?: number; // e.g. 1/12 = 0.0833 for single scoop, 0.5 for 500ml
}

export interface VariationItem {
  id: string;
  name: string;
  status: "active" | "inactive";
  weightInKg?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  category: string;
  barcode: string;
  isFavorite: boolean;
  stock: number; // Stock in KG
  bufferStock: number; // Buffer stock in KG
  unit?: string; // "KG"
  status: "active" | "inactive";
  imageUrl?: string;
  hasVariations?: boolean;
  variants?: ProductVariant[];
  createdAt?: any;
  updatedAt?: any;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  imageUrl?: string;
  total: number;
  variantId?: string;
  variantName?: string;
  weightInKg?: number;
  totalWeightInKg?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id?: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  items: InvoiceItem[];
  itemCount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  taxPercent: number;
  taxAmount: number;
  cgstPercent?: number;
  sgstPercent?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  totalPayable: number;
  paymentMethod: "UPI" | "Cash" | "Card";
  status: "completed" | "draft" | "cancelled";
  branchId?: string;
  branchName?: string;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Branch {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  status?: "active" | "inactive";
  managerName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  status?: "active" | "inactive";
  totalOrders?: number;
  totalPurchases?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface SupplierOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface SupplierOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  items: SupplierOrderItem[];
  totalQuantity: number;
  totalAmount?: number;
  status: "pending" | "received" | "cancelled";
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  email?: string;
  monthlySalary: number;
  acceptedLeaves: number;
  role?: string;
  branchId?: string;
  branchName?: string;
  status?: "active" | "inactive";
  joinedDate?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  branchId: string;
  branchName: string;
  category?: string;
  paymentMethod?: "Cash" | "UPI" | "Card" | "Bank Transfer";
  date?: any;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface BranchStock {
  id: string; // `${productId}_${branchId}`
  productId: string;
  productName?: string;
  branchId: string;
  branchName?: string;
  quantity: number;
  updatedAt?: any;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  branchIds: string[]; // multi-store selection
  branchNames?: string[];
  allowedPages: string[]; // multi-page route access list (Dashboard strictly excluded)
  status: "active" | "inactive";
  role?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type UserRole = "super_admin" | "staff";

export interface AuthSession {
  uid: string;
  role: UserRole;
  name: string;
  phone?: string;
  email?: string;
  allowedPages?: string[]; // for staff
  branchIds?: string[]; // for staff
  currentBranchId?: string;
  staffDocId?: string;
}


