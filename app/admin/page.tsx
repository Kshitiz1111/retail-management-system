"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LedgerService } from "@/lib/services/ledgerService";
import { ProductService } from "@/lib/services/productService";
import { VendorService } from "@/lib/services/vendorService";
import { CreditService } from "@/lib/services/creditService";
import { SaleService } from "@/lib/services/saleService";
import { OrderService } from "@/lib/services/orderService";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Link from "next/link";
import {
  DollarSign,
  Package,
  Building2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShoppingCart,
  Users,
  Store,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import { ROLES } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const { hasPermission } = usePermissions();
  const [stats, setStats] = useState({
    todayIncome: 0,
    todayExpense: 0,
    totalProducts: 0,
    totalVendors: 0,
    outstandingCredits: 0,
    lowStockProducts: 0,
    todayPOSSales: 0,
    todayPOSSalesRevenue: 0,
    todayOnlineOrders: 0,
    todayOnlineOrdersRevenue: 0,
    pendingOrders: 0,
    totalTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Today's POS sales
      const todaySales = await SaleService.getSales(startOfDay, endOfDay);
      const posSalesRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);

      // Today's online orders
      const todayOrders = await OrderService.getAllOrders({
        startDate: startOfDay,
        endDate: endOfDay,
      });
      const confirmedOrders = todayOrders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const onlineOrdersRevenue = confirmedOrders.reduce((sum, order) => sum + order.total, 0);


      // Get expenses using updated logic (purchase orders + ledger expenses)
      const [entries, purchaseOrders] = await Promise.all([
        LedgerService.getEntries(startOfDay, endOfDay),
        VendorService.getPurchaseOrdersByDateRange(startOfDay, endOfDay),
      ]);

      // Calculate expenses from actual purchase orders (received)
      const receivedPOs = purchaseOrders.filter((po) => po.status === "RECEIVED");
      const purchaseOrderExpenses = receivedPOs.reduce(
        (sum, po) => sum + (po.receivedTotalAmount ?? po.totalAmount),
        0
      );

      // Get expenses from ledger (excluding auto-generated sales/PO entries, VENDOR_PAY, and credit settlements)
      const manualLedgerEntriesForPL = entries.filter((entry) => {
        // Exclude auto-generated sales entries
        if (entry.category === "SALES" && entry.relatedId) {
          return false;
        }
        // Exclude auto-generated purchase order entries
        // These are created when GRN is processed, but we're using actual PO data for expenses
        if (entry.category === "PURCHASE" && entry.relatedId) {
          return false;
        }
        // Exclude VENDOR_PAY entries (these are just payments, not expenses)
        if (entry.category === "VENDOR_PAY") {
          return false;
        }
        // Exclude credit settlement entries (these are just collections, not income)
        const isCreditSettlement = entry.category === "SALES" &&
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) {
          return false;
        }
        return true;
      });

      const ledgerExpenses = manualLedgerEntriesForPL
        .filter((e) => e.type === "EXPENSE")
        .reduce((sum, e) => sum + e.amount, 0);
      const otherIncome = manualLedgerEntriesForPL
        .filter((e) => e.type === "INCOME" && e.category !== "SALES")
        .reduce((sum, e) => sum + e.amount, 0);

      // Total expenses = purchase order expenses + other ledger expenses
      const totalExpense = purchaseOrderExpenses + ledgerExpenses;

      // Calculate total income from actual sales, orders, and other income
      const totalIncome = posSalesRevenue + onlineOrdersRevenue + otherIncome;

      // Pending orders (all time, but we'll show today's pending)
      const pendingOrders = todayOrders.filter((o) => o.status === "PENDING");

      // Total products
      const products = await ProductService.getAllProducts();
      const activeProducts = products.filter((p) => p.isActive);

      // Low stock products
      const lowStock = activeProducts.filter((product) => {
        const totalStock = Object.values(product.warehouses).reduce(
          (sum, wh) => sum + wh.quantity,
          0
        );
        const minStock = Math.min(
          ...Object.values(product.warehouses).map((wh) => wh.minQuantity || 0)
        );
        return totalStock > 0 && totalStock <= minStock;
      });

      // Total vendors
      const vendors = await VendorService.getAllVendors();
      const activeVendors = vendors.filter((v) => v.isActive);

      // Outstanding credits
      const credits = await CreditService.getAllOutstandingCredits();
      const totalOutstanding = credits.reduce((sum, credit) => sum + credit.dueAmount, 0);

      setStats({
        todayIncome: totalIncome, // Use calculated total from sales + orders
        todayExpense: totalExpense,
        totalProducts: activeProducts.length,
        totalVendors: activeVendors.length,
        outstandingCredits: totalOutstanding,
        lowStockProducts: lowStock.length,
        todayPOSSales: todaySales.length,
        todayPOSSalesRevenue: posSalesRevenue,
        todayOnlineOrders: confirmedOrders.length,
        todayOnlineOrdersRevenue: onlineOrdersRevenue,
        pendingOrders: pendingOrders.length,
        totalTransactions: todaySales.length + todayOrders.length,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const netProfit = stats.todayIncome - stats.todayExpense;

  return (
    <ProtectedRoute requiredRole={ROLES.ADMIN}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back! Here&apos;s an overview of your business.</p>
          </div>

          {loading ? (
            <div className="text-center py-12">Loading dashboard data...</div>
          ) : (
            <>
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today&apos;s Income
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      Rs {stats.todayIncome.toFixed(2)}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-gray-500">
                      <span>POS: Rs {stats.todayPOSSalesRevenue.toFixed(2)}</span>
                      <span>•</span>
                      <span>Online: Rs {stats.todayOnlineOrdersRevenue.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today&apos;s Expenses
                    </CardTitle>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      Rs {stats.todayExpense.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      Rs {netProfit.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                {/* <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Outstanding Credits
                    </CardTitle>
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      Rs {stats.outstandingCredits.toFixed(2)}
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-gray-500">
                      <span>Receivables From Customers</span>
                    </div>
                  </CardContent>
                </Card> */}
              </div>

              {/* Sales & Orders Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today&apos;s POS Sales
                    </CardTitle>
                    <Store className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.todayPOSSales}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Revenue: Rs {stats.todayPOSSalesRevenue.toFixed(2)}
                    </div>
                    {hasPermission("pos", "view") && (
                      <Link href="/pos">
                        <Button variant="link" className="p-0 mt-2 text-xs">
                          Open POS <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Today&apos;s Online Orders
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.todayOnlineOrders}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Revenue: Rs {stats.todayOnlineOrdersRevenue.toFixed(2)}
                    </div>
                    {hasPermission("orders", "view") && (
                      <Link href="/admin/orders">
                        <Button variant="link" className="p-0 mt-2 text-xs">
                          View Orders <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Pending Orders
                    </CardTitle>
                    {stats.pendingOrders > 0 ? (
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <ShoppingBag className="h-4 w-4 text-gray-400" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${stats.pendingOrders > 0 ? "text-yellow-600" : "text-gray-600"}`}>
                      {stats.pendingOrders}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Require attention
                    </div>
                    {stats.pendingOrders > 0 && hasPermission("orders", "view") && (
                      <Link href="/admin/orders?status=PENDING">
                        <Button variant="link" className="p-0 mt-2 text-xs">
                          Review Orders <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Products
                    </CardTitle>
                    <CardDescription>Total active products in inventory</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalProducts}</div>
                    {stats.lowStockProducts > 0 && (
                      <p className="text-sm text-red-600 mt-2">
                        {stats.lowStockProducts} products low in stock
                      </p>
                    )}
                    {hasPermission("inventory", "view") && (
                      <Link href="/admin/inventory/products">
                        <Button variant="link" className="p-0 mt-2">
                          View Products <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Vendors
                    </CardTitle>
                    <CardDescription>Active suppliers and vendors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{stats.totalVendors}</div>
                    {hasPermission("vendors", "view") && (
                      <Link href="/admin/vendors">
                        <Button variant="link" className="p-0 mt-2">
                          View Vendors <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Customer Credits
                    </CardTitle>
                    <CardDescription>Outstanding customer dues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      Rs {stats.outstandingCredits.toFixed(2)}
                    </div>
                    {hasPermission("customers", "viewCredits") && (
                      <Link href="/admin/customers/credits">
                        <Button variant="link" className="p-0 mt-2">
                          View Credits <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {hasPermission("pos", "view") && (
                      <Link href="/pos">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <ShoppingCart className="h-6 w-6 mb-2" />
                          Open POS
                        </Button>
                      </Link>
                    )}
                    {hasPermission("inventory", "create") && (
                      <Link href="/admin/inventory/products/create">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <Package className="h-6 w-6 mb-2" />
                          Add Product
                        </Button>
                      </Link>
                    )}
                    {hasPermission("employees", "create") && (
                      <Link href="/admin/employees/create">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <Users className="h-6 w-6 mb-2" />
                          Add Employee
                        </Button>
                      </Link>
                    )}
                    {hasPermission("finance", "view") && (
                      <Link href="/admin/finance">
                        <Button variant="outline" className="w-full h-20 flex-col">
                          <DollarSign className="h-6 w-6 mb-2" />
                          View Finance
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

