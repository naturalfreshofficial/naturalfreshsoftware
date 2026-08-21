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
