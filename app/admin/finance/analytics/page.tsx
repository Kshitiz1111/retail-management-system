"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinanceAnalyticsService } from "@/lib/services/financeAnalyticsService";
import { TrendingUp, TrendingDown, Package, Users } from "lucide-react";

export default function FinanceAnalyticsPage() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(true);
  const [margins, setMargins] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Calculate previous period for comparison
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const previousEnd = new Date(start);
      previousEnd.setDate(previousEnd.getDate() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - daysDiff);

      const [
        marginsData,
        trendsData,
        topProductsData,
        topCustomersData,
        comparisonData,
      ] = await Promise.all([
        FinanceAnalyticsService.calculateProfitMargins(start, end),
        FinanceAnalyticsService.getRevenueTrends(start, end, period),
        FinanceAnalyticsService.getTopProducts(start, end, 10),
        FinanceAnalyticsService.getTopCustomers(start, end, 10),
        FinanceAnalyticsService.comparePeriods(start, end, previousStart, previousEnd),
      ]);

      setMargins(marginsData);
      setTrends(trendsData);
      setTopProducts(topProductsData);
      setTopCustomers(topCustomersData);
      setComparison(comparisonData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.FINANCE, action: ACTIONS.VIEW }}>
        <AdminLayout>
          <div className="text-center py-12">Loading analytics...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.FINANCE, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Financial Analytics</h1>
            <p className="text-gray-600 mt-2">Insights and trends for your business</p>
          </div>

          {/* Period Selection */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Period Type</label>
                  <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchAnalytics}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profit Margins */}
          {margins && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Gross Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {margins.grossMargin.toFixed(2)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Gross Profit: Rs {margins.grossProfit.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Net Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${margins.netMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {margins.netMargin.toFixed(2)}%
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Net Profit: Rs {margins.netProfit.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    Rs {margins.revenue.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Gross Profit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    Rs {margins.grossProfit.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Period Comparison */}
          {comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Period Comparison</CardTitle>
                <CardDescription>Current vs Previous Period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Revenue</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">
                        Rs {comparison.current.revenue.toFixed(2)}
                      </span>
                      {comparison.change.revenue !== 0 && (
                        <span
                          className={`text-sm flex items-center ${comparison.change.revenue >= 0
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                        >
                          {comparison.change.revenue >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {Math.abs(comparison.change.revenue).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Previous: Rs {comparison.previous.revenue.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Expenses</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">
                        Rs {comparison.current.expenses.toFixed(2)}
                      </span>
                      {comparison.change.expenses !== 0 && (
                        <span
                          className={`text-sm flex items-center ${comparison.change.expenses <= 0
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                        >
                          {comparison.change.expenses <= 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {Math.abs(comparison.change.expenses).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Previous: Rs {comparison.previous.expenses.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Profit</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xl font-bold ${comparison.current.profit >= 0
                          ? "text-green-600"
                          : "text-red-600"
                          }`}
                      >
                        Rs {comparison.current.profit.toFixed(2)}
                      </span>
                      {comparison.change.profit !== 0 && (
                        <span
                          className={`text-sm flex items-center ${comparison.change.profit >= 0
                            ? "text-green-600"
                            : "text-red-600"
                            }`}
                        >
                          {comparison.change.profit >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {Math.abs(comparison.change.profit).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Previous: Rs {comparison.previous.profit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Top Selling Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Quantity Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((product) => (
                      <TableRow key={product.productId}>
                        <TableCell>{product.productName}</TableCell>
                        <TableCell className="text-right">{product.quantitySold}</TableCell>
                        <TableCell className="text-right">
                          Rs {product.revenue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top Customers */}
          {topCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((customer) => (
                      <TableRow key={customer.customerId}>
                        <TableCell>{customer.customerName}</TableCell>
                        <TableCell className="text-right">{customer.orderCount}</TableCell>
                        <TableCell className="text-right">
                          Rs {customer.totalSpent.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Revenue Trends */}
          {trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>{period.charAt(0).toUpperCase() + period.slice(1)} revenue and expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border-b">
                      <span className="text-sm font-medium">{trend.date}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Revenue</p>
                          <p className="text-sm font-semibold text-green-600">
                            Rs {trend.revenue.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Expenses</p>
                          <p className="text-sm font-semibold text-red-600">
                            Rs {trend.expenses.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Profit</p>
                          <p
                            className={`text-sm font-semibold ${trend.profit >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                          >
                            Rs {trend.profit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

