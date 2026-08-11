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
import { VendorService } from "@/lib/services/vendorService";
import { PurchaseOrder, Vendor } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ProductPOHistoryDialogProps {
  productId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductPOHistoryDialog({
  productId,
  productName,
  open,
  onOpenChange,
}: ProductPOHistoryDialogProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Record<string, Vendor>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      fetchPOHistory();
    }
  }, [open, productId]);

  const fetchPOHistory = async () => {
    setLoading(true);
    try {
      const pos = await VendorService.getPurchaseOrdersByProduct(productId);
      setPurchaseOrders(pos);

      // Fetch vendor details for each PO
      const vendorMap: Record<string, Vendor> = {};
      for (const po of pos) {
        if (!vendorMap[po.vendorId]) {
          try {
            const vendor = await VendorService.getVendor(po.vendorId);
            if (vendor) {
              vendorMap[po.vendorId] = vendor;
            }
          } catch (error) {
            console.error(`Error fetching vendor ${po.vendorId}:`, error);
          }
        }
      }
      setVendors(vendorMap);
    } catch (error) {
      console.error("Error fetching PO history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getItemFromPO = (po: PurchaseOrder) => {
    return po.items.find((item) => item.productId === productId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Purchase Order History</DialogTitle>
          <DialogDescription>
            Purchase history for {productName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No purchase orders found for this product
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ordered Qty</TableHead>
                  <TableHead>Ordered Unit Price</TableHead>
                  <TableHead>Received Qty</TableHead>
                  <TableHead>Received Unit Price</TableHead>
                  <TableHead>Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => {
                  const item = getItemFromPO(po);
                  if (!item) return null;

                  const vendor = vendors[po.vendorId];
                  const receivedQty = item.receivedQuantity || 0;
                  const receivedPrice = item.receivedUnitPrice ?? item.unitPrice;
                  const orderedTotal = item.quantity * item.unitPrice;
                  const receivedTotal = receivedQty * receivedPrice;
                  const isReceived = po.status === "RECEIVED";

                  return (
                    <TableRow key={po.id}>
                      <TableCell>
                        {po.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {vendor?.companyName || "Unknown Vendor"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            po.status === "RECEIVED"
                              ? "bg-green-100 text-green-700"
                              : po.status === "APPROVED"
                              ? "bg-blue-100 text-blue-700"
                              : po.status === "CANCELLED"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {po.status}
                        </span>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>Rs {item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        {isReceived ? receivedQty : "-"}
                      </TableCell>
                      <TableCell>
                        {isReceived ? (
                          item.receivedUnitPrice !== undefined &&
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
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {isReceived ? (
                          receivedTotal !== orderedTotal ? (
                            <span>
                              <span className="text-gray-400 line-through mr-2">
                                Rs {orderedTotal.toFixed(2)}
                              </span>
                              <span className="font-semibold text-green-600">
                                Rs {receivedTotal.toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            <span>Rs {receivedTotal.toFixed(2)}</span>
                          )
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
        )}
      </DialogContent>
    </Dialog>
  );
}

