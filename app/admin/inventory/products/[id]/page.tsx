"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductService } from "@/lib/services/productService";
import { ImageService } from "@/lib/services/imageService";
import { PrinterService, ESCPOSCommands } from "@/lib/services/printerService";
import { Product, Warehouse } from "@/lib/types";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Edit, Trash2, Save, X, QrCode, Download, Printer, Package } from "lucide-react";
import QRCode from "react-qr-code";
import { parseQRData } from "@/lib/utils/qrCode";
import Link from "next/link";
import { ProductPOHistoryDialog } from "@/components/admin/ProductPOHistoryDialog";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const { hasPermission } = usePermissions();
  const [product, setProduct] = useState<Product | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [showPOHistory, setShowPOHistory] = useState(false);
  const [markupPercent, setMarkupPercent] = useState<string>("20");

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category: "",
    price: "",
    costPrice: "",
    discount: "",
  });

  const [warehouseData, setWarehouseData] = useState<
    Record<string, { quantity: string; position: string; minQuantity: string }>
  >({});

  useEffect(() => {
    if (productId) {
      fetchProductData();
      fetchWarehouses();
    }
  }, [productId]);

  const fetchProductData = async () => {
    try {
      const productData = await ProductService.getProduct(productId);
      if (productData) {
        setProduct(productData);
        setFormData({
          name: productData.name,
          sku: productData.sku,
          description: productData.description || "",
          category: productData.category,
          price: productData.price.toString(),
          costPrice: productData.costPrice?.toString() || "",
          discount: productData.discount?.toString() || "",
        });

        // Initialize warehouse data
        const whData: Record<string, { quantity: string; position: string; minQuantity: string }> = {};
        Object.keys(productData.warehouses).forEach((whId) => {
          const wh = productData.warehouses[whId];
          whData[whId] = {
            quantity: wh.quantity.toString(),
            position: wh.position || "",
            minQuantity: wh.minQuantity?.toString() || "0",
          };
        });
        setWarehouseData(whData);
        setImagePreview(productData.imageUrl || null);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      setError("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!product) return;
    setError(null);
    setSaving(true);

    try {
      // Upload new image if provided
      let imageUrl: string | undefined = product.imageUrl;
      if (imageFile) {
        // Delete old image if exists
        if (product.imageUrl) {
          try {
            await ImageService.deleteImage(product.imageUrl);
          } catch (err) {
            console.warn("Failed to delete old image:", err);
          }
        }
        imageUrl = await ImageService.uploadImage(imageFile, "products");
      }

      // Update product
      await ProductService.updateProduct(productId, {
        name: formData.name,
        sku: formData.sku,
        description: formData.description || undefined,
        category: formData.category,
        price: parseFloat(formData.price),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        discount: formData.discount ? parseFloat(formData.discount) : undefined,
        imageUrl,
      });

      // Update warehouse quantities
      for (const [warehouseId, data] of Object.entries(warehouseData)) {
        if (data.quantity) {
          await ProductService.updateWarehouseQuantity(
            productId,
            warehouseId,
            parseInt(data.quantity) || 0,
            data.position || undefined
          );
        }
      }

      setEditing(false);
      setImageFile(null);
      await fetchProductData();
    } catch (err: any) {
      setError(err.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete image if exists
      if (product.imageUrl) {
        try {
          await ImageService.deleteImage(product.imageUrl);
        } catch (err) {
          console.warn("Failed to delete image:", err);
        }
      }

      await ProductService.deleteProduct(productId);
      router.push("/admin/inventory/products");
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading product details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!product) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Product not found</h1>
            <Link href="/admin/inventory/products">
              <Button>Back to Products</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const totalStock = Object.values(product.warehouses).reduce((sum, wh) => sum + wh.quantity, 0);

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/inventory/products">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <p className="text-gray-600 mt-1">Product Details</p>
            </div>

            {!editing && (
              <div className="flex gap-2">
                <Button onClick={() => setShowPOHistory(true)} variant="outline">
                  <Package className="mr-2 h-4 w-4" />
                  PO History
                </Button>
                {hasPermission("inventory", "update") && (
                  <Button onClick={() => setEditing(true)} variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                {hasPermission("inventory", "delete") && (
                  <Button onClick={handleDelete} variant="outline" className="text-red-600 hover:text-red-700">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button onClick={() => setShowPOHistory(true)} variant="outline">
                  <Package className="mr-2 h-4 w-4" />
                  PO History
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setEditing(false);
                    setImageFile(null);
                    fetchProductData();
                  }}
                  variant="outline"
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU / Barcode</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Selling Price (Rs)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          required
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
                        />
                        {/* Markup / Recommended Selling Price */}
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
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="image">Product Image</Label>
                      <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                      {imagePreview && (
                        <div className="mt-2">
                          <img src={imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded" />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">SKU</p>
                      <p className="font-mono font-medium">{product.sku}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="font-medium">{product.category}</p>
                    </div>
                    {product.description && (
                      <div>
                        <p className="text-sm text-gray-600">Description</p>
                        <p className="font-medium">{product.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Selling Price</p>
                        {product.discount && product.discount > 0 ? (
                          <div>
                            <p className="text-sm text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                            <p className="text-lg font-bold text-green-600">
                              Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                            </p>
                            <p className="text-xs text-red-600 font-semibold">-{product.discount.toFixed(0)}% OFF</p>
                          </div>
                        ) : (
                          <p className="text-lg font-bold">Rs {product.price.toFixed(2)}</p>
                        )}
                      </div>
                      {product.costPrice && (
                        <div>
                          <p className="text-sm text-gray-600">Cost Price</p>
                          <p className="text-lg font-bold">Rs {product.costPrice.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                    {product.imageUrl && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Product Image</p>
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-48 w-48 object-cover rounded border"
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Total Stock</p>
                  <p className={`text-2xl font-bold ${totalStock === 0 ? "text-red-600" : "text-green-600"}`}>
                    {totalStock} units
                  </p>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    {warehouses.map((warehouse) => (
                      <div key={warehouse.id} className="p-4 border rounded space-y-2">
                        <Label className="font-medium">{warehouse.name}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor={`qty-${warehouse.id}`} className="text-xs">
                              Quantity
                            </Label>
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
                                    minQuantity: warehouseData[warehouse.id]?.minQuantity || "0",
                                  },
                                })
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`pos-${warehouse.id}`} className="text-xs">
                              Position
                            </Label>
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
                                    minQuantity: warehouseData[warehouse.id]?.minQuantity || "0",
                                  },
                                })
                              }
                              placeholder="Row A - Shelf 2"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(product.warehouses).map(([warehouseId, whData]) => {
                      const warehouse = warehouses.find((w) => w.id === warehouseId);
                      return (
                        <div key={warehouseId} className="p-3 border rounded">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{warehouse?.name || warehouseId}</span>
                            <span className={whData.quantity === 0 ? "text-red-600 font-semibold" : "font-semibold"}>
                              {whData.quantity} units
                            </span>
                          </div>
                          {whData.position && (
                            <p className="text-xs text-gray-500 mt-1">Position: {whData.position}</p>
                          )}
                        </div>
                      );
                    })}
                    {Object.keys(product.warehouses).length === 0 && (
                      <p className="text-sm text-gray-500">No warehouse assignments</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {product.trackTrace?.qrCodeUrl && (
            <Card>
              <CardHeader>
                <CardTitle>QR Code</CardTitle>
                <CardDescription>Scan to view product details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white rounded border" id="qr-code-container">
                    {(() => {
                      try {
                        // qrCodeUrl is a JSON string, parse it to get the data
                        const qrData = parseQRData(product.trackTrace.qrCodeUrl);
                        if (qrData) {
                          return (
                            <QRCode
                              value={product.trackTrace.qrCodeUrl}
                              size={128}
                              level="M"
                            />
                          );
                        }
                        // Fallback: if parsing fails, try to render directly
                        return (
                          <div data-qr-code={product.id}>
                            <QRCode
                              value={product.trackTrace.qrCodeUrl}
                              size={128}
                              level="M"
                            />
                          </div>
                        );
                      } catch (error) {
                        console.error("Error rendering QR code:", error);
                        return (
                          <div className="w-32 h-32 flex items-center justify-center text-red-500 text-xs">
                            Error rendering QR code
                          </div>
                        );
                      }
                    })()}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Product ID: {product.id}</p>
                    <p className="text-sm text-gray-600 mb-4">SKU: {product.sku}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Download QR code as SVG
                          const container = document.getElementById("qr-code-container");
                          if (container) {
                            const svg = container.querySelector("svg");
                            if (svg) {
                              const svgData = new XMLSerializer().serializeToString(svg);
                              const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `qr-code-${product.sku}.svg`;
                              link.click();
                              URL.revokeObjectURL(url);
                            }
                          }
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={printing}
                        onClick={async () => {
                          setPrinting(true);
                          try {
                            // Get printer settings
                            const settings = await PrinterService.getSettings();
                            if (!settings || !settings.type) {
                              alert("Please configure a printer in Settings first");
                              return;
                            }

                            // Create print content with QR code
                            const container = document.getElementById("qr-code-container");
                            if (container) {
                              const svg = container.querySelector("svg");
                              if (svg) {
                                // Convert SVG to image for printing
                                const svgData = new XMLSerializer().serializeToString(svg);
                                const img = new Image();
                                img.onload = async () => {
                                  try {
                                    // Connect to printer
                                    await PrinterService.connect(settings.type);

                                    // Print QR code label
                                    const printContent = `
${ESCPOSCommands.center()}
${ESCPOSCommands.bold(true)}
Product: ${product.name}
SKU: ${product.sku}
${ESCPOSCommands.bold(false)}
${ESCPOSCommands.lineFeed(1)}
[QR Code Image]
${ESCPOSCommands.lineFeed(2)}
${ESCPOSCommands.cut()}
`;
                                    await PrinterService.printText(printContent);
                                    alert("QR code printed successfully");
                                  } catch (error) {
                                    console.error("Error printing:", error);
                                    alert(error instanceof Error ? error.message : "Failed to print QR code");
                                  } finally {
                                    await PrinterService.disconnect();
                                  }
                                };
                                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                              }
                            }
                          } catch (error) {
                            console.error("Error printing QR code:", error);
                            alert(error instanceof Error ? error.message : "Failed to print QR code");
                          } finally {
                            setPrinting(false);
                          }
                        }}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        {printing ? "Printing..." : "Print"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {product && (
            <ProductPOHistoryDialog
              productId={product.id}
              productName={product.name}
              open={showPOHistory}
              onOpenChange={setShowPOHistory}
            />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

