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
import { ProductService } from "@/lib/services/productService";
import { Vendor, Product, PurchaseOrderItem, RESOURCES, ACTIONS } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CreatePurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendorId) {
      fetchVendorData();
      fetchProducts();
    }
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      const vendorData = await VendorService.getVendor(vendorId);
      setVendor(vendorData);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      setError("Failed to load vendor");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productList = await ProductService.getAllProducts();
      setProducts(productList);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: "",
        productName: "",
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    // If productId changed, update productName
    if (field === "productId" && value) {
      const product = products.find((p) => p.id === value);
      if (product) {
        updatedItems[index].productName = product.name;
      }
    }

    setItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !vendor) return;

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    // Validate all items
    for (const item of items) {
      if (!item.productId || item.quantity <= 0 || item.unitPrice <= 0) {
        setError("Please fill in all item details correctly");
        return;
      }
    }

    setError(null);
    setSaving(true);

    try {
      await VendorService.createPurchaseOrder(vendorId, items, user.uid);
      router.push(`/admin/vendors/${vendorId}/purchase-orders`);
    } catch (err: any) {
      setError(err.message || "Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.CREATE }}>
        <AdminLayout>
          <div className="text-center py-12">Loading...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!vendor) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.CREATE }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
            <Link href="/admin/vendors">
              <Button>Back to Vendors</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.CREATE }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/vendors/${vendorId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Create Purchase Order</h1>
              <p className="text-gray-600 mt-1">Vendor: {vendor.companyName}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Purchase Order Items</CardTitle>
                    <CardDescription>Add products to purchase from this vendor</CardDescription>
                  </div>
                  <Button type="button" onClick={addItem} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No items added. Click "Add Item" to start.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit Price (Rs)</TableHead>
                            <TableHead>Total (Rs)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Select
                                  value={item.productId}
                                  onValueChange={(value) => updateItem(index, "productId", value)}
                                >
                                  <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select product" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map((product) => (
                                      <SelectItem key={product.id} value={product.id}>
                                        {product.name} ({product.sku})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity || ""}
                                  onChange={(e) =>
                                    updateItem(index, "quantity", parseInt(e.target.value) || 0)
                                  }
                                  className="w-24"
                                  required
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unitPrice || ""}
                                  onChange={(e) =>
                                    updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-32"
                                  required
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                Rs {(item.quantity * item.unitPrice).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total Amount</p>
                        <p className="text-2xl font-bold">Rs {totalAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4 justify-end">
              <Link href={`/admin/vendors/${vendorId}`}>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={saving || items.length === 0}>
                {saving ? "Creating..." : "Create Purchase Order"}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

