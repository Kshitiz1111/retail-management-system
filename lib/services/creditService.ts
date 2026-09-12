// Credit Service - Business logic for customer credit operations
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
import { CreditTransaction, Customer, PaymentMethod } from "@/lib/types";
import { LedgerService } from "./ledgerService";

export class CreditService {
  /**
   * Create a credit transaction from a sale
   */
  static async createCreditTransaction(
    customerId: string,
    saleId: string,
    items: CreditTransaction["items"],
    totalAmount: number,
    paidAmount: number
  ): Promise<string> {
    try {
      const dueAmount = totalAmount - paidAmount;

      const creditRef = await addDoc(collection(db, "credit_transactions"), {
        customerId,
        saleId,
        items,
        totalAmount,
        paidAmount,
        dueAmount,
        createdAt: Timestamp.now(),
        settlementHistory: [],
      });

      // Update customer total due (if customer document exists)
      const customerRef = doc(db, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const customer = customerDoc.data() as Customer;
        await updateDoc(customerRef, {
          totalDue: (customer.totalDue || 0) + dueAmount,
        });
      }

      return creditRef.id;
    } catch (error) {
      console.error("Error creating credit transaction:", error);
      throw error;
    }
  }

  /**
   * Settle a credit (partial or full payment)
   */
  static async settleCredit(
    creditId: string,
    amount: number,
    settledBy: string,
    paymentMethod: PaymentMethod,
    notes?: string
  ): Promise<void> {
    try {
      const creditRef = doc(db, "credit_transactions", creditId);
      const creditDoc = await getDoc(creditRef);

      if (!creditDoc.exists()) {
        throw new Error("Credit transaction not found");
      }

      const credit = { id: creditDoc.id, ...creditDoc.data() } as CreditTransaction;

      if (amount > credit.dueAmount) {
        throw new Error("Settlement amount cannot exceed due amount");
      }

      const newPaidAmount = credit.paidAmount + amount;
      const newDueAmount = credit.dueAmount - amount;
      const isFullySettled = newDueAmount === 0;

      // Build settlement history entry - only include notes if defined
      const settlementEntry: any = {
        amount,
        date: Timestamp.now(),
        settledBy,
      };

      // Only add notes if it's defined (Firestore doesn't allow undefined)
      if (notes) {
        settlementEntry.notes = notes;
      }

      // Build update object - only include settledAt if fully settled
      const updateData: any = {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        settlementHistory: [
          ...(credit.settlementHistory || []),
          settlementEntry,
        ],
      };

      // Only add settledAt if fully settled (Firestore doesn't allow undefined)
      if (isFullySettled) {
        updateData.settledAt = Timestamp.now();
      }

      // Update credit transaction
      await updateDoc(creditRef, updateData);

      // Update customer total due
      const customerRef = doc(db, "customers", credit.customerId);
      const customerDoc = await getDoc(customerRef);
      if (customerDoc.exists()) {
        const customer = customerDoc.data() as Customer;
        await updateDoc(customerRef, {
          totalDue: Math.max(0, (customer.totalDue || 0) - amount),
        });
      }

      // Note: We do NOT create a ledger income entry here because:
      // - The income was already recorded when the sale was made (full total amount)
      // - This settlement is just reducing Accounts Receivable (customer credit)
      // - Following accrual accounting: income recorded when sale made, not when collected
    } catch (error) {
      console.error("Error settling credit:", error);
      throw error;
    }
  }

  /**
   * Get all credits for a customer
   */
  static async getCustomerCredits(customerId: string): Promise<CreditTransaction[]> {
    try {
      const q = query(
        collection(db, "credit_transactions"),
        where("customerId", "==", customerId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const credits: CreditTransaction[] = [];
      querySnapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as CreditTransaction);
      });

      return credits;
    } catch (error) {
      console.error("Error fetching customer credits:", error);
      throw error;
    }
  }

  /**
   * Get all outstanding credits
   */
  static async getAllOutstandingCredits(): Promise<CreditTransaction[]> {
    try {
      const q = query(
        collection(db, "credit_transactions"),
        where("dueAmount", ">", 0),
        orderBy("dueAmount", "desc")
      );

      const querySnapshot = await getDocs(q);
      const credits: CreditTransaction[] = [];
      querySnapshot.forEach((doc) => {
        credits.push({ id: doc.id, ...doc.data() } as CreditTransaction);
      });

      return credits;
    } catch (error) {
      console.error("Error fetching outstanding credits:", error);
      throw error;
    }
  }

  /**
   * Get all credit transactions for a specific sale
   * Used during sales returns to identify which credits to reduce
   * Returns records sorted oldest-first for FIFO distribution
   */
  static async getCreditsForSale(saleId: string): Promise<CreditTransaction[]> {
    try {
      const q = query(
        collection(db, "credit_transactions"),
        where("saleId", "==", saleId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(q);
      const credits: CreditTransaction[] = [];
      snapshot.forEach((d) => {
        credits.push({ id: d.id, ...d.data() } as CreditTransaction);
      });
      return credits;
    } catch (error) {
      console.error("Error fetching credits for sale:", error);
      throw error;
    }
  }

  /**
   * Get credit transaction by ID
   */
  static async getCreditTransaction(creditId: string): Promise<CreditTransaction | null> {
    try {
      const creditDoc = await getDoc(doc(db, "credit_transactions", creditId));
      if (creditDoc.exists()) {
        return { id: creditDoc.id, ...creditDoc.data() } as CreditTransaction;
      }
      return null;
    } catch (error) {
      console.error("Error fetching credit transaction:", error);
      throw error;
    }
  }
}
