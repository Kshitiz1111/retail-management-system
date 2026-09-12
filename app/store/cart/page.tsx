"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import { ArrowLeft, Trash2, Download, Printer } from "lucide-react";
import { useStoreAuth } from "@/contexts/StoreAuthContext";
import { OrderService } from "@/lib/services/orderService";
import { LoyaltyService } from "@/lib/services/loyaltyService";
import { printReceipt, downloadReceiptHTML } from "@/lib/utils/receiptGenerator";
import { Order, OrderItem } from "@/lib/types";

interface CartItem {
  productId: string;
  productName: string;
  sku?: string;
  price: number;
  originalPrice?: number; // Original price before discount
  quantity: number;
  imageUrl?: string;
  totalStock?: number; // Available stock for validation
}

export default function CartPage() {
  const router = useRouter();
  const { customer } = useStoreAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [formData, setFormData] = useState({
    name: customer?.name || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    address: customer?.address || "",
    notes: "",
  });
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyRules, setLoyaltyRules] = useState<any>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const cartData = JSON.parse(localStorage.getItem("cart") || "[]");
    setCart(cartData);

    // Load customer data if signed in
    if (customer) {
      loadLoyaltyData();
    }
  }, [customer]);

  const loadLoyaltyData = async () => {
    if (!customer) return;

    try {
      const points = await LoyaltyService.getCustomerPoints(customer.id);
      setLoyaltyPoints(points);

      const rules = await LoyaltyService.getLoyaltyRules();
      setLoyaltyRules(rules);
    } catch (error) {
      console.error("Error loading loyalty data:", error);
    }
  };

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const newCart = cart.map((item) => {
      if (item.productId === productId) {
        const maxQty = item.totalStock || Infinity;
        return { ...item, quantity: Math.min(maxQty, Math.max(1, quantity)) };
      }
      return item;
    });
    updateCart(newCart);
  };

  const removeItem = (productId: string) => {
    const newCart = cart.filter((item) => item.productId !== productId);
    updateCart(newCart);
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTotal = () => {
    return Math.max(0, calculateSubtotal() - discount);
  };

  const handlePointsChange = (points: number) => {
    if (!loyaltyRules || !customer) return;

    const subtotal = calculateSubtotal();
    const maxPoints = LoyaltyService.calculateMaxRedeemablePoints(
      loyaltyPoints,
      subtotal,
      loyaltyRules.redeemRate,
      loyaltyRules.minPointsToRedeem
    );

    const pointsToUse = Math.min(Math.max(0, points), maxPoints);
    setPointsToRedeem(pointsToUse);

    const discountAmount = LoyaltyService.calculateDiscount(
      pointsToUse,
      loyaltyRules.redeemRate,
      subtotal
    );
    setDiscount(discountAmount);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacingOrder(true);

    try {
      const subtotal = calculateSubtotal();
      const total = calculateTotal();

      // Convert cart items to order items
      const orderItems: OrderItem[] = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku || "",
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.price * item.quantity,
        imageUrl: item.imageUrl,
      }));

      // Create order data
      const orderData: any = {
        customerInfo: {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
        },
        items: orderItems,
        subtotal,
        discount,
        total,
        paymentMethod: "COD",
        status: "PENDING",
      };

      // Include notes if provided
      if (formData.notes?.trim()) {
        orderData.notes = formData.notes.trim();
      }

      // Only include customerId if customer is logged in
      if (customer?.id) {
        orderData.customerId = customer.id;
      }

      // Only include email if provided
      if (formData.email) {
        orderData.customerInfo.email = formData.email;
      }

      // Only include loyaltyPointsUsed if points are being redeemed
      if (pointsToRedeem > 0) {
        orderData.loyaltyPointsUsed = pointsToRedeem;
      }

      // Create order
      const { orderId, orderNumber: newOrderNumber } = await OrderService.createOrder(orderData);

      // Fetch the created order for receipt
      const createdOrder = await OrderService.getOrder(orderId);
      if (createdOrder) {
        setOrder(createdOrder);
        setOrderNumber(newOrderNumber);
        setOrderPlaced(true);

        // Store order number in localStorage for guest tracking
        localStorage.setItem("lastOrderNumber", newOrderNumber);
        localStorage.setItem("lastOrderPhone", formData.phone);

        // Clear cart
        updateCart([]);
      }
    } catch (error: any) {
      alert(error.message || "Failed to place order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (cart.length === 0) {
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
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Link href="/store">
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <h1 className="text-2xl font-bold">Shopping Cart</h1>
            {cart.map((item) => (
              <Card key={item.productId}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="w-24 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.productName}</h3>
                      {item.originalPrice && item.originalPrice > item.price ? (
                        <div>
                          <p className="text-sm text-gray-400 line-through">Rs {item.originalPrice.toFixed(2)}</p>
                          <p className="text-gray-600 font-semibold">Rs {item.price.toFixed(2)} each</p>
                          <p className="text-xs text-red-600 font-semibold">
                            -{((1 - item.price / item.originalPrice) * 100).toFixed(0)}% OFF
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-600">Rs {item.price.toFixed(2)} each</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.productId, parseInt(e.target.value) || 1)
                            }
                            className="w-16 text-center"
                            min={1}
                            max={item.totalStock}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.totalStock ? item.quantity >= item.totalStock : false}
                          >
                            +
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 font-semibold">
                        Rs {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckout} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any special instructions or notes..."
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      rows={2}
                    />
                  </div>

                  {customer && loyaltyRules && loyaltyPoints >= loyaltyRules.minPointsToRedeem && (
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="loyalty-points">Use Loyalty Points</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="loyalty-points"
                          type="number"
                          min={0}
                          max={loyaltyPoints}
                          value={pointsToRedeem}
                          onChange={(e) => handlePointsChange(parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600">
                          Available: {loyaltyPoints} points
                        </span>
                      </div>
                      {pointsToRedeem > 0 && (
                        <p className="text-sm text-green-600">
                          Discount: Rs {discount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rs {calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-Rs {discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>Rs {calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">
                    Payment: Cash on Delivery (COD)
                  </p>

                  <Button type="submit" className="w-full" size="lg" disabled={placingOrder}>
                    {placingOrder ? "Placing Order..." : "Place Order"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Order Success Dialog */}
      <Dialog open={orderPlaced} onOpenChange={setOrderPlaced}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Placed Successfully!</DialogTitle>
            <DialogDescription>
              Your order has been placed. Order Number: <strong>{orderNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          {order && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm"><strong>Order Number:</strong> {order.orderNumber}</p>
                <p className="text-sm"><strong>Total:</strong> Rs {order.total.toFixed(2)}</p>
                <p className="text-sm"><strong>Status:</strong> {order.status}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => order && printReceipt(order)}
                  className="flex-1"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Receipt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => order && downloadReceiptHTML(order)}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>

              <div className="flex gap-2">
                {customer ? (
                  <Button
                    onClick={() => router.push(`/store/orders/${orderNumber}`)}
                    className="flex-1"
                  >
                    View Order
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push(`/store/track`)}
                    className="flex-1"
                  >
                    Track Order
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setOrderPlaced(false);
                    router.push("/store");
                  }}
                  className="flex-1"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

