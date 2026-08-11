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
import { ImageService } from "@/lib/services/imageService";
import { ProductService } from "@/lib/services/productService";
import { PurchaseOrder, Vendor, Warehouse, RESOURCES, ACTIONS } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Package, Upload, X } from "lucide-react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageGalleryDialog } from "@/components/ui/ImageGalleryDialog";
import { DownloadCloud } from "lucide-react";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const poId = params.poId as string;
  const { user } = useAuth();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGRNForm, setShowGRNForm] = useState(false);
  const [grnData, setGrnData] = useState<
    Record<string, { receivedQuantity: string; receivedUnitPrice: string; warehouseId: string }>
  >({});
  const [billImageFiles, setBillImageFiles] = useState<File[]>([]);
  const [billImagePreviews, setBillImagePreviews] = useState<string[]>([]);
  const [uploadingBill, setUploadingBill] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const allBillUrls = [
    ...(purchaseOrder?.billImageUrls || []),
    ...(purchaseOrder?.billImageUrl && !purchaseOrder?.billImageUrls?.includes(purchaseOrder.billImageUrl) ? [purchaseOrder.billImageUrl] : [])
  ];

  useEffect(() => {
    if (poId) {
      fetchPurchaseOrder();
      fetchWarehouses();
    }
  }, [poId]);

  const fetchPurchaseOrder = async () => {
    try {
      const poDoc = await getDoc(doc(db, "purchase_orders", poId));
      if (poDoc.exists()) {
        const po = { id: poDoc.id, ...poDoc.data() } as PurchaseOrder;
        setPurchaseOrder(po);

        // Fetch vendor
        const vendorData = await VendorService.getVendor(po.vendorId);
        setVendor(vendorData);

        // Initialize GRN data
        const initialGrnData: Record<string, { receivedQuantity: string; receivedUnitPrice: string; warehouseId: string }> = {};
        po.items.forEach((item) => {
          initialGrnData[item.productId] = {
            receivedQuantity: item.quantity.toString(),
            receivedUnitPrice: item.unitPrice.toString(),
            warehouseId: "",
          };
        });
        setGrnData(initialGrnData);
      }
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      setError("Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const { collection, getDocs } = await import("firebase/firestore");
      const querySnapshot = await getDocs(collection(db, "warehouses"));
      const warehouseList: Warehouse[] = [];
      querySnapshot.forEach((doc) => {
        warehouseList.push({ id: doc.id, ...doc.data() } as Warehouse);
      });
      setWarehouses(warehouseList);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
    }
  };

  const handleBillImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...billImageFiles, ...files];
    setBillImageFiles(newFiles);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = "";
  };

  const removeBillImage = (index: number) => {
    setBillImageFiles((prev) => prev.filter((_, i) => i !== index));
    setBillImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcessGRN = async () => {
    if (!user || !purchaseOrder) return;

    // Validate GRN data
    const receivedItems: Array<{
      productId: string;
      receivedQuantity: number;
      receivedUnitPrice: number;
      warehouseId: string;
    }> = [];

    for (const [productId, data] of Object.entries(grnData)) {
      const quantity = parseFloat(data.receivedQuantity) || 0;
      const unitPrice = parseFloat(data.receivedUnitPrice) || 0;
      if (quantity > 0 && data.warehouseId && unitPrice > 0) {
        receivedItems.push({
          productId,
          receivedQuantity: quantity,
          receivedUnitPrice: unitPrice,
          warehouseId: data.warehouseId,
        });
      }
    }

    if (receivedItems.length === 0) {
      setError("Please specify received quantities, unit prices, and warehouses for at least one item");
      return;
    }

    setError(null);
    setProcessing(true);
    setUploadingBill(true);

    try {
      let billImageUrls: string[] = [];
      if (billImageFiles.length > 0) {
        try {
          billImageUrls = await Promise.all(
            billImageFiles.map((file) =>
              ImageService.uploadImage(file, `purchase-orders/${poId}`)
            )
          );
        } catch (uploadError) {
          console.error("Error uploading bill images:", uploadError);
          setError("Failed to upload bill images. Please try again.");
          setProcessing(false);
          setUploadingBill(false);
          return;
        }
      }

      await VendorService.processGRN(poId, receivedItems, user.uid, billImageUrls);
      alert("GRN processed successfully! Inventory has been updated.");
      router.push(`/admin/vendors/${vendorId}/purchase-orders`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Failed to process GRN");
    }
  };

  const handleDownloadAllBills = async () => {
    if (!allBillUrls.length) return;

    for (let i = 0; i < allBillUrls.length; i++) {
      const url = allBillUrls[i];
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `bill-${poId}-${i + 1}-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        // Small delay to prevent browser blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error("Error downloading image:", error);
      }
    }
  };

  const getStatusColor = (status: PurchaseOrder["status"]) => {
    switch (status) {
      case "PENDING":
        return "text-yellow-600 bg-yellow-50";
      case "APPROVED":
        return "text-blue-600 bg-blue-50";
      case "RECEIVED":
        return "text-green-600 bg-green-50";
      case "CANCELLED":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading purchase order details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!purchaseOrder) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Purchase Order not found</h1>
            <Link href={`/admin/vendors/${vendorId}/purchase-orders`}>
              <Button>Back to Purchase Orders</Button>
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
          <div className="flex items-center gap-4">
            <Link href={`/admin/vendors/${vendorId}/purchase-orders`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Purchase Order Details</h1>
              <p className="text-gray-600 mt-1">
                PO ID: {poId.slice(0, 8)}... | Vendor: {vendor?.companyName || "Unknown"}
              </p>
            </div>
            {purchaseOrder.status !== "RECEIVED" && purchaseOrder.status !== "CANCELLED" && (
              <Button onClick={() => setShowGRNForm(!showGRNForm)}>
                <Package className="mr-2 h-4 w-4" />
                {showGRNForm ? "Cancel GRN" : "Process GRN"}
              </Button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      purchaseOrder.status
                    )}`}
                  >
                    {purchaseOrder.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Created Date</p>
                  <p className="font-medium">
                    {purchaseOrder.createdAt.toDate().toLocaleDateString()}
                  </p>
                </div>
                {purchaseOrder.receivedAt && (
                  <div>
                    <p className="text-sm text-gray-600">Received Date</p>
                    <p className="font-medium">
                      {purchaseOrder.receivedAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vendor Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Company Name</p>
                  <p className="font-medium">{vendor?.companyName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact Person</p>
                  <p className="font-medium">{vendor?.contactPerson || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{vendor?.phone || "N/A"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="text-sm text-gray-600">Ordered Total Amount</p>
                  <p className="text-2xl font-bold">Rs {purchaseOrder.totalAmount.toFixed(2)}</p>
                </div>
                {purchaseOrder.status === "RECEIVED" && purchaseOrder.receivedTotalAmount !== undefined && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Received Total Amount</p>
                    {purchaseOrder.receivedTotalAmount !== purchaseOrder.totalAmount ? (
                      <div>
                        <p className="text-gray-400 line-through text-lg">
                          Rs {purchaseOrder.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          Rs {purchaseOrder.receivedTotalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Difference: Rs {Math.abs(purchaseOrder.receivedTotalAmount - purchaseOrder.totalAmount).toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold">Rs {purchaseOrder.receivedTotalAmount.toFixed(2)}</p>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Items Count</p>
                  <p className="text-lg font-medium">{purchaseOrder.items.length} items</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Products in this purchase order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Ordered Qty</TableHead>
                      <TableHead>Ordered Unit Price</TableHead>
                      <TableHead>Ordered Total</TableHead>
                      {purchaseOrder.status === "RECEIVED" && (
                        <>
                          <TableHead>Received Qty</TableHead>
                          <TableHead>Received Unit Price</TableHead>
                          <TableHead>Received Total</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrder.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs {item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="font-medium">
                          Rs {(item.quantity * item.unitPrice).toFixed(2)}
                        </TableCell>
                        {purchaseOrder.status === "RECEIVED" && (
                          <>
                            <TableCell>{item.receivedQuantity || item.quantity}</TableCell>
                            <TableCell>
                              {item.receivedUnitPrice !== undefined ? (
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
                                  <span>Rs {item.receivedUnitPrice.toFixed(2)}</span>
                                )
                              ) : (
                                <span className="text-gray-400">Rs {item.unitPrice.toFixed(2)}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.receivedQuantity && item.receivedUnitPrice !== undefined ? (
                                item.receivedQuantity * item.receivedUnitPrice !== item.quantity * item.unitPrice ? (
                                  <span>
                                    <span className="text-gray-400 line-through mr-2">
                                      Rs {(item.quantity * item.unitPrice).toFixed(2)}
                                    </span>
                                    <span className="font-semibold text-green-600">
                                      Rs {(item.receivedQuantity * item.receivedUnitPrice).toFixed(2)}
                                    </span>
                                  </span>
                                ) : (
                                  <span>Rs {(item.receivedQuantity * item.receivedUnitPrice).toFixed(2)}</span>
                                )
                              ) : (
                                <span className="text-gray-400">
                                  Rs {(item.quantity * item.unitPrice).toFixed(2)}
                                </span>
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {showGRNForm && purchaseOrder.status !== "RECEIVED" && (
            <Card>
              <CardHeader>
                <CardTitle>Process GRN (Goods Received Note)</CardTitle>
                <CardDescription>
                  Record received quantities and update inventory
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Ordered Qty</TableHead>
                        <TableHead>Ordered Unit Price</TableHead>
                        <TableHead>Received Qty</TableHead>
                        <TableHead>Received Unit Price</TableHead>
                        <TableHead>Warehouse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrder.items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="text-gray-600">
                            Rs {item.unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={grnData[item.productId]?.receivedQuantity || ""}
                              onChange={(e) =>
                                setGrnData({
                                  ...grnData,
                                  [item.productId]: {
                                    ...grnData[item.productId],
                                    receivedQuantity: e.target.value,
                                    receivedUnitPrice: grnData[item.productId]?.receivedUnitPrice || item.unitPrice.toString(),
                                    warehouseId: grnData[item.productId]?.warehouseId || "",
                                  },
                                })
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={grnData[item.productId]?.receivedUnitPrice || item.unitPrice.toString()}
                              onChange={(e) =>
                                setGrnData({
                                  ...grnData,
                                  [item.productId]: {
                                    ...grnData[item.productId],
                                    receivedQuantity: grnData[item.productId]?.receivedQuantity || "",
                                    receivedUnitPrice: e.target.value,
                                    warehouseId: grnData[item.productId]?.warehouseId || "",
                                  },
                                })
                              }
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={grnData[item.productId]?.warehouseId || ""}
                              onValueChange={(value) =>
                                setGrnData({
                                  ...grnData,
                                  [item.productId]: {
                                    ...grnData[item.productId],
                                    receivedQuantity: grnData[item.productId]?.receivedQuantity || "",
                                    receivedUnitPrice: grnData[item.productId]?.receivedUnitPrice || item.unitPrice.toString(),
                                    warehouseId: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billImage">Vendor Bill Images (Optional)</Label>
                  <Input
                    id="billImage"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleBillImageChange}
                    disabled={processing || uploadingBill}
                  />
                  {billImagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      {billImagePreviews.map((preview, index) => (
                        <div key={index} className="relative inline-block">
                          <img
                            src={preview}
                            alt={`Bill preview ${index + 1}`}
                            className="h-24 w-24 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => removeBillImage(index)}
                            disabled={processing || uploadingBill}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button onClick={handleProcessGRN} disabled={processing || uploadingBill}>
                    {processing || uploadingBill ? "Processing..." : "Process GRN"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowGRNForm(false);
                      setBillImageFiles([]);
                      setBillImagePreviews([]);
                    }}
                    disabled={processing || uploadingBill}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {allBillUrls.length > 0 && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Vendor Bill(s)</CardTitle>
                  {allBillUrls.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 text-xs"
                      onClick={handleDownloadAllBills}
                    >
                      <DownloadCloud className="h-3.5 w-3.5" />
                      Download All ({allBillUrls.length})
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {allBillUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Vendor bill ${index + 1}`}
                          className="h-32 w-32 object-cover rounded-lg border shadow-sm cursor-zoom-in group-hover:opacity-90 transition-all"
                          onClick={() => {
                            setGalleryIndex(index);
                            setGalleryOpen(true);
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-black/40 text-white px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur-sm">
                            Click to View
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <ImageGalleryDialog
                imageUrls={allBillUrls}
                initialIndex={galleryIndex}
                altPrefix="Vendor Bill"
                open={galleryOpen}
                onOpenChange={setGalleryOpen}
              />
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

