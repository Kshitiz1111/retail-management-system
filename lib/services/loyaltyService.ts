// Loyalty Service - Business logic for loyalty points and rewards
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoyaltyRules, Customer } from "@/lib/types";

export class LoyaltyService {
  /**
   * Get current loyalty rules
   */
  static async getLoyaltyRules(): Promise<LoyaltyRules | null> {
    try {
      const rulesDoc = await getDoc(doc(db, "loyalty_rules", "current"));
      if (!rulesDoc.exists()) {
        // Return default rules if none exist
        return {
          earnRate: 0.001, // 1 point per Rs 1000
          redeemRate: 1, // 1 point = Rs 1 discount
          minPointsToRedeem: 10,
          updatedAt: Timestamp.now(),
        };
      }
      return rulesDoc.data() as LoyaltyRules;
    } catch (error) {
      console.error("Error fetching loyalty rules:", error);
      return null;
    }
  }

  /**
   * Update loyalty rules (admin only)
   */
  static async updateLoyaltyRules(rules: Omit<LoyaltyRules, "updatedAt">): Promise<void> {
    try {
      await setDoc(
        doc(db, "loyalty_rules", "current"),
        {
          ...rules,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error updating loyalty rules:", error);
      throw error;
    }
  }

  /**
   * Calculate points earned from order total
   */
  static calculateEarnedPoints(orderTotal: number, earnRate: number): number {
    return Math.floor(orderTotal * earnRate);
  }

  /**
   * Calculate discount amount from points
   */
  static calculateDiscount(points: number, redeemRate: number, orderTotal: number): number {
    const discount = points * redeemRate;
    // Discount cannot exceed order total
    return Math.min(discount, orderTotal);
  }

  /**
   * Calculate maximum points that can be redeemed for an order
   */
  static calculateMaxRedeemablePoints(
    customerPoints: number,
    orderTotal: number,
    redeemRate: number,
    minPointsToRedeem: number
  ): number {
    if (customerPoints < minPointsToRedeem) {
      return 0;
    }
    // Maximum discount is the order total
    const maxDiscount = orderTotal;
    const maxPoints = Math.floor(maxDiscount / redeemRate);
    return Math.min(maxPoints, customerPoints);
  }

  /**
   * Update customer loyalty points
   */
  static async updateCustomerPoints(
    customerId: string,
    pointsChange: number
  ): Promise<void> {
    try {
      const customerRef = doc(db, "customers", customerId);
      const customerDoc = await getDoc(customerRef);
      
      if (!customerDoc.exists()) {
        throw new Error("Customer not found");
      }

      const customer = customerDoc.data() as Customer;
      const newPoints = Math.max(0, (customer.loyaltyPoints || 0) + pointsChange);

      await updateDoc(customerRef, {
        loyaltyPoints: newPoints,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating customer points:", error);
      throw error;
    }
  }

  /**
   * Get customer loyalty points
   */
  static async getCustomerPoints(customerId: string): Promise<number> {
    try {
      const customerDoc = await getDoc(doc(db, "customers", customerId));
      if (!customerDoc.exists()) {
        return 0;
      }
      const customer = customerDoc.data() as Customer;
      return customer.loyaltyPoints || 0;
    } catch (error) {
      console.error("Error fetching customer points:", error);
      return 0;
    }
  }
}

