"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStoreAuth } from "@/contexts/StoreAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderService } from "@/lib/services/orderService";
import { Order } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useStoreAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!customer) {
        router.push("/store/login");
        return;
      }
      fetchOrders();
    }
  }, [customer, authLoading]);

  const fetchOrders = async () => {
    if (!customer) return;
    
    try {
      const customerOrders = await OrderService.getCustomerOrders(customer.id);
      setOrders(customerOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-600 bg-yellow-50";
      case "CONFIRMED":
        return "text-green-600 bg-green-50";
      case "SHIPPED":
        return "text-blue-600 bg-blue-50";
      case "CANCELLED":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/store">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Store
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Orders</h1>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">You haven't placed any orders yet.</p>
              <Link href="/store">
                <Button>Start Shopping</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">Order #{order.orderNumber}</h3>
                      <p className="text-sm text-gray-600">
                        {order.createdAt.toDate().toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Items</p>
                      <p className="font-medium">{order.items.length} item(s)</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="font-medium">Rs {order.total.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Payment</p>
                      <p className="font-medium">{order.paymentMethod}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => router.push(`/store/orders/${order.orderNumber}`)}
                    className="w-full"
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

