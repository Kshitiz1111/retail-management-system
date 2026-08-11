"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { CreditService } from "@/lib/services/creditService";
import { CreditTransaction, Customer, PaymentMethod } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DollarSign, Eye } from "lucide-react";
import { TransactionDetailsDialog } from "@/components/admin/TransactionDetailsDialog";

export default function CustomerCreditsPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState<CreditTransaction | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PaymentMethod>("CASH");
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    type: "SALE" | "ORDER" | "LEDGER";
    source?: "POS" | "ONLINE" | "LEDGER";
  } | null>(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const outstandingCredits = await CreditService.getAllOutstandingCredits();
      setCredits(outstandingCredits);

      // Fetch customer data for each credit
      const customerMap: Record<string, Customer> = {};
      for (const credit of outstandingCredits) {
        if (!customerMap[credit.customerId]) {
          const customerDoc = await getDoc(doc(db, "customers", credit.customerId));
          if (customerDoc.exists()) {
            customerMap[credit.customerId] = {
              id: customerDoc.id,
              ...customerDoc.data(),
            } as Customer;
          }
        }
      }
      setCustomers(customerMap);
    } catch (error) {
      console.error("Error fetching credits:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedCredit || !user) return;

    const amount = parseFloat(settlementAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > selectedCredit.dueAmount) {
      alert(`Amount cannot exceed due amount of Rs ${selectedCredit.dueAmount.toFixed(2)}`);
      return;
    }

    try {
      await CreditService.settleCredit(
        selectedCredit.id,
        amount,
        user.uid,
        settlementPaymentMethod,
        settlementNotes || undefined
      );
      setSelectedCredit(null);
      setSettlementAmount("");
      setSettlementNotes("");
      fetchCredits();
      alert("Credit settled successfully");
    } catch (error: any) {
      alert(error.message || "Failed to settle credit");
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.CUSTOMERS, action: ACTIONS.VIEW_CREDITS }}>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Customer Credits</h1>
          <p className="text-gray-600 mt-2">View and settle customer outstanding dues</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding Credits</CardTitle>
            <CardDescription>All customers with outstanding dues</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : credits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No outstanding credits found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Sale ID</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credits.map((credit) => {
                      const customer = customers[credit.customerId];
                      return (
                        <TableRow key={credit.id}>
                          <TableCell className="font-medium">
                            {customer?.name || "Unknown Customer"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{credit.saleId}</TableCell>
                          <TableCell>Rs {credit.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">
                            Rs {credit.paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-red-600 font-semibold">
                            Rs {credit.dueAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {credit.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedTransaction({
                                    id: credit.saleId,
                                    type: "SALE",
                                    source: "POS",
                                  });
                                }}
                                title="View Sale Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission("customers", "settleCredits") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCredit(credit);
                                    setSettlementAmount(credit.dueAmount.toString());
                                  }}
                                >
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Settle
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settlement Modal */}
        {selectedCredit && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Settle Credit</CardTitle>
              <CardDescription>
                Settle payment for sale #{selectedCredit.saleId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-lg font-semibold">Rs {selectedCredit.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Amount</p>
                  <p className="text-lg font-semibold text-red-600">
                    Rs {selectedCredit.dueAmount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Settlement Amount (Rs)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  max={selectedCredit.dueAmount}
                  placeholder="Enter amount to settle"
                />
                <p className="text-xs text-gray-500">
                  Maximum: Rs {selectedCredit.dueAmount.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select
                  value={settlementPaymentMethod}
                  onValueChange={(value) => setSettlementPaymentMethod(value as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="FONE_PAY">FonePay</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="Payment notes"
                />
              </div>

              <div className="flex gap-4">
                <Button onClick={handleSettle}>Settle Payment</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCredit(null);
                    setSettlementAmount("");
                    setSettlementNotes("");
                    setSettlementPaymentMethod("CASH");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedTransaction && (
          <TransactionDetailsDialog
            transactionId={selectedTransaction.id}
            transactionType={selectedTransaction.type}
            source={selectedTransaction.source}
            open={!!selectedTransaction}
            onOpenChange={(open) => {
              if (!open) setSelectedTransaction(null);
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

