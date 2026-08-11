"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderService } from "@/lib/services/orderService";
import { Order, OrderStatus, User, Sale, RESOURCES, ACTIONS } from "@/lib/types";
import { Eye, Calendar } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState({
    start: "",
    end: "",
  });
  const [usersMap, setUsersMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (statusFilter !== "ALL") {
        filters.status = statusFilter;
      }
      if (dateFilter.start) {
        filters.startDate = new Date(dateFilter.start);
      }
      if (dateFilter.end) {
        filters.endDate = new Date(dateFilter.end);
        filters.endDate.setHours(23, 59, 59, 999);
      }

      const allOrders = await OrderService.getAllOrders(filters);
      setOrders(allOrders);

      // Fetch user information for orders that have performedBy
      const userIds = new Set<string>();
      allOrders.forEach((order) => {
        if (order.performedBy) userIds.add(order.performedBy);
        if ((order as any).processedBy) userIds.add((order as any).processedBy);
      });

      if (userIds.size > 0) {
        const users = new Map<string, string>();
        const fetchPromises = Array.from(userIds).map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as User;
              const displayName = userData.displayName || userData.email || "Unknown";
              users.set(userId, displayName);
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
        });
        await Promise.all(fetchPromises);
        setUsersMap(users);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
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
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Orders</h1>
              <p className="text-gray-600 mt-2">Manage all online orders from store</p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus | "ALL")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="SHIPPED">Shipped</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={dateFilter.start}
                    onChange={(e) =>
                      setDateFilter({ ...dateFilter, start: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) =>
                      setDateFilter({ ...dateFilter, end: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setDateFilter({ start: "", end: "" });
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          {loading ? (
            <div className="text-center py-12">Loading orders...</div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-600">No orders found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const performedBy = order.performedBy || (order as any).processedBy;
                      const performedByName = performedBy
                        ? (usersMap.get(performedBy) || `User: ${performedBy.substring(0, 8)}...`)
                        : "N/A";
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell>{order.customerInfo.name}</TableCell>
                          <TableCell>{order.customerInfo.phone}</TableCell>
                          <TableCell>{order.items.length} item(s)</TableCell>
                          <TableCell>Rs {order.total.toFixed(2)}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {performedByName}
                          </TableCell>
                          <TableCell>
                            {order.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Link href={`/admin/orders/${order.orderNumber}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {orders.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      Rs {orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg Order Value</p>
                    <p className="text-2xl font-bold">
                      Rs {orders.length > 0 ? (orders.reduce((sum, o) => sum + o.total, 0) / orders.length).toFixed(2) : "0.00"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

