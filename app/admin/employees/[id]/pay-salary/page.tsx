"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, ROLES, PaymentMethod, PayPeriod } from "@/lib/types";
import { ArrowLeft, Save, Calculator, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PayrollService } from "@/lib/services/payrollService";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageService } from "@/lib/services/imageService";
import { Upload, X as RemoveIcon } from "lucide-react";

export default function PaySalaryPage() {
    const params = useParams();
    const router = useRouter();
    const employeeId = params.id as string;
    const [employee, setEmployee] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [processing, setProcessing] = useState(false);
    const { user: currentUser } = useAuth();

    // Calculation state
    const [payPeriod, setPayPeriod] = useState<PayPeriod>("MONTHLY");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [payrollData, setPayrollData] = useState<{
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
    } | null>(null);

    // Payment settings
    const [includeCommission, setIncludeCommission] = useState(true);
    const [deductAdvance, setDeductAdvance] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
    const [notes, setNotes] = useState("");
    const [proofImages, setProofImages] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", employeeId));
                if (userDoc.exists()) {
                    setEmployee({ id: userDoc.id, ...userDoc.data() } as User);
                }

                // Fetch default settings
                const settings = await PayrollService.getPayrollSettings();
                if (settings) {
                    setPayPeriod(settings.payPeriod);
                    const { startDate: s, endDate: e } = PayrollService.getPeriodDates(settings.payPeriod);
                    setStartDate(s.toISOString().split("T")[0]);
                    setEndDate(e.toISOString().split("T")[0]);
                }
            } catch (error) {
                console.error("Error fetching employee:", error);
            } finally {
                setLoading(false);
            }
        };

        if (employeeId) {
            fetchEmployee();
        }
    }, [employeeId]);

    const handleCalculate = async () => {
        if (!startDate || !endDate) return;

        setCalculating(true);
        try {
            const data = await PayrollService.calculatePayroll(
                employeeId,
                new Date(startDate),
                new Date(endDate)
            );
            setPayrollData(data);
        } catch (error) {
            console.error("Error calculating payroll:", error);
            alert("Failed to calculate payroll. Please check date ranges.");
        } finally {
            setCalculating(false);
        }
    };

    const handleProcessPayment = async () => {
        if (!employee || !payrollData || !currentUser) return;

        if (!confirm(`Are you sure you want to process a payment of Rs ${calculateFinalAmount().toFixed(2)} for ${employee.displayName}?`)) {
            return;
        }

        setProcessing(true);
        try {
            // Upload images first if any
            let proofImageUrls: string[] = [];
            if (proofImages.length > 0) {
                setUploading(true);
                try {
                    const uploadPromises = proofImages.map(file =>
                        ImageService.uploadImage(file, `payroll/${employeeId}/${Date.now()}`)
                    );
                    proofImageUrls = await Promise.all(uploadPromises);
                } finally {
                    setUploading(false);
                }
            }

            const finalAmount = calculateFinalAmount();

            await PayrollService.processPayment({
                employeeId,
                employeeName: employee.displayName || employee.email,
                periodStart: startDate,
                periodEnd: endDate,
                baseSalary: payrollData.baseSalary,
                daysPresent: payrollData.daysPresent,
                totalWorkHours: payrollData.totalWorkHours,
                salaryEarned: payrollData.salaryEarned,
                companySalesTotal: payrollData.companySalesTotal,
                employeeSalesTotal: payrollData.employeeSalesTotal,
                employeeSalesCount: payrollData.employeeSalesCount,
                commissionEarned: includeCommission ? payrollData.commissionEarned + payrollData.unpaidCommissions : 0,
                advanceDeducted: deductAdvance ? payrollData.advances : 0,
                netAmount: finalAmount,
                paymentMethod,
                paidBy: currentUser.uid,
                includeCommission,
                notes,
                proofImageUrls,
            });

            alert("Payment processed successfully!");
            router.push(`/admin/employees/${employeeId}`);
        } catch (error) {
            console.error("Error processing payment:", error);
            alert("Failed to process payment. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    const calculateFinalAmount = () => {
        if (!payrollData) return 0;
        let amount = payrollData.salaryEarned;
        if (includeCommission) {
            amount += payrollData.commissionEarned + payrollData.unpaidCommissions;
        }
        if (deductAdvance) {
            amount -= payrollData.advances;
        }
        return Math.max(0, amount);
    };

    if (loading) {
        return (
            <ProtectedRoute requiredRole={ROLES.ADMIN}>
                <AdminLayout>
                    <div className="text-center py-12">Loading...</div>
                </AdminLayout>
            </ProtectedRoute>
        );
    }

    if (!employee) {
        return (
            <ProtectedRoute requiredRole={ROLES.ADMIN}>
                <AdminLayout>
                    <div className="text-center py-12">Employee not found.</div>
                </AdminLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute requiredRole={ROLES.ADMIN}>
            <AdminLayout>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href={`/admin/employees/${employeeId}`}>
                            <Button variant="outline" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold">Pay Salary</h1>
                            <p className="text-gray-600">Employee: {employee.displayName}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle>Calculation Period</CardTitle>
                                <CardDescription>Select the period to calculate salary for</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Pay Period Type</Label>
                                    <Select
                                        value={payPeriod}
                                        onValueChange={(v) => {
                                            setPayPeriod(v as PayPeriod);
                                            const { startDate: s, endDate: e } = PayrollService.getPeriodDates(v as PayPeriod);
                                            setStartDate(s.toISOString().split("T")[0]);
                                            setEndDate(e.toISOString().split("T")[0]);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                                            <SelectItem value="YEARLY">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                                <Button className="w-full" onClick={handleCalculate} disabled={calculating}>
                                    <Calculator className="mr-2 h-4 w-4" />
                                    {calculating ? "Calculating..." : "Calculate Payroll"}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Payroll Breakdown</CardTitle>
                                <CardDescription>View earnings, commissions, and deductions for this period</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {payrollData ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 border rounded bg-gray-50">
                                                <p className="text-sm text-gray-500">Base Salary</p>
                                                <p className="text-xl font-bold">Rs {payrollData.baseSalary.toFixed(2)}</p>
                                            </div>
                                            <div className="p-4 border rounded bg-gray-50">
                                                <p className="text-sm text-gray-500">Days Present</p>
                                                <p className="text-xl font-bold">{payrollData.daysPresent} Days</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center text-lg">
                                                <span>Salary Earned</span>
                                                <span className="font-semibold">Rs {payrollData.salaryEarned.toFixed(2)}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-green-600">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="commission"
                                                        checked={includeCommission}
                                                        onCheckedChange={(v) => setIncludeCommission(v === true)}
                                                    />
                                                    <Label htmlFor="commission">Commissions (New + Unpaid)</Label>
                                                </div>
                                                <span className="font-semibold">+ Rs {(payrollData.commissionEarned + payrollData.unpaidCommissions).toFixed(2)}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-red-600">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="advance"
                                                        checked={deductAdvance}
                                                        onCheckedChange={(v) => setDeductAdvance(v === true)}
                                                    />
                                                    <Label htmlFor="advance">Salary Advances</Label>
                                                </div>
                                                <span className="font-semibold">- Rs {payrollData.advances.toFixed(2)}</span>
                                            </div>

                                            <div className="pt-4 border-t flex justify-between items-center text-2xl font-bold">
                                                <span>Net Amount</span>
                                                <span>Rs {calculateFinalAmount().toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                            <div className="space-y-2">
                                                <Label>Payment Method</Label>
                                                <Select
                                                    value={paymentMethod}
                                                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CASH">Cash</SelectItem>
                                                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                        <SelectItem value="CHECK">Check</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Notes (Optional)</Label>
                                                <Input
                                                    placeholder="Payment remarks..."
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                />
                                            </div>

                                            <div className="space-y-2 col-span-2">
                                                <Label>Payment Proof (Optional - Multiple Images Allowed)</Label>
                                                <div className="flex flex-wrap gap-4 items-start mt-2">
                                                    {proofImages.map((file, index) => (
                                                        <div key={index} className="relative group">
                                                            <img
                                                                src={URL.createObjectURL(file)}
                                                                alt={`Proof ${index + 1}`}
                                                                className="h-24 w-24 object-cover rounded border bg-gray-100"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setProofImages(proofImages.filter((_, i) => i !== index))}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                                            >
                                                                <RemoveIcon className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <label className="h-24 w-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all text-gray-400 hover:text-blue-500">
                                                        <Upload className="h-6 w-6" />
                                                        <span className="text-[10px] font-medium mt-1 uppercase">Upload</span>
                                                        <input
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const files = Array.from(e.target.files || []);
                                                                setProofImages(prev => [...prev, ...files]);
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-12 text-lg"
                                            onClick={handleProcessPayment}
                                            disabled={processing || uploading}
                                        >
                                            <Save className="mr-2 h-5 w-5" />
                                            {processing ? (uploading ? "Uploading Proof..." : "Processing...") : "Finish and Record Payment"}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
                                        <p>Enter a date range and click calculate to see the payroll breakdown.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
