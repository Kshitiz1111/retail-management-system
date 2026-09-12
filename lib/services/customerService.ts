// Customer Service - Business logic for customer operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer, Sale, Order } from "@/lib/types";
import { OrderService } from "./orderService";

export class CustomerService {
  /**
   * Recalculate totalSpent for a customer from their sales and orders
   */
  static async recalculateTotalSpent(customerId: string): Promise<number> {
    try {
      // Get total from unified method (includes both sales and orders)
      const calculatedTotal = await this.getCustomerSalesTotal(customerId);

      // Update customer document
      const customerRef = doc(db, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      
      if (customerDoc.exists()) {
        await updateDoc(customerRef, {
          totalSpent: calculatedTotal,
        });
      }

      return calculatedTotal;
    } catch (error) {
      console.error("Error recalculating totalSpent:", error);
      throw error;
    }
  }

  /**
   * Get customer sales and calculate totalSpent (includes both POS sales and online orders)
   */
  static async getCustomerSalesTotal(customerId: string): Promise<number> {
    try {
      // Get POS sales
      const salesQuery = query(
        collection(db, "sales"),
        where("customerId", "==", customerId)
      );
      const salesSnapshot = await getDocs(salesQuery);
      let salesTotal = 0;
      salesSnapshot.forEach((doc) => {
        const sale = doc.data() as Sale;
        salesTotal += sale.total;
      });

      // Get online orders
      const orders = await OrderService.getAllOrders({ customerId });
      const ordersTotal = orders
        .filter((order) => order.status !== "CANCELLED")
        .reduce((sum, order) => sum + order.total, 0);

      return salesTotal + ordersTotal;
    } catch (error) {
      console.error("Error calculating customer sales total:", error);
      return 0;
    }
  }

  /**
   * Get unified customer transaction history (both POS sales and online orders)
   */
  static async getCustomerTransactionHistory(customerId: string): Promise<Array<{
    id: string;
    type: "SALE" | "ORDER";
    source: "POS" | "ONLINE";
    total: number;
    date: Date;
    status?: string;
    orderNumber?: string;
    saleId?: string;
  }>> {
    try {
      const transactions: Array<{
        id: string;
        type: "SALE" | "ORDER";
        source: "POS" | "ONLINE";
        total: number;
        date: Date;
        status?: string;
        orderNumber?: string;
        saleId?: string;
      }> = [];

      // Fetch POS sales
      const salesQuery = query(
        collection(db, "sales"),
        where("customerId", "==", customerId)
      );
      const salesSnapshot = await getDocs(salesQuery);
      salesSnapshot.forEach((doc) => {
        const sale = doc.data() as Sale;
        transactions.push({
          id: doc.id,
          type: "SALE",
          source: sale.source || "POS",
          total: sale.total,
          date: sale.createdAt.toDate(),
          saleId: doc.id,
        });
      });

      // Fetch online orders
      const orders = await OrderService.getAllOrders({ customerId });
      orders.forEach((order) => {
        transactions.push({
          id: order.id,
          type: "ORDER",
          source: order.source || "ONLINE",
          total: order.total,
          date: order.createdAt.toDate(),
          status: order.status,
          orderNumber: order.orderNumber,
        });
      });

      // Sort by date (newest first)
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

      return transactions;
    } catch (error) {
      console.error("Error fetching customer transaction history:", error);
      return [];
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customerDoc = await getDoc(doc(db, "customers", customerId));
      if (customerDoc.exists()) {
        return { id: customerDoc.id, ...customerDoc.data() } as Customer;
      }
      return null;
    } catch (error) {
      console.error("Error fetching customer:", error);
      throw error;
    }
  }
}

