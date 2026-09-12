// Vendor Service - Business logic for vendor operations
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor, PurchaseOrder, PurchaseOrderItem, PaymentMethod } from "@/lib/types";
import { ProductService } from "./productService";
import { LedgerService } from "./ledgerService";

export class VendorService {
  /**
   * Create a new vendor
   */
  static async createVendor(vendorData: Omit<Vendor, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const vendorRef = await addDoc(collection(db, "vendors"), {
        ...vendorData,
        balance: 0,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return vendorRef.id;
    } catch (error) {
      console.error("Error creating vendor:", error);
      throw error;
    }
  }

  /**
   * Update a vendor
   */
  static async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<void> {
    try {
      const vendorRef = doc(db, "vendors", vendorId);
      await updateDoc(vendorRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating vendor:", error);
      throw error;
    }
  }

  /**
   * Get all vendors
   */
  static async getAllVendors(): Promise<Vendor[]> {
    try {
      const q = query(collection(db, "vendors"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const vendors: Vendor[] = [];
      querySnapshot.forEach((doc) => {
        vendors.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      return vendors;
    } catch (error) {
      console.error("Error fetching vendors:", error);
      throw error;
    }
  }

  /**
   * Get vendor by ID
   */
  static async getVendor(vendorId: string): Promise<Vendor | null> {
    try {
      const vendorDoc = await getDoc(doc(db, "vendors", vendorId));
      if (vendorDoc.exists()) {
        return { id: vendorDoc.id, ...vendorDoc.data() } as Vendor;
      }
      return null;
    } catch (error) {
      console.error("Error fetching vendor:", error);
      throw error;
    }
  }

  /**
   * Create a purchase order
   */
  static async createPurchaseOrder(
    vendorId: string,
    items: PurchaseOrderItem[],
    createdBy: string
  ): Promise<string> {
    try {
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      const poRef = await addDoc(collection(db, "purchase_orders"), {
        vendorId,
        items,
        totalAmount,
        status: "PENDING",
        createdBy,
        createdAt: Timestamp.now(),
      });

      return poRef.id;
    } catch (error) {
      console.error("Error creating purchase order:", error);
      throw error;
    }
  }

  /**
   * Process GRN (Goods Received Note)
   */
  static async processGRN(
    poId: string,
    receivedItems: Array<{ productId: string; receivedQuantity: number; receivedUnitPrice: number; warehouseId: string }>,
    receivedBy: string,
    billImageUrls?: string[]
  ): Promise<void> {
    try {
      const poDoc = await getDoc(doc(db, "purchase_orders", poId));
      if (!poDoc.exists()) {
        throw new Error("Purchase order not found");
      }

      const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;

      // Calculate received total amount based on received prices
      let receivedTotalAmount = 0;
      const updatedItems = po.items.map((item) => {
        const received = receivedItems.find((ri) => ri.productId === item.productId);
        if (received) {
          const itemTotal = received.receivedQuantity * received.receivedUnitPrice;
          receivedTotalAmount += itemTotal;
          return {
            ...item,
            receivedQuantity: received.receivedQuantity,
            receivedUnitPrice: received.receivedUnitPrice,
          };
        }
        return {
          ...item,
          receivedQuantity: 0,
        };
      });

      // Update purchase order status
      const updateData: any = {
        status: "RECEIVED",
        receivedAt: Timestamp.now(),
        receivedBy,
        items: updatedItems,
        receivedTotalAmount,
      };
      if (billImageUrls && billImageUrls.length > 0) {
        updateData.billImageUrls = billImageUrls;
        // Keep billImageUrl as the first image for backward compatibility if needed
        updateData.billImageUrl = billImageUrls[0];
      }
      await updateDoc(doc(db, "purchase_orders", poId), updateData);

      // Update inventory for each received item
      for (const receivedItem of receivedItems) {
        const poItem = po.items.find((item) => item.productId === receivedItem.productId);
        if (poItem) {
          // Get current product warehouse data
          const product = await ProductService.getProduct(receivedItem.productId);
          if (product) {
            const currentQty = product.warehouses[receivedItem.warehouseId]?.quantity || 0;
            await ProductService.updateWarehouseQuantity(
              receivedItem.productId,
              receivedItem.warehouseId,
              currentQty + receivedItem.receivedQuantity
            );
            // Update product cost price to the received unit price
            if (receivedItem.receivedUnitPrice > 0) {
              await ProductService.updateProduct(receivedItem.productId, {
                costPrice: receivedItem.receivedUnitPrice,
              });
            }
          }
        }
      }

      // Update vendor balance (Accounts Payable) using received total amount
      const vendor = await this.getVendor(po.vendorId);
      if (vendor) {
        await this.updateVendor(po.vendorId, {
          balance: vendor.balance + receivedTotalAmount,
        });
      }

      // Create ledger entry for the purchase expense using received amount
      const { LedgerService } = await import("@/lib/services/ledgerService");
      await LedgerService.postPurchaseExpense(
        poId,
        receivedTotalAmount,
        "CREDIT", // Purchase orders are typically on credit
        receivedBy
      );
    } catch (error) {
      console.error("Error processing GRN:", error);
      throw error;
    }
  }

  /**
   * Get all purchase orders
   */
  static async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
      const q = query(collection(db, "purchase_orders"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const orders: PurchaseOrder[] = [];
      querySnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
      });
      return orders;
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      throw error;
    }
  }

  /**
   * Get purchase orders by date range
   */
  static async getPurchaseOrdersByDateRange(startDate: Date, endDate: Date): Promise<PurchaseOrder[]> {
    try {
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const q = query(
        collection(db, "purchase_orders"),
        where("createdAt", ">=", startTimestamp),
        where("createdAt", "<=", endTimestamp),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const orders: PurchaseOrder[] = [];
      querySnapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() } as PurchaseOrder);
      });
      return orders;
    } catch (error) {
      console.error("Error fetching purchase orders by date range:", error);
      // Fallback: fetch all and filter in memory
      try {
        const allOrders = await this.getAllPurchaseOrders();
        return allOrders.filter((po) => {
          const poDate = po.createdAt.toDate();
          return poDate >= startDate && poDate <= endDate;
        });
      } catch (fallbackError) {
        console.error("Error in fallback purchase order fetch:", fallbackError);
        throw error;
      }
    }
  }

  /**
   * Get purchase order by ID
   */
  static async getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
    try {
      const poDoc = await getDoc(doc(db, "purchase_orders", poId));
      if (poDoc.exists()) {
        return { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;
      }
      return null;
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      throw error;
    }
  }

  /**
   * Get purchase orders containing a specific product
   */
  static async getPurchaseOrdersByProduct(productId: string): Promise<PurchaseOrder[]> {
    try {
      const q = query(collection(db, "purchase_orders"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const orders: PurchaseOrder[] = [];
      querySnapshot.forEach((doc) => {
        const po = { id: doc.id, ...doc.data() } as PurchaseOrder;
        // Filter to only include POs that contain this product
        if (po.items.some((item) => item.productId === productId)) {
          orders.push(po);
        }
      });
      return orders;
    } catch (error) {
      console.error("Error fetching purchase orders by product:", error);
      throw error;
    }
  }

  /**
   * Settle vendor payment
   */
  static async settleVendorPayment(
    vendorId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    performedBy: string,
    notes?: string,
    imageUrl?: string
  ): Promise<void> {
    try {
      const vendor = await this.getVendor(vendorId);
      if (!vendor) {
        throw new Error("Vendor not found");
      }

      if (amount > vendor.balance) {
        throw new Error("Payment amount cannot exceed outstanding balance");
      }

      // Update vendor balance
      const newBalance = vendor.balance - amount;
      await this.updateVendor(vendorId, {
        balance: newBalance,
      });

      // Create payment record in subcollection - only include fields that have values
      const paymentData: any = {
        amount,
        paymentMethod,
        performedBy,
        createdAt: Timestamp.now(),
      };

      // Only add notes if it has a value
      if (notes && notes.trim()) {
        paymentData.notes = notes.trim();
      }

      // Only add imageUrl if it has a value
      if (imageUrl) {
        paymentData.imageUrl = imageUrl;
      }

      await addDoc(collection(db, "vendors", vendorId, "payments"), paymentData);

      // Note: We do NOT create a ledger expense entry here because:
      // - The expense was already recorded when GRN was processed (PURCHASE category)
      // - This payment is just reducing Accounts Payable (vendor balance)
      // - Following accrual accounting: expense recorded when goods received, not when paid
    } catch (error) {
      console.error("Error settling vendor payment:", error);
      throw error;
    }
  }

  /**
   * Get vendor payment history
   */
  static async getVendorPaymentHistory(vendorId: string): Promise<Array<{
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    imageUrl?: string;
    performedBy: string;
    createdAt: Timestamp;
  }>> {
    try {
      const paymentsQuery = query(
        collection(db, "vendors", vendorId, "payments"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(paymentsQuery);
      const payments: Array<{
        id: string;
        amount: number;
        paymentMethod: PaymentMethod;
        notes?: string;
        imageUrl?: string;
        performedBy: string;
        createdAt: Timestamp;
      }> = [];
      querySnapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() } as any);
      });
      return payments;
    } catch (error: unknown) {
      // If index is missing, fetch without orderBy and sort in memory
      const err = error as { code?: string; message?: string };
      if (err.code === "failed-precondition" || err.message?.includes("index")) {
        try {
          const paymentsQuery = query(collection(db, "vendors", vendorId, "payments"));
          const querySnapshot = await getDocs(paymentsQuery);
          const payments: Array<{
            id: string;
            amount: number;
            paymentMethod: PaymentMethod;
            notes?: string;
            imageUrl?: string;
            performedBy: string;
            createdAt: Timestamp;
          }> = [];
          querySnapshot.forEach((doc) => {
            payments.push({ id: doc.id, ...doc.data() } as any);
          });
          payments.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });
          return payments;
        } catch (fallbackError) {
          console.error("Error fetching vendor payment history (fallback):", fallbackError);
          throw fallbackError;
        }
      }
      console.error("Error fetching vendor payment history:", error);
      throw error;
    }
  }

  /**
   * Get already-returned quantities for a purchase order
   * Used to calculate remaining returnable quantities for partial returns
   */
  static async getReturnedVendorQuantities(
    purchaseOrderId: string
  ): Promise<Record<string, number>> {
    try {
      const q = query(
        collection(db, "vendor_returns"),
        where("originalPurchaseOrderId", "==", purchaseOrderId),
        where("status", "in", ["APPROVED", "COMPLETED"])
      );

      const querySnapshot = await getDocs(q);
      const returnedQty: Record<string, number> = {};

      querySnapshot.forEach((docSnap) => {
        const ret = docSnap.data();
        for (const item of ret.items || []) {
          returnedQty[item.productId] =
            (returnedQty[item.productId] || 0) + item.quantity;
        }
      });

      return returnedQty;
    } catch (error) {
      console.error("Error fetching returned vendor quantities:", error);
      return {};
    }
  }

  /**
   * Create and process a vendor (purchase) return
   */
  static async createVendorReturn(data: {
    vendorId: string;
    vendorName: string;
    originalPurchaseOrderId?: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      warehouseId: string;
      reason?: string;
    }>;
    reason: string;
    reasonNotes?: string;
    reasonImageUrls?: string[];
    creditNoteNumber?: string;
    processedBy: string;
  }): Promise<string> {
    try {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const returnNumber = `VRET-${timestamp}-${random}`;

      const totalReturnAmount = data.items.reduce(
        (sum, item) => sum + item.subtotal,
        0
      );

      // Calculate AP auto-deduction vs pending refund
      const vendor = await this.getVendor(data.vendorId);
      const vendorBalance = vendor?.balance || 0;
      const autoDeductedAmount = Math.min(vendorBalance, totalReturnAmount);
      const pendingRefundAmount = totalReturnAmount - autoDeductedAmount;

      let refundStatus: "AUTO_DEDUCTED" | "PENDING_REFUND" = "AUTO_DEDUCTED";
      if (pendingRefundAmount > 0) {
        refundStatus = "PENDING_REFUND";
      }

      // Build return document — exclude undefined fields for Firestore
      const returnDoc: Record<string, unknown> = {
        returnNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        items: data.items,
        totalReturnAmount,
        reason: data.reason,
        status: "COMPLETED",
        processedBy: data.processedBy,
        // Refund tracking
        refundStatus,
        refundAmount: totalReturnAmount,
        autoDeductedAmount,
        pendingRefundAmount,
        createdAt: Timestamp.now(),
        completedAt: Timestamp.now(),
      };

      if (data.originalPurchaseOrderId)
        returnDoc.originalPurchaseOrderId = data.originalPurchaseOrderId;
      if (data.reasonNotes) returnDoc.reasonNotes = data.reasonNotes;
      if (data.reasonImageUrls && data.reasonImageUrls.length > 0) {
        returnDoc.reasonImageUrls = data.reasonImageUrls;
        // Keep reasonImageUrl for backward compatibility
        returnDoc.reasonImageUrl = data.reasonImageUrls[0];
      }
      if (data.creditNoteNumber)
        returnDoc.creditNoteNumber = data.creditNoteNumber;

      // 1. Create the return document
      const returnRef = await addDoc(
        collection(db, "vendor_returns"),
        returnDoc
      );

      // 2. Deduct inventory for each returned item
      for (const item of data.items) {
        const product = await ProductService.getProduct(item.productId);
        if (product) {
          const currentQty =
            product.warehouses[item.warehouseId]?.quantity || 0;
          await ProductService.updateWarehouseQuantity(
            item.productId,
            item.warehouseId,
            Math.max(0, currentQty - item.quantity)
          );
        }
      }

      // 3. Create contra-expense ledger entry (negative expense)
      await LedgerService.postPurchaseReturnEntry(
        returnRef.id,
        totalReturnAmount,
        data.processedBy
      );

      // 4. Reduce vendor balance (AP) by auto-deducted amount only
      if (vendor && autoDeductedAmount > 0) {
        await this.updateVendor(data.vendorId, {
          balance: Math.max(0, vendor.balance - autoDeductedAmount),
        });
      }

      return returnRef.id;
    } catch (error) {
      console.error("Error creating vendor return:", error);
      throw error;
    }
  }

  /**
   * Get vendor returns for a specific vendor
   */
  static async getVendorReturns(
    vendorId: string
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const q = query(
        collection(db, "vendor_returns"),
        where("vendorId", "==", vendorId)
      );
      const querySnapshot = await getDocs(q);
      const returns: Array<Record<string, unknown>> = [];
      querySnapshot.forEach((docSnap) => {
        returns.push({ id: docSnap.id, ...docSnap.data() });
      });
      returns.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      return returns;
    } catch (error) {
      console.error("Error fetching vendor returns:", error);
      throw error;
    }
  }

  /**
   * Get all vendor returns
   */
  static async getAllVendorReturns(): Promise<
    Array<Record<string, unknown>>
  > {
    try {
      let q;
      try {
        q = query(
          collection(db, "vendor_returns"),
          orderBy("createdAt", "desc")
        );
      } catch {
        q = query(collection(db, "vendor_returns"));
      }

      const querySnapshot = await getDocs(q);
      const returns: Array<Record<string, unknown>> = [];
      querySnapshot.forEach((docSnap) => {
        returns.push({ id: docSnap.id, ...docSnap.data() });
      });
      returns.sort((a: any, b: any) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
      return returns;
    } catch (error) {
      console.error("Error fetching all vendor returns:", error);
      throw error;
    }
  }

  /**
   * Get a single vendor return by ID
   */
  static async getVendorReturn(
    returnId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const docRef = doc(db, "vendor_returns", returnId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
      console.error("Error fetching vendor return:", error);
      throw error;
    }
  }

  /**
   * Mark a vendor return refund as received
   * Used when vendor AP was insufficient and vendor owes us money
   */
  static async markVendorReturnRefundReceived(
    returnId: string,
    receivedBy: string
  ): Promise<void> {
    try {
      const returnRef = doc(db, "vendor_returns", returnId);
      await updateDoc(returnRef, {
        refundStatus: "REFUND_RECEIVED",
        refundReceivedAt: Timestamp.now(),
        refundReceivedBy: receivedBy,
      });
    } catch (error) {
      console.error("Error marking refund received:", error);
      throw error;
    }
  }
}

