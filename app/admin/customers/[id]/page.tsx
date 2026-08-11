"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Save, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditService } from "@/lib/services/creditService";
import { OrderService } from "@/lib/services/orderService";
import { ReturnService } from "@/lib/services/returnService";
import { Customer, CreditTransaction, Sale, Order, SalesReturn, PaymentMethod, RESOURCES, ACTIONS } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, ChevronRight, DollarSign, Eye, RotateCcw } from "lucide-react";
import Link from "next/link";
import { TransactionDetailsDialog } from "@/components/admin/TransactionDetailsDialog";

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong Item",
  CUSTOMER_CHANGED_MIND: "Changed Mind",
  WARRANTY: "Warranty",
  DAMAGED: "Damaged",
  EXPIRED: "Expired",
  ORDER_CANCELLED: "Order Cancelled",
  OTHER: "Other",
};

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesWarning, setSalesWarning] = useState<string | null>(null);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<CreditTransaction | null>(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PaymentMethod>("CASH");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [selectedTransaction, setSelectedTransaction] = useState<{
    id: string;
    type: "SALE" | "ORDER" | "LEDGER";
    source?: "POS" | "ONLINE" | "LEDGER";
  } | null>(null);

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
      fetchCredits();
      fetchSales();
      fetchOrders();
      fetchReturns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      const customerDoc = await getDoc(doc(db, "customers", customerId));
      if (customerDoc.exists()) {
        const customerData = { id: customerDoc.id, ...customerDoc.data() } as Customer;
        setCustomer(customerData);
        setFormData({
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email || "",
          address: customerData.address || "",
        });
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!customer) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "customers", customerId), {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
      await fetchCustomerData();
      alert("Customer updated successfully");
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const fetchCredits = async () => {
    setLoadingCredits(true);
    setCreditsError(null);
    try {
      const customerCredits = await CreditService.getCustomerCredits(customerId);
      setCredits(customerCredits);
      console.log(`Fetched ${customerCredits.length} credit transactions for customer ${customerId}`);
    } catch (error: unknown) {
      console.error("Error fetching credits:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load credit history";
      setCreditsError(errorMessage);

      // Check if it's a missing index error
      if (error instanceof Error && (error.message?.includes("index") || (error as { code?: string }).code === "failed-precondition")) {
        setCreditsError(
          "Credit history query requires a Firestore index. Please create a composite index on (customerId, createdAt) for the credit_transactions collection."
        );
      }
    } finally {
      setLoadingCredits(false);
    }
  };

  const fetchSales = async () => {
    setLoadingSales(true);
    setSalesError(null);
    try {
      // Try query with orderBy first (requires composite index)
      let q = query(
        collection(db, "sales"),
        where("customerId", "==", customerId),
        orderBy("createdAt", "desc")
      );

      try {
        const querySnapshot = await getDocs(q);
        const salesList: Sale[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          salesList.push({ id: doc.id, ...data } as Sale);
        });
        setSales(salesList);
        console.log(`Fetched ${salesList.length} sales for customer ${customerId}`);
      } catch (indexError: unknown) {
        // If index is missing, try without orderBy and sort in memory
        const error = indexError as { code?: string; message?: string };
        if (error.code === "failed-precondition" || error.message?.includes("index")) {
          console.warn("Composite index missing, fetching without orderBy and sorting in memory");
          q = query(
            collection(db, "sales"),
            where("customerId", "==", customerId)
          );
          const querySnapshot = await getDocs(q);
          const salesList: Sale[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            salesList.push({ id: doc.id, ...data } as Sale);
          });

          // Sort in memory by createdAt descending
          salesList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          setSales(salesList);
          console.log(`Fetched ${salesList.length} sales for customer ${customerId} (sorted in memory)`);
          setSalesWarning(
            "Note: A Firestore composite index on (customerId, createdAt) is recommended for better performance."
          );
        } else {
          throw indexError;
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching sales:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load purchase history";
      setSalesError(errorMessage);
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    setOrdersError(null);
    try {
      const customerOrders = await OrderService.getCustomerOrders(customerId);
      setOrders(customerOrders);
    } catch (error: unknown) {
      console.error("Error fetching orders:", error);
      setOrdersError(error instanceof Error ? error.message : "Failed to load online orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchReturns = async () => {
    setLoadingReturns(true);
    setReturnsError(null);
    try {
      const returns = await ReturnService.getSalesReturnsByCustomer(customerId);
      setSalesReturns(returns);
    } catch (error: unknown) {
      console.error("Error fetching returns:", error);
      setReturnsError(error instanceof Error ? error.message : "Failed to load return history");
    } finally {
      setLoadingReturns(false);
    }
  };

  // Calculate and update totalSpent from sales and orders
  const calculateAndUpdateTotalSpent = async () => {
    if (!customer || !customerId || (loadingSales && loadingOrders)) return;

    try {
      // Calculate from sales
      const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
      // Calculate from orders (excluding cancelled)
      const ordersTotal = orders
        .filter((order) => order.status !== "CANCELLED")
        .reduce((sum, order) => sum + order.total, 0);
      const calculatedTotal = salesTotal + ordersTotal;
      const currentTotal = customer.totalSpent || 0;

      // Update if different (with small tolerance for floating point)
      if (Math.abs(calculatedTotal - currentTotal) > 0.01) {
        console.log(`Updating totalSpent: ${currentTotal} -> ${calculatedTotal} for customer ${customerId}`);
        await updateDoc(doc(db, "customers", customerId), {
          totalSpent: calculatedTotal,
        });
        // Refresh customer data
        fetchCustomerData();
      }
    } catch (error) {
      console.error("Error calculating/updating totalSpent:", error);
    }
  };

  // Recalculate totalSpent when both customer, sales, and orders are loaded
  useEffect(() => {
    if (customer && !loadingSales && !loadingOrders) {
      calculateAndUpdateTotalSpent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, loadingSales, loadingOrders, sales.length, orders.length]);

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
      fetchCustomerData();
      alert("Credit settled successfully");
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Failed to settle credit");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.CUSTOMERS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading customer details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!customer) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.CUSTOMERS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Customer not found</h1>
            <Link href="/admin/customers">
              <Button>Back to Customers</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const outstandingCredits = credits.filter((c) => c.dueAmount > 0);
  const totalOutstanding = outstandingCredits.reduce((sum, c) => sum + c.dueAmount, 0);

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.CUSTOMERS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/customers">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{customer.name}</h1>
                <p className="text-gray-600 mt-1">Customer Details</p>
              </div>
            </div>
            {hasPermission("customers", "update") && (
              <>
                {!editing ? (
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(false);
                        fetchCustomerData();
                      }}
                      disabled={saving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (Optional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address (Optional)</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{customer.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{customer.phone}</p>
                    </div>
                    {customer.email && (
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{customer.email}</p>
                      </div>
                    )}
                    {customer.address && (
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium">{customer.address}</p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-sm text-gray-600">Member Since</p>
                  <p className="font-medium">
                    {customer.createdAt.toDate().toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Spent</p>
                  <p className="text-2xl font-bold text-green-600">
                    Rs {(customer.totalSpent || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Outstanding Due</p>
                  <p className={`text-2xl font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                    Rs {totalOutstanding.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Loyalty Points</p>
                  <p className="text-lg font-medium">{customer.loyaltyPoints}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Purchases</p>
                  <p className="text-2xl font-bold">{sales.length + orders.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Credits</p>
                  <p className="text-lg font-medium">{outstandingCredits.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {outstandingCredits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Credits</CardTitle>
                <CardDescription>Credit transactions with pending payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outstandingCredits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell className="font-mono text-sm">{credit.saleId}</TableCell>
                          <TableCell>
                            {credit.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>Rs {credit.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">
                            Rs {credit.paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-red-600 font-semibold">
                            Rs {credit.dueAmount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedCredit && (
            <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
              <CardDescription>All sales transactions for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSales || loadingOrders ? (
                <div className="text-center py-8">Loading purchase history...</div>
              ) : salesError || ordersError ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-semibold">Error loading purchase history</p>
                    {salesError && <p className="text-sm mt-1">Sales: {salesError}</p>}
                    {ordersError && <p className="text-sm mt-1">Orders: {ordersError}</p>}
                  </div>
                  <div className="flex gap-2 justify-center">
                    {salesError && (
                      <Button variant="outline" onClick={fetchSales}>
                        Retry Sales
                      </Button>
                    )}
                    {ordersError && (
                      <Button variant="outline" onClick={fetchOrders}>
                        Retry Orders
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {salesWarning && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
                      <p className="text-sm">{salesWarning}</p>
                    </div>
                  )}
                  {sales.length === 0 && orders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No purchase history found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead>ID/Order #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  POS
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{sale.id.slice(0, 8)}...</TableCell>
                              <TableCell>
                                {sale.createdAt.toDate().toLocaleDateString()}
                              </TableCell>
                              <TableCell>{sale.items.length} items</TableCell>
                              <TableCell className="font-medium">
                                Rs {sale.total.toFixed(2)}
                              </TableCell>
                              <TableCell>{sale.paymentMethod}</TableCell>
                              <TableCell>
                                {sale.dueAmount > 0 ? (
                                  <span className="text-red-600 font-medium">Credit</span>
                                ) : (
                                  <span className="text-green-600 font-medium">Paid</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaction({
                                      id: sale.id,
                                      type: "SALE",
                                      source: sale.source || "POS",
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  ONLINE
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium">
                                <Link href={`/admin/orders/${order.orderNumber}`} className="text-blue-600 hover:underline">
                                  {order.orderNumber}
                                </Link>
                              </TableCell>
                              <TableCell>
                                {order.createdAt.toDate().toLocaleDateString()}
                              </TableCell>
                              <TableCell>{order.items.length} items</TableCell>
                              <TableCell className="font-medium">
                                Rs {order.total.toFixed(2)}
                              </TableCell>
                              <TableCell>{order.paymentMethod}</TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === "PENDING"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : order.status === "CONFIRMED"
                                      ? "bg-green-100 text-green-800"
                                      : order.status === "SHIPPED"
                                        ? "bg-blue-100 text-blue-800"
                                        : order.status === "COMPLETED"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-red-100 text-red-800"
                                    }`}
                                >
                                  {order.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaction({
                                      id: order.id,
                                      type: "ORDER",
                                      source: order.source || "ONLINE",
                                    });
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit History</CardTitle>
              <CardDescription>All credit transactions for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCredits ? (
                <div className="text-center py-8">Loading credit history...</div>
              ) : creditsError ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-semibold">Error loading credit history</p>
                    <p className="text-sm mt-1">{creditsError}</p>
                  </div>
                  <Button variant="outline" onClick={fetchCredits}>
                    Retry
                  </Button>
                </div>
              ) : credits.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No credit transactions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credits.map((credit) => (
                        <TableRow key={credit.id}>
                          <TableCell className="font-mono text-sm">{credit.saleId}</TableCell>
                          <TableCell>
                            {credit.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>Rs {credit.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">
                            Rs {credit.paidAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {credit.dueAmount > 0 ? (
                              <span className="text-red-600 font-semibold">
                                Rs {credit.dueAmount.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-green-600">Rs 0.00</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {credit.dueAmount > 0 ? (
                              <span className="text-yellow-600 font-medium">Pending</span>
                            ) : (
                              <span className="text-green-600 font-medium">Settled</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Return History */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-orange-500" />
                    Sales Return History
                  </CardTitle>
                  <CardDescription>All return transactions for this customer</CardDescription>
                </div>
                {salesReturns.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {salesReturns.length} return{salesReturns.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingReturns ? (
                <div className="text-center py-8">Loading return history...</div>
              ) : returnsError ? (
                <div className="text-center py-8">
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-semibold">Error loading return history</p>
                    <p className="text-sm mt-1">{returnsError}</p>
                  </div>
                  <Button variant="outline" onClick={fetchReturns}>Retry</Button>
                </div>
              ) : salesReturns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No return history found.
                </div>
              ) : (
                <div className="divide-y">
                  {salesReturns.map((ret) => (
                    <Link
                      key={ret.id}
                      href={`/admin/returns/sales/${ret.id}`}
                      className="flex items-center justify-between p-3 hover:bg-blue-50/50 transition-colors rounded-lg cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {ret.returnNumber}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ret.status === "COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : ret.status === "REJECTED"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                              }`}
                          >
                            {ret.status}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ret.source === "POS"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-teal-100 text-teal-700"
                              }`}
                          >
                            {ret.source}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                          <span>{ret.items.length} item{ret.items.length > 1 ? "s" : ""}</span>
                          <span>{REASON_LABELS[ret.reason] || ret.reason}</span>
                          <span>{ret.createdAt?.toDate?.()?.toLocaleDateString() || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            Rs {ret.totalReturnAmount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ret.refundMethod}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

