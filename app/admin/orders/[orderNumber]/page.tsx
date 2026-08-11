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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderService } from "@/lib/services/orderService";
import { Order, OrderStatus, User, Sale, RESOURCES, ACTIONS } from "@/lib/types";
import { printReceipt, downloadReceiptHTML } from "@/lib/utils/receiptGenerator";
import { Eye, Calendar, Download, Printer, ArrowLeft, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderNumber = params.orderNumber as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<OrderStatus>("PENDING");
  const [notes, setNotes] = useState("");
  const [performedByUser, setPerformedByUser] = useState<User | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

  const fetchOrder = async () => {
    try {
      const foundOrder = await OrderService.getOrderByNumber(orderNumber);
      if (foundOrder) {
        setOrder(foundOrder);
        setStatus(foundOrder.status);
        setNotes(foundOrder.notes || "");

        // Reset performedByUser first
        setPerformedByUser(null);

        // Fetch user who performed/completed the order
        // Check both performedBy and processedBy for backward compatibility
        const performedBy = foundOrder.performedBy || (foundOrder as any).processedBy;
        if (performedBy) {
          try {
            const userDoc = await getDoc(doc(db, "users", performedBy));
            if (userDoc.exists()) {
              setPerformedByUser({ id: userDoc.id, ...userDoc.data() } as User);
            } else {
              console.warn(`User ${performedBy} not found for order ${foundOrder.id}`);
            }
          } catch (error) {
            console.error("Error fetching performedBy user:", error);
          }
        } else {
          console.log(`Order ${foundOrder.id} has no performedBy field`);
        }
      }
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!order || !user) {
      alert("User not authenticated. Please log in again.");
      return;
    }

    setUpdating(true);
    try {
      // Always pass user.uid to track who performed this update
      await OrderService.updateOrderStatus(order.id, status, user.uid);
      if (notes !== order.notes) {
        await OrderService.updateOrderNotes(order.id, notes);
      }
      // Small delay to ensure database update is reflected
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchOrder();
      alert("Order updated successfully");
    } catch (error: any) {
      console.error("Error updating order:", error);
      alert(error.message || "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!order || !user) {
      alert("User not authenticated. Please log in again.");
      return;
    }

    if (!confirm("Are you sure you want to mark this order as completed?")) {
      return;
    }

    setUpdating(true);
    try {
      // Always pass user.uid to track who completed this order
      await OrderService.updateOrderStatus(order.id, "COMPLETED", user.uid);
      // Small delay to ensure database update is reflected
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchOrder();
      alert("Order marked as completed successfully");
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error completing order:", error);
      alert(err.message || "Failed to complete order");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CONFIRMED":
        return "bg-green-100 text-green-800";
      case "SHIPPED":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-purple-100 text-purple-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading order details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!order) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Order not found</h1>
            <Link href="/admin/orders">
              <Button>Back to Orders</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/orders">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Order #{order.orderNumber}</h1>
              <p className="text-gray-600 mt-1">
                Placed on {order.createdAt.toDate().toLocaleString()}
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={() => printReceipt(order)}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadReceiptHTML(order)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="SHIPPED">Shipped</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this order..."
                  />
                </div>

                <Button
                  onClick={handleStatusUpdate}
                  disabled={updating || (status === order.status && notes === (order.notes || ""))}
                  className="w-full"
                >
                  {updating ? "Updating..." : "Update Order"}
                </Button>

                {order.status !== "COMPLETED" && (order.status === "SHIPPED" || order.status === "CONFIRMED") && (
                  <Button
                    onClick={handleCompleteOrder}
                    disabled={updating}
                    className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                  >
                    {updating ? "Processing..." : "Mark as Completed"}
                  </Button>
                )}

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium">{order.paymentMethod}</span>
                  </div>
                  {performedByUser && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processed By:</span>
                      <span className="font-medium">
                        {performedByUser.displayName || performedByUser.email || "Unknown"}
                      </span>
                    </div>
                  )}
                  {order.loyaltyPointsUsed && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Points Used:</span>
                      <span className="font-medium">{order.loyaltyPointsUsed}</span>
                    </div>
                  )}
                  {order.loyaltyPointsEarned && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Points Earned:</span>
                      <span className="font-medium">{order.loyaltyPointsEarned}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>Contact details for order inquiries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{order.customerInfo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">
                    <a href={`tel:${order.customerInfo.phone}`} className="text-blue-600 hover:underline">
                      {order.customerInfo.phone}
                    </a>
                  </p>
                </div>
                {order.customerInfo.email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">
                      <a href={`mailto:${order.customerInfo.email}`} className="text-blue-600 hover:underline">
                        {order.customerInfo.email}
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Delivery Address</p>
                  <p className="font-medium">{order.customerInfo.address}</p>
                </div>
                {order.customerId && (
                  <div className="pt-3 border-t">
                    <Link href={`/admin/customers/${order.customerId}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        <UserIcon className="mr-2 h-4 w-4" />
                        View Customer Profile
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">Rs {item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs {item.subtotal.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs {order.subtotal.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-Rs {order.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span>Rs {order.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

