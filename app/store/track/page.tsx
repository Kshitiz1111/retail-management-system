"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderService } from "@/lib/services/orderService";
import { Order } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";

export default function TrackOrderPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  // Try to load from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastOrderNumber = localStorage.getItem("lastOrderNumber");
      const lastOrderPhone = localStorage.getItem("lastOrderPhone");
      if (lastOrderNumber) {
        setOrderNumber(lastOrderNumber);
      }
      if (lastOrderPhone) {
        setPhone(lastOrderPhone);
      }
    }
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrder(null);

    if (!orderNumber) {
      setError("Please enter your order number");
      return;
    }

    if (!phone && !email) {
      setError("Please enter your phone number or email");
      return;
    }

    setLoading(true);

    try {
      const foundOrder = await OrderService.getOrderByNumber(orderNumber);
      
      if (!foundOrder) {
        setError("Order not found. Please check your order number.");
        setLoading(false);
        return;
      }

      // Verify phone or email matches
      const phoneMatch = phone && foundOrder.customerInfo.phone === phone;
      const emailMatch = email && foundOrder.customerInfo.email === email;
      
      if (!phoneMatch && !emailMatch) {
        setError("Order found but phone/email doesn't match. Please verify your information.");
        setLoading(false);
        return;
      }

      setOrder(foundOrder);
    } catch (err: any) {
      setError(err.message || "Failed to track order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Track Your Order</CardTitle>
            <CardDescription>
              Enter your order number and phone/email to track your order status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTrack} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="orderNumber">Order Number *</Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                  placeholder="ORD-1234567890-123"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <p className="text-sm text-gray-600">
                * Please provide either phone number or email
              </p>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  "Searching..."
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track Order
                  </>
                )}
              </Button>
            </form>

            {order && (
              <div className="mt-6 space-y-4">
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">Order Details</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Number:</span>
                      <span className="font-medium">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        order.status === "PENDING" ? "text-yellow-600" :
                        order.status === "CONFIRMED" ? "text-green-600" :
                        order.status === "SHIPPED" ? "text-blue-600" :
                        "text-red-600"
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">
                        {order.createdAt.toDate().toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">Rs {order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Items:</h4>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{item.productName} x {item.quantity}</span>
                          <span>Rs {item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      onClick={() => router.push(`/store/orders/${order.orderNumber}`)}
                      className="w-full"
                    >
                      View Full Order Details
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

