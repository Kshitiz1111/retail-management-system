// Ledger Service - Business logic for financial ledger operations
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  sum,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LedgerEntry, LedgerEntryType, LedgerCategory, PaymentMethod } from "@/lib/types";

export class LedgerService {
  /**
   * Create a ledger entry
   */
  static async createEntry(
    entry: Omit<LedgerEntry, "id" | "createdAt">
  ): Promise<string> {
    try {
      const entryRef = await addDoc(collection(db, "finance_ledger"), {
        ...entry,
        createdAt: Timestamp.now(),
      });
      return entryRef.id;
    } catch (error) {
      console.error("Error creating ledger entry:", error);
      throw error;
    }
  }

  /**
   * Auto-post income entry for a sale
   */
  static async postSaleIncome(
    saleId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    performedBy: string
  ): Promise<string> {
    return this.createEntry({
      date: Timestamp.now(),
      type: "INCOME",
      category: "SALES",
      amount,
      description: `Sale #${saleId}`,
      relatedId: saleId,
      paymentMethod,
      performedBy,
    });
  }

  /**
   * Auto-post expense entry for a purchase
   */
  static async postPurchaseExpense(
    purchaseOrderId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    performedBy: string
  ): Promise<string> {
    return this.createEntry({
      date: Timestamp.now(),
      type: "EXPENSE",
      category: "PURCHASE",
      amount,
      description: `Purchase Order #${purchaseOrderId}`,
      relatedId: purchaseOrderId,
      paymentMethod,
      performedBy,
    });
  }

  /**
   * Create manual expense entry
   */
  static async createExpense(
    category: LedgerCategory,
    amount: number,
    description: string,
    paymentMethod: PaymentMethod,
    performedBy: string
  ): Promise<string> {
    return this.createEntry({
      date: Timestamp.now(),
      type: "EXPENSE",
      category,
      amount,
      description,
      paymentMethod,
      performedBy,
    });
  }

  /**
   * Auto-post contra-revenue entry for a sales return (negative income)
   */
  static async postSalesReturnEntry(
    returnId: string,
    amount: number,
    refundMethod: PaymentMethod,
    performedBy: string
  ): Promise<string> {
    return this.createEntry({
      date: Timestamp.now(),
      type: "INCOME",
      category: "SALES_RETURN",
      amount: -amount, // Negative amount = contra-revenue
      description: `Sales Return #${returnId}`,
      relatedId: returnId,
      paymentMethod: refundMethod,
      performedBy,
    });
  }

  /**
   * Auto-post contra-expense entry for a vendor/purchase return (negative expense)
   */
  static async postPurchaseReturnEntry(
    returnId: string,
    amount: number,
    performedBy: string
  ): Promise<string> {
    return this.createEntry({
      date: Timestamp.now(),
      type: "EXPENSE",
      category: "PURCHASE_RETURN",
      amount: -amount, // Negative amount = contra-expense
      description: `Purchase Return #${returnId}`,
      relatedId: returnId,
      paymentMethod: "CASH", // Vendor returns default to cash
      performedBy,
    });
  }

  /**
   * Get daily P&L (Profit & Loss)
   */
  static async getDailyPL(date: Date): Promise<{ income: number; expense: number; net: number }> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "finance_ledger"),
        where("date", ">=", Timestamp.fromDate(startOfDay)),
        where("date", "<=", Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(q);
      let income = 0;
      let expense = 0;

      querySnapshot.forEach((doc) => {
        const entry = doc.data() as LedgerEntry;
        // Exclude credit settlement entries (these are just collections, not new income)
        const isCreditSettlement = entry.category === "SALES" &&
          entry.description?.toLowerCase().includes("credit settlement");

        if (entry.type === "INCOME" && !isCreditSettlement) {
          // SALES_RETURN entries have negative amounts, so they reduce income naturally
          income += entry.amount;
        } else if (entry.type === "EXPENSE" && entry.category !== "VENDOR_PAY") {
          // PURCHASE_RETURN entries have negative amounts, so they reduce expenses naturally
          expense += entry.amount;
        }
      });

      return {
        income,
        expense,
        net: income - expense,
      };
    } catch (error) {
      console.error("Error calculating daily P&L:", error);
      throw error;
    }
  }

  /**
   * Get all ledger entries for a date range
   */
  static async getEntries(
    startDate: Date,
    endDate: Date,
    type?: LedgerEntryType
  ): Promise<LedgerEntry[]> {
    try {
      let q = query(
        collection(db, "finance_ledger"),
        where("date", ">=", Timestamp.fromDate(startDate)),
        where("date", "<=", Timestamp.fromDate(endDate)),
        orderBy("date", "desc")
      );

      if (type) {
        q = query(q, where("type", "==", type));
      }

      const querySnapshot = await getDocs(q);
      const entries: LedgerEntry[] = [];
      querySnapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as LedgerEntry);
      });

      return entries;
    } catch (error) {
      console.error("Error fetching ledger entries:", error);
      throw error;
    }
  }

  /**
   * Get day book (all transactions for today)
   */
  static async getDayBook(): Promise<LedgerEntry[]> {
    const today = new Date();
    return this.getEntries(today, today);
  }
}

