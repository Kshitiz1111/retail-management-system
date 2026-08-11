"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
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
import { RESOURCES, ACTIONS } from "@/lib/types";
import { PurchaseOrder } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VendorPurchaseOrdersPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vendorId) {
      fetchPurchaseOrders();
    }
  }, [vendorId]);

  const fetchPurchaseOrders = async () => {
    try {
      const allOrders = await VendorService.getAllPurchaseOrders();
      const vendorOrders = allOrders.filter((po) => po.vendorId === vendorId);
      setPurchaseOrders(vendorOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-600";
      case "APPROVED":
        return "text-blue-600";
      case "RECEIVED":
        return "text-green-600";
      case "CANCELLED":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/vendors/${vendorId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Purchase Orders</h1>
              <p className="text-gray-600 mt-1">All purchase orders for this vendor</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Order List</CardTitle>
              <CardDescription>
                {purchaseOrders.length} purchase order{purchaseOrders.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading purchase orders...</div>
              ) : purchaseOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No purchase orders found for this vendor.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono text-sm">{po.id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            {po.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {po.items.length} item{po.items.length !== 1 ? "s" : ""}
                          </TableCell>
                          <TableCell className="font-medium">
                            Rs {po.totalAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium capitalize ${getStatusColor(po.status)}`}>
                              {po.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/admin/vendors/${vendorId}/purchase-orders/${po.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

