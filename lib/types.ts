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

export interface InvoiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  imageUrl?: string;
  total: number;
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

