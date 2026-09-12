"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaleService } from "@/lib/services/saleService";
import { ProductService } from "@/lib/services/productService";
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner";
import { Product, SaleItem, Customer, PaymentMethod, EmployeePermissions } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Fuse from "fuse.js";
import { Search, ShoppingCart, User, Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Cart } from "@/components/pos/Cart";
import { navItems } from "@/components/admin/AdminLayout";

export default function POSPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, refreshUser } = useAuth();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [discountInputValue, setDiscountInputValue] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
    // Refresh user data to get latest permissions
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: ["name", "sku", "category"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    setFilteredProducts(results.map((result) => result.item));
  }, [searchQuery, products]);

  // Always sync advance payment with total when cart, customer, or discount changes
  useEffect(() => {
    if (selectedCustomer && cart.length > 0) {
      const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const calculatedDiscount = discountType === "percentage"
        ? subtotal * (discountAmount / 100)
        : discountAmount;
      const total = subtotal - calculatedDiscount;

      setAdvancePayment(total);
    }
  }, [cart, selectedCustomer, discountAmount, discountType]);

  // Barcode scanner integration
  useBarcodeScanner({
    onScan: (barcode) => {
      const product = products.find((p) => p.sku === barcode);
      if (product) {
        addToCart(product);
      }
    },
    enabled: true,
  });

  // Keyboard shortcuts for faster POS operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: Complete sale
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (cart.length > 0 && !processing) {
          e.preventDefault();
          handleCheckout();
        }
      }
      // Escape: Close dialogs or clear search
      if (e.key === "Escape") {
        if (discountDialogOpen) {
          setDiscountDialogOpen(false);
        } else if (cartOpen) {
          setCartOpen(false);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        } else if (searchQuery) {
          setSearchQuery("");
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.length, processing, discountDialogOpen, cartOpen, sidebarOpen, searchQuery]);

  const fetchProducts = async () => {
    try {
      const productList = await ProductService.getAllProducts();
      const activeProducts = productList.filter((p) => p.isActive);
      setProducts(activeProducts);
      setFilteredProducts(activeProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customerList: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customerList.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customerList);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const addToCart = (product: Product) => {
    const totalStock = Object.values(product.warehouses).reduce(
      (sum, wh) => sum + wh.quantity,
      0
    );

    if (totalStock <= 0) {
      alert("This product is out of stock and cannot be added to the cart.");
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= totalStock) {
        alert(`Cannot add more. Only ${totalStock} unit(s) available in stock.`);
        return;
      }
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
            : item
        )
      );
    } else {
      const effectivePrice = product.discount && product.discount > 0
        ? product.price * (1 - product.discount / 100)
        : product.price;

      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: effectivePrice,
          discount: product.discount || 0,
          subtotal: effectivePrice,
        },
      ]);
    }
  };

  const updateCartItem = (productId: string, updates: Partial<SaleItem>) => {
    setCart(
      cart.map((item) =>
        item.productId === productId
          ? {
            ...item,
            ...updates,
            subtotal: (updates.quantity || item.quantity) * (updates.unitPrice || item.unitPrice) - (updates.discount || item.discount || 0),
          }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = discountType === "percentage"
      ? subtotal * (discountAmount / 100)
      : discountAmount;
    const finalDiscount = Math.min(discount, subtotal); // Ensure discount doesn't exceed subtotal
    const total = Math.max(0, subtotal - finalDiscount);

    // For walk-in customers, they must pay full amount
    // For selected customers, use advance payment
    const paidAmount = selectedCustomer
      ? Math.min(advancePayment, total) // Advance payment cannot exceed total
      : total; // Walk-in must pay full amount

    const creditAmount = selectedCustomer ? Math.max(0, total - paidAmount) : 0;

    return { subtotal, discount: finalDiscount, total, paidAmount, creditAmount };
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    const { total, paidAmount, creditAmount } = calculateTotals();

    // Validation: For walk-in customers, they must pay full amount
    if (!selectedCustomer && paidAmount < total) {
      alert("Walk-in customers must pay the full amount. Please select a customer if you want to allow credit.");
      return;
    }

    // Validation: For selected customers, advance payment must be valid
    if (selectedCustomer && advancePayment < 0) {
      alert("Advance payment cannot be negative.");
      return;
    }

    if (selectedCustomer && advancePayment > total) {
      alert("Advance payment cannot exceed the total amount.");
      return;
    }

    setProcessing(true);

    try {
      // Final stock validation before completing sale
      for (const item of cart) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const totalStock = Object.values(product.warehouses).reduce(
            (sum, wh) => sum + wh.quantity,
            0
          );
          if (item.quantity > totalStock) {
            setProcessing(false);
            alert(`Insufficient stock for "${item.productName}". Available: ${totalStock}, In cart: ${item.quantity}. Please adjust the quantity.`);
            return;
          }
        }
      }
      await SaleService.createSale(
        {
          items: cart,
          subtotal: calculateTotals().subtotal,
          discount: calculateTotals().discount,
          total,
          paidAmount,
          dueAmount: creditAmount,
          paymentMethod,
          isCredit: creditAmount > 0,
          performedBy: user.uid,
          source: "POS", // Tag as POS sale
        },
        selectedCustomer?.id
      );

      // Reset cart and form immediately
      setCart([]);
      setAdvancePayment(0);
      setDiscountAmount(0);
      setDiscountType("percentage");
      setDiscountInputValue("");

      // Refresh product list to show updated stock without page reload
      await fetchProducts();

      // Auto-focus search input after successful checkout
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      alert("Sale completed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete sale";
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const { subtotal, discount, total, paidAmount, creditAmount } = calculateTotals();

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.POS, action: ACTIONS.CREATE }}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b p-2 md:p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
              {/* Sidebar Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-10 w-10 md:h-9 md:w-9"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg md:text-2xl font-bold">Point of Sale</h1>
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto">
              <Select value={selectedCustomer?.id || "walk-in"} onValueChange={(value) => {
                if (value === "walk-in") {
                  setSelectedCustomer(null);
                  setAdvancePayment(0); // Reset advance payment for walk-in
                } else {
                  const customer = customers.find((c) => c.id === value);
                  setSelectedCustomer(customer || null);
                  // Set default advance payment to total when customer is selected
                  const { total } = calculateTotals();
                  setAdvancePayment(total);
                }
              }}>
                <SelectTrigger className="w-full md:w-64 h-12 md:h-10">
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/customers/create")}
                className="w-full md:w-auto h-12 md:h-10"
              >
                <User className="mr-2 h-4 w-4" />
                New Customer
              </Button>
            </div>
          </div>
        </header>

        {/* Sidebar Sheet — reuses AdminLayout navItems for consistency */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full">
              {/* Logo/Header */}
              <div className="p-6 border-b">
                <h1 className="text-xl font-bold">RMS</h1>
                <p className="text-sm text-gray-500">ERP & POS System</p>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navItems
                  .filter((item) => {
                    if (!item.permission) return true;
                    const resource = item.permission.resource as keyof EmployeePermissions["resources"];
                    const action = item.permission.action as "view" | "create" | "update" | "delete" | "viewCredits" | "settleCredits";
                    return hasPermission(resource, action);
                  })
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
              </nav>

              {/* User Info & Logout */}
              <div className="p-4 border-t space-y-2">
                {user && (
                  <div className="px-4 py-2 text-sm">
                    <p className="font-medium">{user.displayName || user.email}</p>
                    <p className="text-gray-500 text-xs capitalize">{user.role}</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    await signOut();
                    router.push("/login");
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-gray-50">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search products or scan barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 md:h-10"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && filteredProducts.length > 0) {
                        addToCart(filteredProducts[0]);
                        setSearchQuery("");
                      }
                      if (e.key === "Escape") {
                        setSearchQuery("");
                      }
                    }}
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">Loading products...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1 md:gap-2">
                  {filteredProducts
                    .filter((product) => {
                      const totalStock = Object.values(product.warehouses).reduce(
                        (sum, wh) => sum + wh.quantity,
                        0
                      );
                      return totalStock > 0;
                    })
                    .map((product) => {
                      const totalStock = Object.values(product.warehouses).reduce(
                        (sum, wh) => sum + wh.quantity,
                        0
                      );
                      return (
                        <Card
                          key={product.id}
                          className="cursor-pointer hover:shadow-lg active:scale-95 transition-all min-h-[100px] md:min-h-[130px]"
                          onClick={() => addToCart(product)}
                        >
                          <CardContent className="p-2 md:p-4">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-20 md:h-28 object-cover rounded mb-1.5"
                              />
                            ) : (
                              <div className="w-full h-20 md:h-28 bg-gray-200 rounded mb-1.5 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No Image</span>
                              </div>
                            )}
                            <h3 className="font-semibold text-xs md:text-sm mb-1 line-clamp-2">{product.name}</h3>
                            <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                            {product.discount && product.discount > 0 ? (
                              <div>
                                <p className="text-xs text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                                <p className="font-bold text-green-600 text-xs md:text-sm">
                                  Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                                </p>
                                <p className="text-xs text-red-600 font-semibold">-{product.discount.toFixed(0)}%</p>
                              </div>
                            ) : (
                              <p className="font-bold text-green-600 text-xs md:text-sm">Rs {product.price.toFixed(2)}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Stock: {totalStock}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}

                  {/* Out of Stock Section */}
                  {filteredProducts.some((product) => {
                    const totalStock = Object.values(product.warehouses).reduce(
                      (sum, wh) => sum + wh.quantity,
                      0
                    );
                    return totalStock === 0;
                  }) && (
                      <div className="col-span-full">
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 py-2">
                            Out of Stock Items ({filteredProducts.filter((p) => Object.values(p.warehouses).reduce((s, w) => s + w.quantity, 0) === 0).length})
                          </summary>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4 mt-2">
                            {filteredProducts
                              .filter((product) => Object.values(product.warehouses).reduce((s, w) => s + w.quantity, 0) === 0)
                              .map((product) => (
                                <Card
                                  key={product.id}
                                  className="opacity-50 cursor-not-allowed min-h-[120px] md:min-h-[150px] relative"
                                >
                                  <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold z-10">
                                    Out of Stock
                                  </div>
                                  <CardContent className="p-2 md:p-4">
                                    {product.imageUrl ? (
                                      <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        className="w-full h-24 md:h-32 object-cover rounded mb-2 grayscale"
                                      />
                                    ) : (
                                      <div className="w-full h-24 md:h-32 bg-gray-200 rounded mb-2 flex items-center justify-center">
                                        <span className="text-gray-400 text-xs">No Image</span>
                                      </div>
                                    )}
                                    <h3 className="font-semibold text-xs md:text-sm mb-1 line-clamp-2">{product.name}</h3>
                                    <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                                    <p className="font-bold text-gray-400 text-xs md:text-sm">Rs {product.price.toFixed(2)}</p>
                                    <p className="text-xs text-red-600 font-semibold">Out of Stock</p>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </details>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Cart Sidebar - Desktop Only */}
            <div className="hidden md:flex w-80 bg-white border-l flex-col">
              <Card className="flex flex-col h-full">
                <Cart
                  cart={cart}
                  subtotal={subtotal}
                  discount={discount}
                  total={total}
                  paidAmount={paidAmount}
                  creditAmount={creditAmount}
                  selectedCustomer={selectedCustomer}
                  advancePayment={advancePayment}
                  paymentMethod={paymentMethod}
                  processing={processing}
                  hasPermission={(resource, action) => {
                    // Type-safe wrapper for hasPermission
                    const validResources = ["inventory", "finance", "customers", "employees", "vendors", "pos", "reports", "orders", "hr", "settings"] as const;
                    const validActions = ["view", "create", "update", "delete", "viewCredits", "settleCredits", "applyDiscount"] as const;
                    if (validResources.includes(resource as typeof validResources[number]) &&
                      validActions.includes(action as typeof validActions[number])) {
                      return hasPermission(resource as typeof validResources[number], action as typeof validActions[number]);
                    }
                    return false;
                  }}
                  onUpdateItem={updateCartItem}
                  onRemoveItem={removeFromCart}
                  onClearCart={() => {
                    setCart([]);
                    setDiscountAmount(0);
                    setAdvancePayment(0);
                  }}
                  onAdvancePaymentChange={(value) => setAdvancePayment(value)}
                  onPaymentMethodChange={setPaymentMethod}
                  onApplyDiscount={() => {
                    setDiscountInputValue(discountAmount > 0 ? discountAmount.toString() : "");
                    setDiscountDialogOpen(true);
                  }}
                  onRemoveDiscount={() => {
                    setDiscountAmount(0);
                    setDiscountInputValue("");
                  }}
                  onCheckout={handleCheckout}
                  variant="desktop"
                />
              </Card>
            </div>
          </div>
        </div>

        {/* Discount Dialog */}
        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply Discount</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={discountType === "percentage" ? "default" : "outline"}
                    onClick={() => {
                      setDiscountType("percentage");
                      setDiscountInputValue(""); // Clear input when switching type
                      setDiscountAmount(0); // Clear applied discount when switching type
                    }}
                    className="flex-1"
                  >
                    Percentage (%)
                  </Button>
                  <Button
                    type="button"
                    variant={discountType === "amount" ? "default" : "outline"}
                    onClick={() => {
                      setDiscountType("amount");
                      setDiscountInputValue(""); // Clear input when switching type
                      setDiscountAmount(0); // Clear applied discount when switching type
                    }}
                    className="flex-1"
                  >
                    Amount (Rs)
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-value">
                  {discountType === "percentage" ? "Discount Percentage" : "Discount Amount (Rs)"}
                </Label>
                <Input
                  id="discount-value"
                  type="number"
                  inputMode="decimal"
                  value={discountInputValue}
                  onChange={(e) => setDiscountInputValue(e.target.value)}
                  placeholder={discountType === "percentage" ? "Enter percentage (e.g., 10)" : "Enter amount (e.g., 50)"}
                  min={0}
                  max={discountType === "percentage" ? 100 : undefined}
                  step={discountType === "percentage" ? 0.01 : 0.01}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const value = parseFloat(discountInputValue) || 0;
                      if (discountType === "percentage") {
                        setDiscountAmount(Math.min(100, Math.max(0, value)));
                      } else {
                        const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
                        setDiscountAmount(Math.min(subtotal, Math.max(0, value)));
                      }
                      setDiscountDialogOpen(false);
                    }
                  }}
                  autoFocus
                />
                {discountType === "percentage" && discountInputValue && (
                  <p className="text-xs text-gray-500">
                    Discount: Rs {((cart.reduce((sum, item) => sum + item.subtotal, 0) * (parseFloat(discountInputValue) || 0)) / 100).toFixed(2)}
                  </p>
                )}
                {discountType === "amount" && discountInputValue && (
                  <p className="text-xs text-gray-500">
                    Max discount: Rs {cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDiscountDialogOpen(false);
                  setDiscountInputValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const value = parseFloat(discountInputValue) || 0;
                  if (discountType === "percentage") {
                    setDiscountAmount(Math.min(100, Math.max(0, value)));
                  } else {
                    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
                    setDiscountAmount(Math.min(subtotal, Math.max(0, value)));
                  }
                  setDiscountDialogOpen(false);
                  setDiscountInputValue("");
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Floating Cart Button - Mobile Only */}
        {cart.length > 0 && (
          <Button
            onClick={() => setCartOpen(true)}
            className="fixed bottom-4 right-4 md:hidden z-50 h-auto rounded-full shadow-lg px-4 py-3 gap-2"
            size="lg"
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {cart.length}
              </span>
            </div>
            <span className="text-sm font-semibold">Rs {total.toFixed(0)}</span>
          </Button>
        )}

        {/* Bottom Sheet Cart - Mobile Only */}
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
            <div className="flex flex-col h-full">
              <Cart
                cart={cart}
                subtotal={subtotal}
                discount={discount}
                total={total}
                paidAmount={paidAmount}
                creditAmount={creditAmount}
                selectedCustomer={selectedCustomer}
                advancePayment={advancePayment}
                paymentMethod={paymentMethod}
                processing={processing}
                hasPermission={(resource, action) => {
                  // Type-safe wrapper for hasPermission
                  const validResources = ["inventory", "finance", "customers", "employees", "vendors", "pos", "reports", "orders", "hr", "settings"] as const;
                  const validActions = ["view", "create", "update", "delete", "viewCredits", "settleCredits", "applyDiscount"] as const;
                  if (validResources.includes(resource as typeof validResources[number]) &&
                    validActions.includes(action as typeof validActions[number])) {
                    return hasPermission(resource as typeof validResources[number], action as typeof validActions[number]);
                  }
                  return false;
                }}
                onUpdateItem={updateCartItem}
                onRemoveItem={removeFromCart}
                onClearCart={() => {
                  setCart([]);
                  setDiscountAmount(0);
                  setAdvancePayment(0);
                }}
                onAdvancePaymentChange={(value) => setAdvancePayment(value)}
                onPaymentMethodChange={setPaymentMethod}
                onApplyDiscount={() => {
                  setDiscountInputValue(discountAmount > 0 ? discountAmount.toString() : "");
                  setDiscountDialogOpen(true);
                }}
                onRemoveDiscount={() => {
                  setDiscountAmount(0);
                  setDiscountInputValue("");
                }}
                onCheckout={() => {
                  handleCheckout();
                  setCartOpen(false);
                }}
                variant="mobile"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </ProtectedRoute>
  );
}

