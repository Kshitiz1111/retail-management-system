// Sale Service - Business logic for POS sales operations
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Sale, SaleItem, PaymentMethod, Customer } from "@/lib/types";
import { CreditService } from "./creditService";
import { LedgerService } from "./ledgerService";
import { ProductService } from "./productService";

export class SaleService {
  /**
   * Create a sale
   */
  static async createSale(
    saleData: Omit<Sale, "id" | "createdAt">,
    customerId?: string
  ): Promise<string> {
    try {
      // Create sale document - only include customerId if it's defined
      const saleDoc: any = {
        ...saleData,
        createdAt: Timestamp.now(),
      };
      
      // Only add customerId if it's not undefined
      if (customerId) {
        saleDoc.customerId = customerId;
      }

      const saleRef = await addDoc(collection(db, "sales"), saleDoc);

      // Update customer totalSpent if customerId is provided
      if (customerId) {
        const customerRef = doc(db, "customers", customerId);
        const customerDoc = await getDoc(customerRef);
        if (customerDoc.exists()) {
          const customer = customerDoc.data() as Customer;
          await updateDoc(customerRef, {
            totalSpent: (customer.totalSpent || 0) + saleData.total,
          });
        }
      }

      // Update inventory for each item
      for (const item of saleData.items) {
        // Find the first warehouse with stock (simplified - in production, you'd select warehouse)
        const product = await ProductService.getProduct(item.productId);
        if (product) {
          const warehouseId = Object.keys(product.warehouses)[0];
          if (warehouseId) {
            const currentQty = product.warehouses[warehouseId].quantity;
            await ProductService.updateWarehouseQuantity(
              item.productId,
              warehouseId,
              currentQty - item.quantity
            );
          }
        }
      }

      // Handle credit transaction if there's a due amount
      if (saleData.dueAmount > 0 && customerId) {
        const creditItems = saleData.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          status: "CREDIT" as const,
        }));

        await CreditService.createCreditTransaction(
          customerId,
          saleRef.id,
          creditItems,
          saleData.total,
          saleData.paidAmount
        );
      }

      // Create ledger entry for full sale total (accrual accounting principle)
      // Record income when sale is made, regardless of payment method (cash or credit)
      await LedgerService.postSaleIncome(
        saleRef.id,
        saleData.total, // Record full total, not just paidAmount
        saleData.paymentMethod,
        saleData.performedBy
      );

      return saleRef.id;
    } catch (error) {
      console.error("Error creating sale:", error);
      throw error;
    }
  }

  /**
   * Get a sale by ID
   */
  static async getSale(saleId: string): Promise<Sale | null> {
    try {
      const saleDoc = await getDoc(doc(db, "sales", saleId));
      if (saleDoc.exists()) {
        return { id: saleDoc.id, ...saleDoc.data() } as Sale;
      }
      return null;
    } catch (error) {
      console.error("Error fetching sale:", error);
      throw error;
    }
  }

  /**
   * Get sales for a date range
   */
  static async getSales(startDate: Date, endDate: Date): Promise<Sale[]> {
    try {
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      const q = query(
        collection(db, "sales"),
        where("createdAt", ">=", startTimestamp),
        where("createdAt", "<=", endTimestamp),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const sales: Sale[] = [];
      querySnapshot.forEach((doc) => {
        sales.push({ id: doc.id, ...doc.data() } as Sale);
      });

      return sales;
    } catch (error) {
      console.error("Error fetching sales:", error);
      throw error;
    }
  }
}

