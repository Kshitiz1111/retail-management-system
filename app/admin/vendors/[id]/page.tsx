"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { VendorService } from "@/lib/services/vendorService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { Vendor, VendorReturn, PaymentMethod } from "@/lib/types";
import { ImageViewerDialog } from "@/components/ui/ImageViewerDialog";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { ArrowLeft, Building2, ChevronRight, DollarSign, Edit, RotateCcw, Save, X } from "lucide-react";
import Link from "next/link";

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

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const { hasPermission } = usePermissions();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [vendorReturns, setVendorReturns] = useState<VendorReturn[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Array<{
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    imageUrl?: string;
    performedBy: string;
    createdAt: any;
  }>>([]);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    category: "",
    description: "",
  });

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
      fetchPaymentHistory();
      fetchVendorReturns();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      const vendorData = await VendorService.getVendor(vendorId);
      if (vendorData) {
        setVendor(vendorData);
        setFormData({
          companyName: vendorData.companyName,
          contactPerson: vendorData.contactPerson,
          phone: vendorData.phone,
          email: vendorData.email || "",
          address: vendorData.address || "",
          category: vendorData.category || "",
          description: vendorData.description || "",
        });
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await VendorService.getVendorPaymentHistory(vendorId);
      setPaymentHistory(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      setHistoryError("Failed to load payment history. Please try again.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchVendorReturns = async () => {
    setLoadingReturns(true);
    setReturnsError(null);
    try {
      const returns = await VendorService.getVendorReturns(vendorId);
      setVendorReturns(returns as VendorReturn[]);
    } catch (error: unknown) {
      console.error("Error fetching vendor returns:", error);
      setReturnsError(error instanceof Error ? error.message : "Failed to load vendor returns");
    } finally {
      setLoadingReturns(false);
    }
  };

  const handleSave = async () => {
    if (!vendor) return;

    setSaving(true);
    try {
      await VendorService.updateVendor(vendorId, {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
      });
      setEditing(false);
      await fetchVendorData();
      alert("Vendor updated successfully");
    } catch (error) {
      console.error("Error updating vendor:", error);
      alert("Failed to update vendor");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading vendor details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!vendor) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
            <Link href="/admin/vendors">
              <Button>Back to Vendors</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/vendors">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">{vendor.companyName}</h1>
                <p className="text-gray-600 mt-1">Vendor Details</p>
              </div>
            </div>
            {hasPermission("vendors", "update") && (
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
                        fetchVendorData();
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson">Contact Person</Label>
                      <Input
                        id="contactPerson"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
                    <div className="space-y-2">
                      <Label htmlFor="category">Category (Optional)</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Electronics, Furniture, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="e.g., Electronics, Furniture, etc."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Company Name</p>
                      <p className="font-medium">{vendor.companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Contact Person</p>
                      <p className="font-medium">{vendor.contactPerson}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{vendor.phone}</p>
                    </div>
                    {vendor.email && (
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{vendor.email}</p>
                      </div>
                    )}
                    {vendor.address && (
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium">{vendor.address}</p>
                      </div>
                    )}
                    {vendor.category && (
                      <div>
                        <p className="text-sm text-gray-600">Category</p>
                        <p className="font-medium">{vendor.category}</p>
                      </div>
                    )}
                    {vendor.description && (
                      <div>
                        <p className="text-sm text-gray-600">Description</p>
                        <p className="font-medium">{vendor.description}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className={vendor.isActive ? "text-green-600 font-medium" : "text-gray-400 font-medium"}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${vendor.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    Rs {vendor.balance.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {vendor.balance > 0 ? "Amount owed to vendor" : "No outstanding balance"}
                  </p>
                </div>
                {vendor.createdAt && (
                  <div>
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="font-medium">
                      {vendor.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {vendor.balance > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Settle Payment</CardTitle>
                <CardDescription>Record payment to reduce outstanding balance</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/vendors/${vendorId}/settle-payment`}>
                  <Button>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Settle Payment (Rs {vendor.balance.toFixed(2)})
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Payment History</CardTitle>
                  <CardDescription>History of payments made to this vendor</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPaymentHistory}
                  disabled={loadingHistory}
                >
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-4">Loading payment history...</div>
              ) : historyError ? (
                <div className="text-center py-4">
                  <p className="text-red-600 mb-2">{historyError}</p>
                  <Button variant="outline" size="sm" onClick={fetchPaymentHistory}>
                    Retry
                  </Button>
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No payment history available</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.createdAt?.toDate?.()?.toLocaleString() || "N/A"}
                          </TableCell>
                          <TableCell className="font-medium">Rs {payment.amount.toFixed(2)}</TableCell>
                          <TableCell>{payment.paymentMethod}</TableCell>
                          <TableCell>{payment.notes || "-"}</TableCell>
                          <TableCell>
                            {payment.imageUrl ? (
                              <ImageViewerDialog
                                imageUrl={payment.imageUrl}
                                alt={`Receipt - Rs ${payment.amount.toFixed(2)}`}
                                trigger={
                                  <span className="text-blue-600 hover:underline cursor-pointer">
                                    View Receipt
                                  </span>
                                }
                              />
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{payment.performedBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Returns */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-orange-500" />
                    Vendor Returns
                  </CardTitle>
                  <CardDescription>Return history for this vendor</CardDescription>
                </div>
                {vendorReturns.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {vendorReturns.length} return{vendorReturns.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingReturns ? (
                <div className="text-center py-4">Loading vendor returns...</div>
              ) : returnsError ? (
                <div className="text-center py-4">
                  <p className="text-red-600 mb-2">{returnsError}</p>
                  <Button variant="outline" size="sm" onClick={fetchVendorReturns}>Retry</Button>
                </div>
              ) : vendorReturns.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No vendor returns found</div>
              ) : (
                <div className="divide-y">
                  {vendorReturns.map((ret) => (
                    <Link
                      key={ret.id}
                      href={`/admin/returns/vendor/${ret.id}`}
                      className="flex items-center justify-between p-3 hover:bg-orange-50/50 transition-colors rounded-lg cursor-pointer"
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
                          {ret.refundStatus && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ret.refundStatus === "REFUND_RECEIVED"
                                ? "bg-green-100 text-green-700"
                                : ret.refundStatus === "AUTO_DEDUCTED"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                                }`}
                            >
                              {ret.refundStatus === "REFUND_RECEIVED" ? "Refund Received"
                                : ret.refundStatus === "AUTO_DEDUCTED" ? "Auto-Deducted"
                                  : "Pending Refund"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                          <span>{ret.items?.length || 0} item{(ret.items?.length || 0) > 1 ? "s" : ""}</span>
                          <span>{REASON_LABELS[ret.reason] || ret.reason}</span>
                          <span>{ret.createdAt?.toDate?.()?.toLocaleDateString() || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            Rs {ret.totalReturnAmount?.toFixed(2) || "0.00"}
                          </p>
                          {ret.creditNoteNumber && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              CN: {ret.creditNoteNumber}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>View all purchase orders for this vendor</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/vendors/${vendorId}/purchase-orders/create`}>
                    <Button>
                      <Building2 className="mr-2 h-4 w-4" />
                      Create Purchase Order
                    </Button>
                  </Link>
                  <Link href={`/admin/vendors/${vendorId}/purchase-orders`}>
                    <Button variant="outline">
                      View Purchase Orders
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

