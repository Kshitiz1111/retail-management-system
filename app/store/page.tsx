"use client";

import { useEffect, useState } from "react";
import { ProductService } from "@/lib/services/productService";
import { Product } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Fuse from "fuse.js";
import { Search, ShoppingCart, User, LogOut } from "lucide-react";
import Link from "next/link";
import { useStoreAuth } from "@/contexts/StoreAuthContext";

export default function StorePage() {
  const { customer, signOut } = useStoreAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const fetchProducts = async () => {
    try {
      setError(null);
      const productList = await ProductService.getAllProducts();
      const activeProducts = productList.filter((p) => p.isActive);
      setProducts(activeProducts);
      setFilteredProducts(activeProducts);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
        setError("Unable to load products. Please check Firestore security rules to allow public read access to products.");
      } else {
        setError("Failed to load products. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/store">
              <h1 className="text-2xl font-bold">RMS</h1>
            </Link>
            <div className="flex items-center gap-2">
              {customer ? (
                <>
                  <Link href="/store/orders">
                    <Button variant="outline" size="sm">
                      <User className="mr-2 h-4 w-4" />
                      My Orders
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/store/login">
                    <Button variant="outline" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/store/signup">
                    <Button size="sm">Sign Up</Button>
                  </Link>
                </>
              )}
              <Link href="/store/cart">
                <Button variant="outline">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Cart
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="container mx-auto px-4 py-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Loading products...</div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-800 font-semibold mb-2">Error Loading Products</p>
              <p className="text-red-600 text-sm">{error}</p>
              <Button onClick={fetchProducts} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? "No products found matching your search." : "No products available."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map((product) => {
              const totalStock = Object.values(product.warehouses).reduce(
                (sum, wh) => sum + wh.quantity,
                0
              );
              return (
                <Link key={product.id} href={`/store/${product.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-4">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-48 object-cover rounded mb-3"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded mb-3 flex items-center justify-center">
                          <span className="text-gray-400">No Image</span>
                        </div>
                      )}
                      <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                      {product.discount && product.discount > 0 ? (
                        <div className="mb-2">
                          <p className="text-sm text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                          <p className="font-bold text-lg text-green-600">
                            Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                          </p>
                          <p className="text-xs text-red-600 font-semibold">-{product.discount.toFixed(0)}% OFF</p>
                        </div>
                      ) : (
                        <p className="font-bold text-lg text-green-600 mb-2">
                          Rs {product.price.toFixed(2)}
                        </p>
                      )}
                      {totalStock === 0 && (
                        <p className="text-xs text-red-600">Out of Stock</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

