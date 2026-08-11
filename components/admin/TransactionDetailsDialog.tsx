"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaleService } from "@/lib/services/saleService";
import { OrderService } from "@/lib/services/orderService";
import { LedgerService } from "@/lib/services/ledgerService";
import { VendorService } from "@/lib/services/vendorService";
import { Sale, Order, LedgerEntry, Customer, PurchaseOrder, Vendor, User } from "@/lib/types";
import { Loader2, ExternalLink } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TransactionDetailsDialogProps {
  transactionId: string;
  transactionType: "SALE" | "ORDER" | "LEDGER" | "PURCHASE";
  source?: "POS" | "ONLINE" | "LEDGER" | "PURCHASE";
  vendorId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailsDialog({
  transactionId,
  transactionType,
  source,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [performedByUser, setPerformedByUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && transactionId) {
      fetchTransactionDetails();
    } else {
      // Reset state when dialog closes
      setSale(null);
      setOrder(null);
      setLedgerEntry(null);
      setPurchaseOrder(null);
      setCustomer(null);
      setVendor(null);
      setPerformedByUser(null);
      setError(null);
    }
  }, [open, transactionId, transactionType, source]);

  // Helper function to fetch user by ID
  const fetchUser = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
    return null;
  };

  const fetchTransactionDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      if (transactionType === "SALE" || source === "POS") {
        // Fetch sale details
        const saleData = await SaleService.getSale(transactionId);
        if (saleData) {
          setSale(saleData);
          // Fetch customer if exists
          if (saleData.customerId) {
            try {
              const customerDoc = await getDoc(doc(db, "customers", saleData.customerId));
              if (customerDoc.exists()) {
                setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
              }
            } catch (err) {
              console.error("Error fetching customer:", err);
            }
          }
          // Fetch user who performed the sale
          if (saleData.performedBy) {
            const user = await fetchUser(saleData.performedBy);
            if (user) setPerformedByUser(user);
          }
        } else {
          setError("Sale not found");
        }
      } else if (transactionType === "ORDER" || source === "ONLINE") {
        // Fetch order details
        const orderData = await OrderService.getOrder(transactionId);
        if (orderData) {
          setOrder(orderData);
          // Fetch user who performed/confirmed the order (check both performedBy and processedBy for backward compatibility)
          const performedBy = orderData.performedBy || (orderData as any).processedBy;
          if (performedBy) {
            const user = await fetchUser(performedBy);
            if (user) setPerformedByUser(user);
          }
        } else {
          setError("Order not found");
        }
      } else if (transactionType === "PURCHASE" || source === "PURCHASE") {
        // Fetch purchase order details
        const poData = await VendorService.getPurchaseOrder(transactionId);
        if (poData) {
          setPurchaseOrder(poData);
          // Fetch vendor details
          try {
            const vendorData = await VendorService.getVendor(poData.vendorId);
            if (vendorData) {
              setVendor(vendorData);
            }
          } catch (err) {
            console.error("Error fetching vendor:", err);
          }
          // Fetch user who performed the purchase (use receivedBy if available, otherwise createdBy)
          const performedBy = poData.receivedBy || poData.createdBy;
          if (performedBy) {
            const user = await fetchUser(performedBy);
            if (user) setPerformedByUser(user);
          }
        } else {
          setError("Purchase order not found");
        }
      } else if (transactionType === "LEDGER" || source === "LEDGER") {
        // Fetch ledger entry details
        const entries = await LedgerService.getEntries(
          new Date(0),
          new Date(),
          undefined
        );
        const entry = entries.find((e) => e.id === transactionId);
        if (entry) {
          setLedgerEntry(entry);
          // Fetch user who performed the ledger entry
          if (entry.performedBy) {
            const user = await fetchUser(entry.performedBy);
            if (user) setPerformedByUser(user);
          }
        } else {
          setError("Ledger entry not found");
        }
      }
    } catch (err) {
      console.error("Error fetching transaction details:", err);
      setError(err instanceof Error ? err.message : "Failed to load transaction details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            {transactionType === "SALE" || source === "POS"
              ? "Sale transaction details"
              : transactionType === "ORDER" || source === "ONLINE"
              ? "Order transaction details"
              : transactionType === "PURCHASE" || source === "PURCHASE"
              ? "Purchase order details"
              : "Ledger entry details"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : sale ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Sale ID</p>
                <p className="font-mono text-sm font-medium">{sale.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">
                  {sale.createdAt.toDate().toLocaleString()}
                </p>
              </div>
              {customer && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Customer</p>
                    <p className="font-medium">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{customer.phone}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium">{sale.paymentMethod}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Source</p>
                <p className="font-medium">{sale.source || "POS"}</p>
              </div>
              {performedByUser && (
                <div>
                  <p className="text-sm text-gray-600">Performed By</p>
                  <p className="font-medium">
                    {performedByUser.displayName || performedByUser.email || "Unknown"}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Items</p>
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs {item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">
                          Rs {(item.quantity * item.unitPrice).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="text-lg font-semibold">Rs {sale.subtotal.toFixed(2)}</p>
              </div>
              {sale.discount > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Discount</p>
                  <p className="text-lg font-semibold text-red-600">
                    -Rs {sale.discount.toFixed(2)}
                  </p>
                </div>
              )}
              {sale.tax && sale.tax > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Tax</p>
                  <p className="text-lg font-semibold">Rs {sale.tax.toFixed(2)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-xl font-bold text-green-600">
                  Rs {sale.total.toFixed(2)}
                </p>
              </div>
              {sale.dueAmount > 0 && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Paid Amount</p>
                    <p className="text-lg font-semibold text-green-600">
                      Rs {sale.paidAmount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Due Amount</p>
                    <p className="text-lg font-semibold text-red-600">
                      Rs {sale.dueAmount.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : order ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">
                  {order.createdAt.toDate().toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-medium">{order.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer Name</p>
                <p className="font-medium">{order.customerInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{order.customerInfo.phone}</p>
              </div>
              {order.customerInfo.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{order.customerInfo.email}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{order.customerInfo.address}</p>
              </div>
              {performedByUser && (
                <div>
                  <p className="text-sm text-gray-600">Performed By</p>
                  <p className="font-medium">
                    {performedByUser.displayName || performedByUser.email || "Unknown"}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Items</p>
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs {item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">
                          Rs {item.subtotal.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="text-lg font-semibold">Rs {order.subtotal.toFixed(2)}</p>
              </div>
              {order.discount > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Discount</p>
                  <p className="text-lg font-semibold text-red-600">
                    -Rs {order.discount.toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-xl font-bold text-green-600">
                  Rs {order.total.toFixed(2)}
                </p>
              </div>
              {order.loyaltyPointsUsed && order.loyaltyPointsUsed > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Loyalty Points Used</p>
                  <p className="text-lg font-semibold">{order.loyaltyPointsUsed}</p>
                </div>
              )}
            </div>
          </div>
        ) : ledgerEntry ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Entry ID</p>
                <p className="font-mono text-sm font-medium">{ledgerEntry.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium">
                  {ledgerEntry.date.toDate().toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className={`font-medium ${
                  ledgerEntry.type === "INCOME" ? "text-green-600" : "text-red-600"
                }`}>
                  {ledgerEntry.type}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <p className="font-medium">{ledgerEntry.category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium">{ledgerEntry.paymentMethod}</p>
              </div>
              {ledgerEntry.relatedId && (
                <div>
                  <p className="text-sm text-gray-600">Related ID</p>
                  <p className="font-mono text-xs">{ledgerEntry.relatedId}</p>
                </div>
              )}
              {performedByUser && (
                <div>
                  <p className="text-sm text-gray-600">Performed By</p>
                  <p className="font-medium">
                    {performedByUser.displayName || performedByUser.email || "Unknown"}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Description</p>
              <p className="font-medium">{ledgerEntry.description}</p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600">Amount</p>
              <p className={`text-2xl font-bold ${
                ledgerEntry.type === "INCOME" ? "text-green-600" : "text-red-600"
              }`}>
                {ledgerEntry.type === "INCOME" ? "+" : "-"}Rs {ledgerEntry.amount.toFixed(2)}
              </p>
            </div>
          </div>
        ) : purchaseOrder ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <p className="text-sm text-gray-600">PO ID</p>
                  <p className="font-mono text-sm font-medium">{purchaseOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium">
                    {purchaseOrder.createdAt.toDate().toLocaleString()}
                  </p>
                </div>
                {vendor && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Vendor</p>
                      <p className="font-medium">{vendor.companyName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Contact</p>
                      <p className="font-medium">{vendor.contactPerson}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className={`font-medium ${
                    purchaseOrder.status === "RECEIVED" ? "text-green-600" :
                    purchaseOrder.status === "APPROVED" ? "text-blue-600" :
                    purchaseOrder.status === "CANCELLED" ? "text-red-600" :
                    "text-yellow-600"
                  }`}>
                    {purchaseOrder.status}
                  </p>
                </div>
                {purchaseOrder.receivedAt && (
                  <div>
                    <p className="text-sm text-gray-600">Received Date</p>
                    <p className="font-medium">
                      {purchaseOrder.receivedAt.toDate().toLocaleString()}
                    </p>
                  </div>
                )}
                {performedByUser && (
                  <div>
                    <p className="text-sm text-gray-600">Performed By</p>
                    <p className="font-medium">
                      {performedByUser.displayName || performedByUser.email || "Unknown"}
                    </p>
                  </div>
                )}
              </div>
              <Link
                href={`/admin/vendors/${purchaseOrder.vendorId}/purchase-orders/${purchaseOrder.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open PO Details
                </Button>
              </Link>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Items</p>
              <div className="border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered Qty</TableHead>
                      <TableHead>Ordered Unit Price</TableHead>
                      {purchaseOrder.status === "RECEIVED" && (
                        <>
                          <TableHead>Received Qty</TableHead>
                          <TableHead>Received Unit Price</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.items.map((item, index) => {
                      const orderedTotal = item.quantity * item.unitPrice;
                      const receivedQty = item.receivedQuantity || 0;
                      const receivedPrice = item.receivedUnitPrice ?? item.unitPrice;
                      const receivedTotal = receivedQty * receivedPrice;
                      const isReceived = purchaseOrder.status === "RECEIVED";
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>Rs {item.unitPrice.toFixed(2)}</TableCell>
                          {isReceived && (
                            <>
                              <TableCell>{receivedQty}</TableCell>
                              <TableCell>
                                {item.receivedUnitPrice !== undefined &&
                                item.receivedUnitPrice !== item.unitPrice ? (
                                  <span>
                                    <span className="text-gray-400 line-through mr-2">
                                      Rs {item.unitPrice.toFixed(2)}
                                    </span>
                                    <span className="font-semibold text-green-600">
                                      Rs {item.receivedUnitPrice.toFixed(2)}
                                    </span>
                                  </span>
                                ) : (
                                  <span>Rs {receivedPrice.toFixed(2)}</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-medium">
                            {isReceived && receivedTotal !== orderedTotal ? (
                              <span>
                                <span className="text-gray-400 line-through mr-2">
                                  Rs {orderedTotal.toFixed(2)}
                                </span>
                                <span className="font-semibold text-green-600">
                                  Rs {receivedTotal.toFixed(2)}
                                </span>
                              </span>
                            ) : (
                              <span>Rs {orderedTotal.toFixed(2)}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Ordered Total Amount</p>
                <p className="text-lg font-semibold">Rs {purchaseOrder.totalAmount.toFixed(2)}</p>
              </div>
              {purchaseOrder.status === "RECEIVED" && purchaseOrder.receivedTotalAmount !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">Received Total Amount</p>
                  {purchaseOrder.receivedTotalAmount !== purchaseOrder.totalAmount ? (
                    <div>
                      <p className="text-gray-400 line-through text-sm">
                        Rs {purchaseOrder.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-lg font-semibold text-green-600">
                        Rs {purchaseOrder.receivedTotalAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Difference: Rs {Math.abs(purchaseOrder.receivedTotalAmount - purchaseOrder.totalAmount).toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold">Rs {purchaseOrder.receivedTotalAmount.toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

