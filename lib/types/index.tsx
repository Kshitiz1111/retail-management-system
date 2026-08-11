// Core TypeScript types for the ERP/POS system
import { Timestamp } from "firebase/firestore";

// User & Authentication Types
export const ROLES = {
    ADMIN: "admin",
    MANAGER: "manager",
    STAFF: "staff",
    CUSTOMER: "customer",
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const RESOURCES = {
    INVENTORY: "inventory",
    FINANCE: "finance",
    CUSTOMERS: "customers",
    EMPLOYEES: "employees",
    VENDORS: "vendors",
    POS: "pos",
    REPORTS: "reports",
    ORDERS: "orders",
    SALES_RETURNS: "salesReturns",
    PURCHASE_RETURNS: "purchaseReturns",
    HR: "hr",
    SETTINGS: "settings",
} as const;

export type ResourceName = typeof RESOURCES[keyof typeof RESOURCES];

export const ACTIONS = {
    VIEW: "view",
    CREATE: "create",
    UPDATE: "update",
    DELETE: "delete",
    VIEW_CREDITS: "viewCredits",
    SETTLE_CREDITS: "settleCredits",
    APPLY_DISCOUNT: "applyDiscount",
} as const;

export type PermissionAction = typeof ACTIONS[keyof typeof ACTIONS];

export type ResourcePermission = {
    [K in typeof ACTIONS.VIEW | typeof ACTIONS.CREATE | typeof ACTIONS.UPDATE | typeof ACTIONS.DELETE]: boolean;
};

export type EmployeePermissions = {
    resources: {
        [RESOURCES.INVENTORY]: ResourcePermission;
        [RESOURCES.FINANCE]: ResourcePermission;
        [RESOURCES.CUSTOMERS]: ResourcePermission & {
            [ACTIONS.VIEW_CREDITS]: boolean;
            [ACTIONS.SETTLE_CREDITS]: boolean;
        };
        [RESOURCES.EMPLOYEES]: ResourcePermission;
        [RESOURCES.VENDORS]: ResourcePermission;
        [RESOURCES.POS]: ResourcePermission & {
            [ACTIONS.APPLY_DISCOUNT]: boolean;
        };
        [RESOURCES.REPORTS]: ResourcePermission;
        [RESOURCES.ORDERS]: ResourcePermission;
        [RESOURCES.SALES_RETURNS]: ResourcePermission;
        [RESOURCES.PURCHASE_RETURNS]: ResourcePermission;
        [RESOURCES.HR]: ResourcePermission;
        [RESOURCES.SETTINGS]: ResourcePermission;
    };
};

export type User = {
    id: string;
    uid: string;
    email: string;
    displayName?: string;
    emailVerified: boolean;
    role: UserRole;
    permissions?: EmployeePermissions;
    createdAt: Timestamp;
    lastLogin?: Timestamp;
    // Employee-specific fields (optional for backward compatibility)
    baseSalary?: number;
    joiningDate?: Timestamp;
    status?: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
    employeeType?: EmployeeType;
    contractEndDate?: Timestamp;
    finance?: {
        currentAdvance: number;
        unpaidCommissions: number;
    };
};

// Product & Inventory Types
export type Warehouse = {
    id: string;
    name: string;
    address?: string;
    isActive: boolean;
};

export type ProductWarehouse = {
    quantity: number;
    position: string; // e.g., "Row A - Shelf 2"
    minQuantity: number; // Low stock threshold
};

export type Product = {
    id: string;
    sku: string; // The text inside the QR Code
    name: string;
    description?: string;
    category: string;
    price: number;
    costPrice?: number; // For profit calculation
    discount?: number; // Discount percentage or amount
    imageUrl?: string;
    warehouses: {
        [warehouseId: string]: ProductWarehouse;
    };
    trackTrace: {
        qrCodeUrl: string; // Generated on creation
        history: Array<{
            action: string;
            from?: string;
            to?: string;
            performedBy: string;
            timestamp: Timestamp;
        }>;
    };
    attributes?: Record<string, string>; // e.g., { "wattage": "500W", "material": "steel" }
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

// Customer Types
export type Customer = {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    loyaltyPoints: number;
    totalSpent: number;
    totalDue?: number; // Total outstanding credit
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

// Credit Transaction Types
export type CreditTransactionItem = {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    status: "PAID" | "CREDIT";
    paidAmount?: number;
};

export type CreditTransaction = {
    id: string;
    customerId: string;
    saleId: string;
    items: CreditTransactionItem[];
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    createdAt: Timestamp;
    settledAt?: Timestamp;
    settlementHistory: Array<{
        amount: number;
        date: Timestamp;
        settledBy: string;
        paymentMethod: PaymentMethod;
        notes?: string;
    }>;
};

// Sale & POS Types
export type SaleItem = {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    subtotal: number;
};

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "FONE_PAY" | "CREDIT" | "CHEQUE";

export type Sale = {
    id: string;
    customerId?: string;
    items: SaleItem[];
    subtotal: number;
    discount: number;
    tax?: number;
    total: number;
    paidAmount: number;
    dueAmount: number;
    paymentMethod: PaymentMethod;
    isCredit: boolean;
    performedBy: string; // User ID
    source?: "POS" | "ONLINE"; // Transaction source
    createdAt: Timestamp;
};

// Finance & Ledger Types
export type LedgerEntryType = "INCOME" | "EXPENSE" | "ASSET" | "LIABILITY";
export type LedgerCategory =
    | "SALES"
    | "PURCHASE"
    | "SALARY"
    | "RENT"
    | "UTILITY"
    | "VENDOR_PAY"
    | "ADVANCE"
    | "COMMISSION"
    | "SALES_RETURN"
    | "PURCHASE_RETURN"
    | "OTHER";

export type LedgerEntry = {
    id: string;
    date: Timestamp;
    type: LedgerEntryType;
    category: LedgerCategory;
    amount: number;
    description: string;
    relatedId?: string; // ID of the Order, Employee, or Vendor
    paymentMethod: PaymentMethod;
    performedBy: string; // User ID
    createdAt: Timestamp;
};

// Employee & HR Types
export type EmployeeProfile = {
    uid: string; // Linked to Firebase Auth
    role: UserRole;
    baseSalary: number;
    joiningDate: Timestamp;
    status: "ACTIVE" | "ON_LEAVE" | "TERMINATED";
    finance: {
        currentAdvance: number;
        unpaidCommissions: number;
    };
    permissions: EmployeePermissions;
};

export type AttendanceRecord = {
    id: string;
    uid: string;
    date: string; // "2024-05-20"
    checkIn: Timestamp;
    checkOut?: Timestamp;
    totalHours?: number;
    notes?: string;
};

// Vendor Types
export type Vendor = {
    id: string;
    companyName: string;
    contactPerson: string;
    phone: string;
    email?: string;
    address?: string;
    category?: string; // Vendor category (e.g., "Electronics", "Furniture", etc.)
    description?: string; // Vendor description
    balance: number; // How much we owe them (Accounts Payable)
    isActive: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
};

export type PurchaseOrderStatus = "PENDING" | "APPROVED" | "RECEIVED" | "CANCELLED";

export type PurchaseOrderItem = {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    receivedQuantity?: number;
    receivedUnitPrice?: number; // Actual unit price when received (may differ from unitPrice)
};

export type PurchaseOrder = {
    id: string;
    vendorId: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    receivedTotalAmount?: number; // Actual total amount when received (calculated from received prices)
    status: PurchaseOrderStatus;
    createdBy: string;
    createdAt: Timestamp;
    receivedAt?: Timestamp;
    receivedBy?: string;
    billImageUrl?: string;
    billImageUrls?: string[];
};

// Order Types
export type OrderStatus = "PENDING" | "CONFIRMED" | "SHIPPED" | "CANCELLED" | "COMPLETED";

export type OrderItem = {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    imageUrl?: string;
};

export type Order = {
    id: string;
    orderNumber: string; // Unique order number for tracking
    customerId?: string; // null if guest order
    customerInfo: {
        name: string;
        phone: string;
        email?: string;
        address: string;
    };
    items: OrderItem[];
    subtotal: number;
    discount: number; // Loyalty discount
    total: number;
    paymentMethod: "COD" | "BANK_TRANSFER" | "FONE_PAY";
    status: OrderStatus;
    loyaltyPointsUsed?: number; // Points redeemed for this order
    loyaltyPointsEarned?: number; // Points earned from this order
    notes?: string; // Admin notes
    source?: "POS" | "ONLINE"; // Transaction source (default: "ONLINE")
    performedBy?: string; // User ID who processed/confirmed the order (optional for customer-created orders)
    createdAt: Timestamp;
    updatedAt: Timestamp;
    confirmedAt?: Timestamp;
    shippedAt?: Timestamp;
    cancelledAt?: Timestamp;
};

// Loyalty Types
export type LoyaltyRules = {
    earnRate: number; // e.g., 0.001 means spend 1000, get 1 point
    redeemRate: number; // e.g., 10 means 1 point = 10 Rupees discount
    minPointsToRedeem: number;
    updatedAt: Timestamp;
};

// Return Types
export type ReturnReason = "DEFECTIVE" | "WRONG_ITEM" | "CUSTOMER_CHANGED_MIND" | "WARRANTY" | "DAMAGED" | "OTHER";

export type SalesReturnItem = {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    warehouseId: string;
    reason?: string;
};

export type SalesReturn = {
    id: string;
    returnNumber: string;
    source: "POS" | "ONLINE";
    originalSaleId?: string;
    originalOrderId?: string;
    originalOrderNumber?: string;
    customerId?: string;
    customerName?: string;
    items: SalesReturnItem[];
    totalReturnAmount: number;
    refundMethod: PaymentMethod;
    reason: ReturnReason;
    reasonNotes?: string;
    reasonImageUrls?: string[];
    status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
    processedBy: string;
    loyaltyPointsReversed?: number;
    creditAdjustment?: number;
    cashRefundAmount?: number;
    createdAt: Timestamp;
    completedAt?: Timestamp;
};

export type VendorReturnItem = {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    warehouseId: string;
    reason?: string;
};

export type VendorReturnRefundStatus = "AUTO_DEDUCTED" | "PENDING_REFUND" | "REFUND_RECEIVED";

export type VendorReturn = {
    id: string;
    returnNumber: string;
    vendorId: string;
    vendorName: string;
    originalPurchaseOrderId?: string;
    items: VendorReturnItem[];
    totalReturnAmount: number;
    reason: ReturnReason;
    reasonNotes?: string;
    reasonImageUrl?: string;
    reasonImageUrls?: string[];
    status: "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED";
    processedBy: string;
    creditNoteNumber?: string;
    // Refund tracking
    refundStatus: VendorReturnRefundStatus;
    refundAmount: number;           // Total refund amount
    autoDeductedAmount: number;     // Amount auto-deducted from vendor AP
    pendingRefundAmount: number;    // Amount vendor still owes us
    refundReceivedAt?: Timestamp;
    refundReceivedBy?: string;
    createdAt: Timestamp;
    completedAt?: Timestamp;
};

// Employee & Payroll Types
export type EmployeeType = "FULL_TIME" | "PART_TIME" | "CONTRACT";
export type PayPeriod = "WEEKLY" | "MONTHLY" | "YEARLY";

export type CommissionRule = {
    salesThreshold: number;    // total company sales required to qualify
    commissionPercent: number; // % of employee's baseSalary
};

export type PayrollSettings = {
    payPeriod: PayPeriod;
    commissionRules: {
        // Keyed by "{role}_{employeeType}", e.g. "manager_FULL_TIME"
        [key: string]: CommissionRule;
    };
    updatedAt: Timestamp;
};

export type SalaryPayment = {
    id: string;
    employeeId: string;
    employeeName: string;
    periodStart: string;  // "2026-02-01"
    periodEnd: string;    // "2026-02-28"
    baseSalary: number;
    daysPresent: number;
    totalWorkHours: number;
    salaryEarned: number;
    companySalesTotal: number;
    employeeSalesTotal: number;
    employeeSalesCount: number;
    commissionEarned: number;
    includeCommission: boolean;
    advanceDeducted: number;
    netAmount: number;
    paymentMethod: PaymentMethod;
    paidBy: string;
    notes?: string;
    proofImageUrls?: string[];
    createdAt: Timestamp;
};

// Printer Types
export type PrinterType = "USB" | "SERIAL" | "BLUETOOTH";
export type PrinterConnection = {
    type: PrinterType;
    // @ts-ignore
    port?: SerialPort;
    // @ts-ignore
    device?: BluetoothDevice;
    isConnected: boolean;
};

