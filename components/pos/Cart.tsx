"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaleItem, Customer, PaymentMethod } from "@/lib/types";
import { ShoppingCart, Trash2, Minus, Plus } from "lucide-react";
import { DiscountSection } from "./DiscountSection";

interface CartProps {
  cart: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  selectedCustomer: Customer | null;
  advancePayment: number;
  paymentMethod: PaymentMethod;
  processing: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  onUpdateItem: (productId: string, updates: Partial<SaleItem>) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onAdvancePaymentChange: (value: number) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
  onCheckout: () => void;
  variant?: "desktop" | "mobile";
}

export function Cart({
  cart,
  subtotal,
  discount,
  total,
  paidAmount,
  creditAmount,
  selectedCustomer,
  advancePayment,
  paymentMethod,
  processing,
  hasPermission,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  onAdvancePaymentChange,
  onPaymentMethodChange,
  onApplyDiscount,
  onRemoveDiscount,
  onCheckout,
  variant = "desktop",
}: CartProps) {
  const isMobile = variant === "mobile";

  return (
    <>
      {/* Cart Header */}
      <CardHeader className="py-2 px-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4" />
            Cart ({cart.length})
          </CardTitle>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Clear all items from cart?")) {
                  onClearCart();
                }
              }}
              className="text-red-600 hover:text-red-700 h-7 px-2 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Cart Items — compact inline rows */}
      <CardContent className="flex-1 overflow-y-auto p-0">
        {cart.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cart is empty</div>
        ) : (
          <div className="divide-y">
            {cart.map((item) => (
              <div
                key={item.productId}
                className={`flex items-center gap-2 ${isMobile ? "px-3 py-2.5" : "px-3 py-1.5"}`}
              >
                {/* Product name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isMobile ? "text-sm" : "text-xs"}`}>
                    {item.productName}
                  </p>
                  <p className={`text-gray-400 ${isMobile ? "text-xs" : "text-[10px]"}`}>
                    Rs {item.unitPrice.toFixed(0)} each
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className={isMobile ? "h-8 w-8" : "h-6 w-6"}
                    onClick={() =>
                      onUpdateItem(item.productId, {
                        quantity: Math.max(1, item.quantity - 1),
                      })
                    }
                  >
                    <Minus className={isMobile ? "h-3.5 w-3.5" : "h-3 w-3"} />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItem(item.productId, {
                        quantity: parseInt(e.target.value) || 1,
                      })
                    }
                    className={`text-center ${isMobile ? "w-10 h-8 text-sm" : "w-8 h-6 text-xs"} px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    min={1}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className={isMobile ? "h-8 w-8" : "h-6 w-6"}
                    onClick={() =>
                      onUpdateItem(item.productId, {
                        quantity: item.quantity + 1,
                      })
                    }
                  >
                    <Plus className={isMobile ? "h-3.5 w-3.5" : "h-3 w-3"} />
                  </Button>
                </div>

                {/* Price */}
                <span className={`font-semibold tabular-nums shrink-0 ${isMobile ? "text-sm w-16" : "text-xs w-14"} text-right`}>
                  Rs {item.subtotal.toFixed(0)}
                </span>

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`shrink-0 text-gray-400 hover:text-red-600 ${isMobile ? "h-8 w-8" : "h-6 w-6"}`}
                  onClick={() => onRemoveItem(item.productId)}
                >
                  <Trash2 className={isMobile ? "h-3.5 w-3.5" : "h-3 w-3"} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Cart Summary */}
      <div className={`border-t ${isMobile ? "p-3" : "p-3"} space-y-2 bg-gray-50`}>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Subtotal:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          <DiscountSection
            discount={discount}
            hasPermission={hasPermission("pos", "applyDiscount")}
            onApplyDiscount={onApplyDiscount}
            onRemoveDiscount={onRemoveDiscount}
          />
          <div className="flex justify-between text-base font-bold border-t pt-1.5">
            <span>Total:</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>

          {/* Advance Payment Input - Only for selected customers */}
          {selectedCustomer && (
            <div className="space-y-1 pt-1.5 border-t">
              <Label htmlFor={isMobile ? "advance-payment-mobile" : "advance-payment"} className="text-xs">
                Advance Payment (Rs)
              </Label>
              <Input
                id={isMobile ? "advance-payment-mobile" : "advance-payment"}
                type="number"
                inputMode="decimal"
                min={0}
                max={total}
                step="0.01"
                value={advancePayment}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  onAdvancePaymentChange(Math.min(Math.max(0, value), total));
                }}
                placeholder="Enter advance payment amount"
                className={isMobile ? "h-10" : "h-8 text-sm"}
              />
              <p className="text-[10px] text-gray-500">
                Paying Rs {advancePayment.toFixed(2)} now, Rs {Math.max(0, total - advancePayment).toFixed(2)} credit
              </p>
            </div>
          )}

          <div className="flex justify-between text-xs text-green-600 border-t pt-1.5">
            <span>Paid:</span>
            <span>Rs {paidAmount.toFixed(2)}</span>
          </div>
          {selectedCustomer && creditAmount > 0 && (
            <div className="flex justify-between text-xs text-red-600">
              <span>Credit (Pay Later):</span>
              <span>Rs {creditAmount.toFixed(2)}</span>
            </div>
          )}
          {!selectedCustomer && (
            <div className="text-[10px] text-gray-500 pt-0.5">
              Walk-in customers must pay full amount
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Payment Method</Label>
          <Select value={paymentMethod} onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}>
            <SelectTrigger className={isMobile ? "h-10" : "h-8 text-sm"}>
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

        <Button
          onClick={onCheckout}
          disabled={cart.length === 0 || processing}
          className={`w-full ${isMobile ? "h-12" : "h-9"}`}
          size="lg"
        >
          {processing ? "Processing..." : `Complete Sale (Rs ${paidAmount.toFixed(2)})`}
        </Button>
      </div>
    </>
  );
}
