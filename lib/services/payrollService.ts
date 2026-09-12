// Payroll Service - Business logic for salary payments and commissions
import {
    collection,
    doc,
    addDoc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    PayrollSettings,
    SalaryPayment,
    User,
    PayPeriod,
    PaymentMethod,
} from "@/lib/types";
import { HRService } from "./hrService";
import { SaleService } from "./saleService";
import { LedgerService } from "./ledgerService";

export class PayrollService {
    /**
     * Get current payroll settings
     */
    static async getPayrollSettings(): Promise<PayrollSettings | null> {
        try {
            const settingsDoc = await getDoc(doc(db, "payroll_settings", "current"));
            if (!settingsDoc.exists()) {
                // Return default settings if none exist
                return {
                    payPeriod: "MONTHLY",
                    commissionRules: {},
                    updatedAt: Timestamp.now(),
                };
            }
            return settingsDoc.data() as PayrollSettings;
        } catch (error) {
            console.error("Error fetching payroll settings:", error);
            return null;
        }
    }

    /**
     * Update payroll settings
     */
    static async updatePayrollSettings(
        settings: Omit<PayrollSettings, "updatedAt">
    ): Promise<void> {
        try {
            await setDoc(
                doc(db, "payroll_settings", "current"),
                {
                    ...settings,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        } catch (error) {
            console.error("Error updating payroll settings:", error);
            throw error;
        }
    }

    /**
     * Get company-wide sales for a date range (POS + Online)
     */
    static async getCompanySalesTotal(
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            // In a real system, we'd query multiple collections or a unified sales collection
            // For now, let's use SaleService.getSales (POS)
            const sales = await SaleService.getSales(startDate, endDate);
            const total = sales.reduce((sum, sale) => sum + sale.total, 0);
            return total;
        } catch (error) {
            console.error("Error calculating company sales total:", error);
            return 0;
        }
    }

    /**
     * Calculate payroll for an employee for a specific period
     */
    static async calculatePayroll(
        employeeId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        baseSalary: number;
        daysPresent: number;
        totalWorkHours: number;
        salaryEarned: number;
        companySalesTotal: number;
        employeeSalesTotal: number;
        employeeSalesCount: number;
        commissionEarned: number;
        advances: number;
        unpaidCommissions: number;
        netAmount: number;
    }> {
        try {
            const userDoc = await getDoc(doc(db, "users", employeeId));
            if (!userDoc.exists()) throw new Error("Employee not found");
            const employee = { id: userDoc.id, ...userDoc.data() } as User;

            // 1. Get Attendance info
            const startStr = startDate.toISOString().split("T")[0];
            const endStr = endDate.toISOString().split("T")[0];
            const attendanceRecords = await HRService.getAttendanceRecords(
                employeeId,
                startStr,
                endStr
            );

            const daysPresent = attendanceRecords.filter((r) => r.checkOut).length;
            const totalWorkHours = attendanceRecords.reduce(
                (sum, r) => sum + (r.totalHours || 0),
                0
            );

            // Simple salary calculation: (Base Salary / 30) * days present
            // In production, this might be more complex (business days, etc.)
            const baseSalary = employee.baseSalary || 0;
            const salaryEarned = (baseSalary / 30) * daysPresent;

            // 2. Get Sales info
            const companySalesTotal = await this.getCompanySalesTotal(startDate, endDate);

            // Individual employee sales (for display)
            const q = query(
                collection(db, "sales"),
                where("performedBy", "==", employeeId),
                where("createdAt", ">=", Timestamp.fromDate(startDate)),
                where("createdAt", "<=", Timestamp.fromDate(endDate))
            );
            const salesSnapshot = await getDocs(q);
            let employeeSalesTotal = 0;
            salesSnapshot.forEach((doc) => {
                employeeSalesTotal += doc.data().total;
            });
            const employeeSalesCount = salesSnapshot.size;

            // 3. Calculate Commission
            const settings = await this.getPayrollSettings();
            let commissionEarned = 0;

            if (settings && employee.role && employee.employeeType) {
                const ruleKey = `${employee.role}_${employee.employeeType}`;
                const rule = settings.commissionRules[ruleKey];

                if (rule && companySalesTotal >= rule.salesThreshold) {
                    commissionEarned = (baseSalary * rule.commissionPercent) / 100;
                }
            }

            const advances = employee.finance?.currentAdvance || 0;
            const unpaidCommissions = employee.finance?.unpaidCommissions || 0;
            const netAmount = salaryEarned + commissionEarned + unpaidCommissions - advances;

            return {
                baseSalary,
                daysPresent,
                totalWorkHours,
                salaryEarned,
                companySalesTotal,
                employeeSalesTotal,
                employeeSalesCount,
                commissionEarned,
                advances,
                unpaidCommissions,
                netAmount,
            };
        } catch (error) {
            console.error("Error calculating payroll:", error);
            throw error;
        }
    }

    /**
     * Process a salary payment
     */
    static async processPayment(
        paymentData: Omit<SalaryPayment, "id" | "createdAt">
    ): Promise<string> {
        try {
            // 1. Create SalaryPayment document
            const paymentRef = await addDoc(collection(db, "salary_payments"), {
                ...paymentData,
                createdAt: serverTimestamp(),
            });

            // 2. Create Ledger Entries
            // Base Salary/Earned Salary
            await LedgerService.createEntry({
                date: Timestamp.now(),
                type: "EXPENSE",
                category: "SALARY",
                amount: paymentData.salaryEarned,
                description: `Salary payment for ${paymentData.employeeName} (${paymentData.periodStart} to ${paymentData.periodEnd})`,
                paymentMethod: paymentData.paymentMethod,
                performedBy: paymentData.paidBy,
                relatedId: paymentRef.id,
            });

            // Commission (if any)
            if (paymentData.includeCommission && paymentData.commissionEarned > 0) {
                await LedgerService.createEntry({
                    date: Timestamp.now(),
                    type: "EXPENSE",
                    category: "COMMISSION",
                    amount: paymentData.commissionEarned,
                    description: `Commission payment for ${paymentData.employeeName} (${paymentData.periodStart} to ${paymentData.periodEnd})`,
                    paymentMethod: paymentData.paymentMethod,
                    performedBy: paymentData.paidBy,
                    relatedId: paymentRef.id,
                });
            }

            // 3. Update Employee Finance Info
            const employeeRef = doc(db, "users", paymentData.employeeId);
            const employeeDoc = await getDoc(employeeRef);
            if (employeeDoc.exists()) {
                const employeeData = employeeDoc.data() as User;
                const currentFinance = employeeData.finance || {
                    currentAdvance: 0,
                    unpaidCommissions: 0,
                };

                await updateDoc(employeeRef, {
                    "finance.currentAdvance": Math.max(
                        0,
                        currentFinance.currentAdvance - paymentData.advanceDeducted
                    ),
                    "finance.unpaidCommissions": paymentData.includeCommission
                        ? 0
                        : currentFinance.unpaidCommissions,
                });
            }

            return paymentRef.id;
        } catch (error) {
            console.error("Error processing salary payment:", error);
            throw error;
        }
    }

    /**
     * Process an advance payment
     */
    static async processAdvancePayment(
        employeeId: string,
        employeeName: string,
        amount: number,
        paymentMethod: PaymentMethod,
        paidBy: string
    ): Promise<void> {
        try {
            // 1. Create Ledger Entry
            await LedgerService.createEntry({
                date: Timestamp.now(),
                type: "EXPENSE",
                category: "ADVANCE",
                amount: amount,
                description: `Salary advance for ${employeeName}`,
                paymentMethod: paymentMethod,
                performedBy: paidBy,
            });

            // 2. Update Employee Finance Info
            const employeeRef = doc(db, "users", employeeId);
            const employeeDoc = await getDoc(employeeRef);
            if (employeeDoc.exists()) {
                const employeeData = employeeDoc.data() as User;
                const currentFinance = employeeData.finance || {
                    currentAdvance: 0,
                    unpaidCommissions: 0,
                };

                await updateDoc(employeeRef, {
                    "finance.currentAdvance": currentFinance.currentAdvance + amount,
                });
            }
        } catch (error) {
            console.error("Error processing advance payment:", error);
            throw error;
        }
    }

    /**
     * Get payment history for an employee
     */
    static async getPaymentHistory(employeeId: string): Promise<SalaryPayment[]> {
        try {
            const q = query(
                collection(db, "salary_payments"),
                where("employeeId", "==", employeeId),
                orderBy("createdAt", "desc")
            );

            const querySnapshot = await getDocs(q);
            const payments: SalaryPayment[] = [];
            querySnapshot.forEach((doc) => {
                payments.push({ id: doc.id, ...doc.data() } as SalaryPayment);
            });

            return payments;
        } catch (error) {
            console.error("Error fetching payment history:", error);
            throw error;
        }
    }

    /**
     * Get start and end dates for a period based on pay period setting
     */
    static getPeriodDates(
        payPeriod: PayPeriod,
        date: Date = new Date()
    ): { startDate: Date; endDate: Date } {
        const startDate = new Date(date);
        const endDate = new Date(date);

        if (payPeriod === "WEEKLY") {
            // Start of week (Sunday)
            const day = startDate.getDay();
            startDate.setDate(startDate.getDate() - day);
            startDate.setHours(0, 0, 0, 0);

            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        } else if (payPeriod === "MONTHLY") {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);

            endDate.setMonth(startDate.getMonth() + 1);
            endDate.setDate(0); // Last day of month
            endDate.setHours(23, 59, 59, 999);
        } else if (payPeriod === "YEARLY") {
            startDate.setMonth(0, 1);
            startDate.setHours(0, 0, 0, 0);

            endDate.setMonth(11, 31);
            endDate.setHours(23, 59, 59, 999);
        }

        return { startDate, endDate };
    }
}
