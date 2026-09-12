"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductService } from "@/lib/services/productService";
import { ImageService } from "@/lib/services/imageService";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { Warehouse } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { Timestamp } from "firebase/firestore";

export default function CreateProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "",
    price: "",
    costPrice: "",
    discount: "",
  });
  const [markupPercent, setMarkupPercent] = useState<string>("20");

  const [warehouseData, setWarehouseData] = useState<Record<string, { quantity: string; position: string; minQuantity: string }>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch warehouses on mount
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
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
    fetchWarehouses();
  }, []);

  // Generate next SKU on mount
  useEffect(() => {
    const fetchNextSku = async () => {
      try {
        const nextSku = await ProductService.generateNextSku();
        setFormData((prev) => ({ ...prev, sku: nextSku }));
      } catch (error) {
        console.error("Error generating SKU:", error);
      }
    };
    fetchNextSku();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = ImageService.validateImage(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid image");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Build warehouses object
      const warehousesObj: Record<string, { quantity: number; position: string; minQuantity: number }> = {};
      Object.keys(warehouseData).forEach((warehouseId) => {
        const data = warehouseData[warehouseId];
        if (data.quantity) {
          warehousesObj[warehouseId] = {
            quantity: parseInt(data.quantity) || 0,
            position: data.position || "",
            minQuantity: parseInt(data.minQuantity) || 0,
          };
        }
      });

      // Create product
      await ProductService.createProduct(
        {
          sku: formData.sku,
          name: formData.name,
          description: formData.description || undefined,
          category: formData.category,
          price: parseFloat(formData.price),
          costPrice: formData.costPrice && !isNaN(parseFloat(formData.costPrice)) ? parseFloat(formData.costPrice) : undefined,
          discount: formData.discount && !isNaN(parseFloat(formData.discount)) ? parseFloat(formData.discount) : undefined,
          warehouses: warehousesObj,
          attributes: {},
          isActive: true,
        },
        imageFile || undefined
      );

      router.push("/admin/inventory/products");
    } catch (err: any) {
      setError(err.message || "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.CREATE }}>
      <AdminLayout>
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Create New Product</h1>
            <p className="text-gray-600 mt-2">Add a new product to your inventory</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>Basic product details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / Barcode</Label>
                    <Input
                      id="sku"
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      required
                      placeholder="PROD-001"
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Rice Cooker"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Product description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      placeholder="Appliances"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price (Rs)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Cost Price (Rs)</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                      placeholder="0.00"
                    />
                    {/* Recommended Selling Price */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">Markup %:</span>
                      <Input
                        type="number"
                        value={markupPercent}
                        onChange={(e) => setMarkupPercent(e.target.value)}
                        className="w-20 h-7 text-xs"
                        min={0}
                        step={1}
                      />
                    </div>
                    {formData.costPrice && !isNaN(parseFloat(formData.costPrice)) && parseFloat(formData.costPrice) > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        Recommended Selling Price: Rs {(parseFloat(formData.costPrice) * (1 + (parseFloat(markupPercent) || 0) / 100)).toFixed(2)}
                        {` (${markupPercent}% markup)`}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discount">Discount (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.discount}
                      onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Product Image</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img src={imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {warehouses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Warehouse Inventory</CardTitle>
                  <CardDescription>Set initial quantities for each warehouse</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded">
                      <div>
                        <Label>{warehouse.name}</Label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`qty-${warehouse.id}`}>Quantity</Label>
                        <Input
                          id={`qty-${warehouse.id}`}
                          type="number"
                          value={warehouseData[warehouse.id]?.quantity || ""}
                          onChange={(e) =>
                            setWarehouseData({
                              ...warehouseData,
                              [warehouse.id]: {
                                ...warehouseData[warehouse.id],
                                quantity: e.target.value,
                                position: warehouseData[warehouse.id]?.position || "",
                                minQuantity: warehouseData[warehouse.id]?.minQuantity || "",
                              },
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`pos-${warehouse.id}`}>Position</Label>
                        <Input
                          id={`pos-${warehouse.id}`}
                          type="text"
                          value={warehouseData[warehouse.id]?.position || ""}
                          onChange={(e) =>
                            setWarehouseData({
                              ...warehouseData,
                              [warehouse.id]: {
                                ...warehouseData[warehouse.id],
                                quantity: warehouseData[warehouse.id]?.quantity || "",
                                position: e.target.value,
                                minQuantity: warehouseData[warehouse.id]?.minQuantity || "",
                              },
                            })
                          }
                          placeholder="Row A - Shelf 2"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Product"}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

