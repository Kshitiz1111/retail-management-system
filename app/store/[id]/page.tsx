"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductService } from "@/lib/services/productService";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const productData = await ProductService.getProduct(productId);
      setProduct(productData);
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    // Add to cart logic (can use localStorage or context)
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find((item: any) => item.productId === productId);

    if (!product) return;

    const totalStock = Object.values(product.warehouses).reduce((sum, wh) => sum + wh.quantity, 0);

    if (totalStock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    // Calculate effective price (with discount)
    const effectivePrice = product.discount && product.discount > 0
      ? product.price * (1 - product.discount / 100)
      : product.price;

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (newQty > totalStock) {
        alert(`Cannot add more than ${totalStock} units. You already have ${existingItem.quantity} in cart.`);
        return;
      }
      existingItem.quantity = newQty;
      existingItem.totalStock = totalStock;
    } else {
      if (quantity > totalStock) {
        alert(`Cannot add more than ${totalStock} units.`);
        return;
      }
      cart.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: effectivePrice,
        originalPrice: product.discount && product.discount > 0 ? product.price : undefined,
        quantity,
        imageUrl: product.imageUrl,
        totalStock,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    alert("Added to cart!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product not found</h1>
          <Link href="/store">
            <Button>Back to Store</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalStock = Object.values(product.warehouses).reduce((sum, wh) => sum + wh.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/store">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Link href="/store/cart">
              <Button variant="outline">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">No Image</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <p className="text-gray-600 mb-4">{product.category}</p>
              {product.discount && product.discount > 0 ? (
                <div className="mb-4">
                  <p className="text-xl text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                  <p className="text-3xl font-bold text-green-600">
                    Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                  </p>
                  <p className="text-sm text-red-600 font-semibold mt-1">-{product.discount.toFixed(0)}% OFF</p>
                </div>
              ) : (
                <p className="text-3xl font-bold text-green-600 mb-4">
                  Rs {product.price.toFixed(2)}
                </p>
              )}
            </div>

            {product.description && (
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <p className="text-gray-700">{product.description}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600 mb-2">
                Stock: <span className={totalStock === 0 ? "text-red-600" : "text-green-600"}>
                  {totalStock === 0 ? "Out of Stock" : `${totalStock} available`}
                </span>
              </p>
            </div>

            {totalStock > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Quantity:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(totalStock, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center"
                      min={1}
                      max={totalStock}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.min(totalStock, quantity + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <Button onClick={handleAddToCart} className="w-full" size="lg">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

