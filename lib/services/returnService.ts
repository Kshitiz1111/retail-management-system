// Return Service - Business logic for sales return operations
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
import {
    SalesReturn,
    SalesReturnItem,
    ReturnReason,
    PaymentMethod,
    Sale,
    Order,
    Customer,
} from "@/lib/types";
import { ProductService } from "./productService";
import { LedgerService } from "./ledgerService";
import { LoyaltyService } from "./loyaltyService";
import { ImageService } from "./imageService";
import { CreditService } from "./creditService";

export class ReturnService {
    /**
     * Generate unique return number
     */
    static generateReturnNumber(): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0");
        return `RET-${timestamp}-${random}`;
    }

    /**
     * Get already-returned quantities for a sale
     * Used to calculate remaining returnable quantities for partial returns
     */
    static async getReturnedQuantities(
        originalId: string,
        source: "POS" | "ONLINE"
    ): Promise<Record<string, number>> {
        try {
            const field =
                source === "POS" ? "originalSaleId" : "originalOrderId";
            const q = query(
                collection(db, "sales_returns"),
                where(field, "==", originalId),
                where("status", "in", ["APPROVED", "COMPLETED"])
            );

            const querySnapshot = await getDocs(q);
            const returnedQty: Record<string, number> = {};

            querySnapshot.forEach((doc) => {
                const ret = doc.data() as SalesReturn;
                for (const item of ret.items) {
                    returnedQty[item.productId] =
                        (returnedQty[item.productId] || 0) + item.quantity;
                }
            });

            return returnedQty;
        } catch (error) {
            console.error("Error fetching returned quantities:", error);
            return {};
        }
    }

    /**
     * Create and process a sales return
     * This is a single-step create+process flow for simplicity
     */
    static async createSalesReturn(data: {
        source: "POS" | "ONLINE";
        originalSaleId?: string;
        originalOrderId?: string;
        originalOrderNumber?: string;
        customerId?: string;
        customerName?: string;
        items: SalesReturnItem[];
        refundMethod: PaymentMethod;
        reason: ReturnReason;
        reasonNotes?: string;
        reasonImageFile?: File;  // legacy single-image
        reasonImageFiles?: File[]; // multi-image support
        processedBy: string;
    }): Promise<string> {
        try {
            const returnNumber = this.generateReturnNumber();
            const totalReturnAmount = data.items.reduce(
                (sum, item) => sum + item.subtotal,
                0
            );

            // Upload reason image(s) if provided
            let reasonImageUrl: string | undefined;
            let reasonImageUrls: string[] | undefined;
            if (data.reasonImageFiles && data.reasonImageFiles.length > 0) {
                const urls = await Promise.all(
                    data.reasonImageFiles.map((f) => ImageService.uploadImage(f, "returns"))
                );
                reasonImageUrls = urls;
                reasonImageUrl = urls[0]; // keep backward-compat single field
            } else if (data.reasonImageFile) {
                reasonImageUrl = await ImageService.uploadImage(
                    data.reasonImageFile,
                    "returns"
                );
            }

            // Build return document — exclude undefined fields for Firestore
            const returnDoc: Record<string, unknown> = {
                returnNumber,
                source: data.source,
                items: data.items,
                totalReturnAmount,
                refundMethod: data.refundMethod,
                reason: data.reason,
                status: "COMPLETED", // process immediately
                processedBy: data.processedBy,
                createdAt: Timestamp.now(),
                completedAt: Timestamp.now(),
            };

            if (data.originalSaleId) returnDoc.originalSaleId = data.originalSaleId;
            if (data.originalOrderId)
                returnDoc.originalOrderId = data.originalOrderId;
            if (data.originalOrderNumber)
                returnDoc.originalOrderNumber = data.originalOrderNumber;
            if (data.customerId) returnDoc.customerId = data.customerId;
            if (data.customerName) returnDoc.customerName = data.customerName;
            if (data.reasonNotes) returnDoc.reasonNotes = data.reasonNotes;
            if (reasonImageUrl) returnDoc.reasonImageUrl = reasonImageUrl;
            if (reasonImageUrls && reasonImageUrls.length > 1) returnDoc.reasonImageUrls = reasonImageUrls;

            // 1. Create the return document
            const returnRef = await addDoc(
                collection(db, "sales_returns"),
                returnDoc
            );
            console.log("returnDoc", returnDoc)

            // 2. Restock inventory
            for (const item of data.items) {
                const product = await ProductService.getProduct(item.productId);
                if (product) {
                    const currentQty =
                        product.warehouses[item.warehouseId]?.quantity || 0;
                    await ProductService.updateWarehouseQuantity(
                        item.productId,
                        item.warehouseId,
                        currentQty + item.quantity
                    );
                }
            }

            // 3. Create contra-revenue ledger entry (negative income)
            await LedgerService.postSalesReturnEntry(
                returnRef.id,
                totalReturnAmount,
                data.refundMethod,
                data.processedBy
            );

            // 4. Handle customer adjustments (if customer exists)
            let loyaltyPointsReversed = 0;
            let creditAdjustment = 0;
            let cashRefundAmount = totalReturnAmount;

            if (data.customerId) {
                const customerRef = doc(db, "customers", data.customerId);
                const customerDoc = await getDoc(customerRef);

                if (customerDoc.exists()) {
                    const customer = customerDoc.data() as Customer;

                    // 4a. Reduce totalSpent
                    await updateDoc(customerRef, {
                        totalSpent: Math.max(
                            0,
                            (customer.totalSpent || 0) - totalReturnAmount
                        ),
                    });

                    // 4b. Reverse loyalty points earned on original sale
                    const rules = await LoyaltyService.getLoyaltyRules();
                    if (rules) {
                        loyaltyPointsReversed = LoyaltyService.calculateEarnedPoints(
                            totalReturnAmount,
                            rules.earnRate
                        );
                        if (loyaltyPointsReversed > 0) {
                            await LoyaltyService.updateCustomerPoints(
                                data.customerId,
                                -loyaltyPointsReversed
                            );
                        }
                    }

                    // 4c. Deduct from customer's outstanding credits if they have any (FIFO)
                    if (data.customerId) {
                        try {
                            // Fetch all outstanding credit_transaction records for this customer
                            const allCredits = await CreditService.getCustomerCredits(data.customerId);
                            const outstanding = allCredits
                                .filter((c) => c.dueAmount > 0)
                                .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()); // Oldest first

                            // Distribute return amount across credits FIFO
                            let remaining = totalReturnAmount;
                            for (const credit of outstanding) {
                                if (remaining <= 0) break;
                                const reduction = Math.min(remaining, credit.dueAmount);
                                if (reduction > 0) {
                                    await CreditService.settleCredit(
                                        credit.id,
                                        reduction,
                                        data.processedBy,
                                        "CREDIT", // payment method = credit adjustment
                                        `Adjusted by sales return ${returnNumber}`
                                    );
                                    creditAdjustment += reduction;
                                    remaining -= reduction;
                                }
                            }
                            cashRefundAmount = totalReturnAmount - creditAdjustment;
                        } catch (creditErr) {
                            console.error("Error adjusting credit transactions:", creditErr);
                            // Don't block the whole return — log and continue
                        }
                    }
                }
            }

            // 5. Update return document with adjustment details
            const updateData: Record<string, unknown> = {};
            if (loyaltyPointsReversed > 0)
                updateData.loyaltyPointsReversed = loyaltyPointsReversed;
            if (creditAdjustment > 0) {
                updateData.creditAdjustment = creditAdjustment;
                updateData.cashRefundAmount = cashRefundAmount;
            }

            if (Object.keys(updateData).length > 0) {
                await updateDoc(doc(db, "sales_returns", returnRef.id), updateData);
            }

            return returnRef.id;
        } catch (error) {
            console.error("Error creating sales return:", error);
            throw error;
        }
    }

    /**
     * Get a sales return by ID
     */
    static async getSalesReturn(
        returnId: string
    ): Promise<SalesReturn | null> {
        try {
            const returnDoc = await getDoc(doc(db, "sales_returns", returnId));
            if (returnDoc.exists()) {
                return { id: returnDoc.id, ...returnDoc.data() } as SalesReturn;
            }
            return null;
        } catch (error) {
            console.error("Error fetching sales return:", error);
            throw error;
        }
    }

    /**
     * Get all sales returns with optional filters
     */
    static async getAllSalesReturns(filters?: {
        status?: SalesReturn["status"];
        source?: "POS" | "ONLINE";
        startDate?: Date;
        endDate?: Date;
        customerId?: string;
    }): Promise<SalesReturn[]> {
        try {
            let q = query(collection(db, "sales_returns"));
            const conditions = [];

            if (filters?.status) {
                conditions.push(where("status", "==", filters.status));
            }
            if (filters?.source) {
                conditions.push(where("source", "==", filters.source));
            }
            if (filters?.customerId) {
                conditions.push(where("customerId", "==", filters.customerId));
            }

            if (conditions.length > 0) {
                q = query(q, ...conditions);
            } else {
                try {
                    q = query(q, orderBy("createdAt", "desc"));
                } catch {
                    // Index might not exist yet
                }
            }

            const querySnapshot = await getDocs(q);
            const returns: SalesReturn[] = [];

            querySnapshot.forEach((doc) => {
                const ret = { id: doc.id, ...doc.data() } as SalesReturn;

                // Apply date filters in memory
                if (filters?.startDate || filters?.endDate) {
                    const retDate = ret.createdAt.toDate();
                    if (filters?.startDate && retDate < filters.startDate) return;
                    if (filters?.endDate && retDate > filters.endDate) return;
                }

                returns.push(ret);
            });

            // Sort by createdAt desc
            returns.sort((a, b) => {
                const aTime = a.createdAt?.toMillis() || 0;
                const bTime = b.createdAt?.toMillis() || 0;
                return bTime - aTime;
            });

            return returns;
        } catch (error) {
            console.error("Error fetching sales returns:", error);
            throw error;
        }
    }

    /**
     * Get sales returns for a specific customer
     */
    static async getSalesReturnsByCustomer(
        customerId: string
    ): Promise<SalesReturn[]> {
        return this.getAllSalesReturns({ customerId });
    }

    /**
     * Get sales returns for a specific sale
     */
    static async getSalesReturnsBySale(
        saleId: string
    ): Promise<SalesReturn[]> {
        try {
            const q = query(
                collection(db, "sales_returns"),
                where("originalSaleId", "==", saleId)
            );
            const querySnapshot = await getDocs(q);
            const returns: SalesReturn[] = [];
            querySnapshot.forEach((doc) => {
                returns.push({ id: doc.id, ...doc.data() } as SalesReturn);
            });
            returns.sort((a, b) => {
                const aTime = a.createdAt?.toMillis() || 0;
                const bTime = b.createdAt?.toMillis() || 0;
                return bTime - aTime;
            });
            return returns;
        } catch (error) {
            console.error("Error fetching returns by sale:", error);
            throw error;
        }
    }

    /**
     * Get sales returns for a specific order
     */
    static async getSalesReturnsByOrder(
        orderId: string
    ): Promise<SalesReturn[]> {
        try {
            const q = query(
                collection(db, "sales_returns"),
                where("originalOrderId", "==", orderId)
            );
            const querySnapshot = await getDocs(q);
            const returns: SalesReturn[] = [];
            querySnapshot.forEach((doc) => {
                returns.push({ id: doc.id, ...doc.data() } as SalesReturn);
            });
            returns.sort((a, b) => {
                const aTime = a.createdAt?.toMillis() || 0;
                const bTime = b.createdAt?.toMillis() || 0;
                return bTime - aTime;
            });
            return returns;
        } catch (error) {
            console.error("Error fetching returns by order:", error);
            throw error;
        }
    }
}
