"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductService } from "@/lib/services/productService";
import { Product, RESOURCES, ACTIONS } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Fuse from "fuse.js";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

export default function ProductsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productList = await ProductService.getAllProducts();
        setProducts(productList);
        setFilteredProducts(productList);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: ["name", "sku", "category", "description"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    setFilteredProducts(results.map((result) => result.item));
  }, [searchQuery, products]);

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await ProductService.deleteProduct(productId);
      setProducts(products.filter((p) => p.id !== productId));
      setFilteredProducts(filteredProducts.filter((p) => p.id !== productId));
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product");
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.INVENTORY, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="text-gray-600 mt-2">Manage your inventory</p>
          </div>
          {hasPermission("inventory", "create") && (
            <Link href="/admin/inventory/products/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <CardTitle>Product List</CardTitle>
                <CardDescription>All products in your inventory</CardDescription>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? "No products found matching your search." : "No products found. Create your first product to get started."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const totalStock = Object.values(product.warehouses).reduce(
                        (sum, wh) => sum + wh.quantity,
                        0
                      );
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-12 w-12 object-cover rounded"
                              />
                            ) : (
                              <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No Image</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>
                            {product.discount && product.discount > 0 ? (
                              <div>
                                <p className="text-xs text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                                <p className="font-semibold text-green-600">
                                  Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                                </p>
                                <p className="text-xs text-red-600">-{product.discount.toFixed(0)}%</p>
                              </div>
                            ) : (
                              <span>Rs {product.price.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={totalStock === 0 ? "text-red-600" : ""}>
                              {totalStock}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin/inventory/products/${product.id}`)}
                              >
                                View
                              </Button>
                              {hasPermission("inventory", "delete") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(product.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AdminLayout>
    </ProtectedRoute>
  );
}

