"use client";

import { useEffect, useState, useCallback } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { FinanceReportService } from "@/lib/services/financeReportService";
import { FileText, Download, TrendingUp, TrendingDown } from "lucide-react";

export default function FinanceReportsPage() {
  const [reportType, setReportType] = useState<"pl" | "cashflow" | "balance" | "sales" | "expense">("pl");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      let data;
      switch (reportType) {
        case "pl":
          data = await FinanceReportService.generatePLStatement(start, end);
          break;
        case "cashflow":
          data = await FinanceReportService.generateCashFlow(start, end);
          break;
        case "balance":
          data = await FinanceReportService.generateBalanceSheet();
          break;
        case "sales":
          data = await FinanceReportService.generateSalesReport(start, end);
          break;
        case "expense":
          data = await FinanceReportService.generateExpenseReport(start, end);
          break;
      }
      setReportData(data);
      console.log("Report data generated:", reportType, data);
    } catch (error) {
      console.error("Error generating report:", error);
      alert(`Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.FINANCE, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Financial Reports</h1>
            <p className="text-gray-600 mt-2">Generate comprehensive financial reports and statements</p>
          </div>

          {/* Report Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Report Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pl">P&L Statement</SelectItem>
                      <SelectItem value="cashflow">Cash Flow</SelectItem>
                      <SelectItem value="balance">Balance Sheet</SelectItem>
                      <SelectItem value="sales">Sales Report</SelectItem>
                      <SelectItem value="expense">Expense Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button onClick={generateReport} disabled={loading} className="w-full">
                    {loading ? "Generating..." : "Generate Report"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Display */}
          {loading ? (
            <div className="text-center py-12">
              <p>Generating report...</p>
            </div>
          ) : reportData ? (
            <div className="space-y-6">
              {reportType === "pl" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Total Income</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        Rs {(reportData.income ?? 0).toFixed(2)}
                      </div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Sales:</span>
                          <span>Rs {(reportData.incomeBreakdown?.sales ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Orders:</span>
                          <span>Rs {(reportData.incomeBreakdown?.orders ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Other:</span>
                          <span>Rs {(reportData.incomeBreakdown?.other ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        Rs {(reportData.expenses ?? 0).toFixed(2)}
                      </div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Purchases:</span>
                          <span>Rs {(reportData.expenseBreakdown?.purchases ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vendor Payments:</span>
                          <span>Rs {(reportData.expenseBreakdown?.vendorPayments ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Salaries:</span>
                          <span>Rs {(reportData.expenseBreakdown?.salaries ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rent:</span>
                          <span>Rs {(reportData.expenseBreakdown?.rent ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Utilities:</span>
                          <span>Rs {(reportData.expenseBreakdown?.utilities ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Other:</span>
                          <span>Rs {(reportData.expenseBreakdown?.other ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Net Profit</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${(reportData.netProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Rs {(reportData.netProfit ?? 0).toFixed(2)}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {reportData.netProfit >= 0 ? (
                          <span className="flex items-center text-green-600">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Profit
                          </span>
                        ) : (
                          <span className="flex items-center text-red-600">
                            <TrendingDown className="h-4 w-4 mr-1" />
                            Loss
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {reportType === "cashflow" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cash In</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        Rs {(reportData.cashIn || 0).toFixed(2)}
                      </div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Cash:</span>
                          <span>Rs {(reportData.cashInBreakdown?.cash || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bank Transfer:</span>
                          <span>Rs {(reportData.cashInBreakdown?.bankTransfer || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>FonePay:</span>
                          <span>Rs {(reportData.cashInBreakdown?.fonePay || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cheque:</span>
                          <span>Rs {(reportData.cashInBreakdown?.cheque || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Credit:</span>
                          <span>Rs {(reportData.cashInBreakdown?.credit || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cash Out</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        Rs {(reportData.cashOut || 0).toFixed(2)}
                      </div>
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Cash:</span>
                          <span>Rs {(reportData.cashOutBreakdown?.cash || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bank Transfer:</span>
                          <span>Rs {(reportData.cashOutBreakdown?.bankTransfer || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>FonePay:</span>
                          <span>Rs {(reportData.cashOutBreakdown?.fonePay || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cheque:</span>
                          <span>Rs {(reportData.cashOutBreakdown?.cheque || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Credit:</span>
                          <span>Rs {(reportData.cashOutBreakdown?.credit || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Net Cash Flow</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${(reportData.netCashFlow || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Rs {(reportData.netCashFlow || 0).toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {reportType === "balance" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Assets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Cash:</span>
                          <span>Rs {(reportData.assets?.cash || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Inventory:</span>
                          <span>Rs {(reportData.assets?.inventory || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Receivables:</span>
                          <span>Rs {(reportData.assets?.receivables || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total Assets:</span>
                          <span>Rs {(reportData.assets?.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Liabilities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Payables:</span>
                          <span>Rs {(reportData.liabilities?.payables || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Total Liabilities:</span>
                          <span>Rs {(reportData.liabilities?.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Equity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold ${(reportData.equity || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Rs {(reportData.equity || 0).toFixed(2)}
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Assets - Liabilities
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {reportType === "sales" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Total Sales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                          Rs {(reportData.totalSales || 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Total Orders</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          {reportData.totalOrders}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Average Order Value</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          Rs {(reportData.averageOrderValue || 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.salesByProduct && reportData.salesByProduct.length > 0 ? (
                            reportData.salesByProduct.slice(0, 10).map((item: any) => (
                              <TableRow key={item.productId}>
                                <TableCell>{item.productName || "N/A"}</TableCell>
                                <TableCell className="text-right">{item.quantity || 0}</TableCell>
                                <TableCell className="text-right">Rs {(item.revenue || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-gray-500">
                                No sales data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Customers</CardTitle>
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
                          {reportData.salesByCustomer && reportData.salesByCustomer.length > 0 ? (
                            reportData.salesByCustomer.slice(0, 10).map((item: any) => (
                              <TableRow key={item.customerId}>
                                <TableCell>{item.customerName || "N/A"}</TableCell>
                                <TableCell className="text-right">{item.orderCount || 0}</TableCell>
                                <TableCell className="text-right">Rs {(item.totalSpent || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-gray-500">
                                No customer sales data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {reportType === "expense" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        Rs {(reportData.totalExpenses || 0).toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Expenses by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.expensesByCategory && Object.keys(reportData.expensesByCategory).length > 0 ? (
                            Object.entries(reportData.expensesByCategory).map(([category, amount]: [string, any]) => (
                              <TableRow key={category}>
                                <TableCell>{category}</TableCell>
                                <TableCell className="text-right">Rs {(amount || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-gray-500">
                                No expense data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.topExpenses && reportData.topExpenses.length > 0 ? (
                            reportData.topExpenses.map((expense: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>{expense.description || "N/A"}</TableCell>
                                <TableCell>{expense.category || "N/A"}</TableCell>
                                <TableCell>
                                  {expense.date
                                    ? (expense.date instanceof Date
                                      ? expense.date.toLocaleDateString()
                                      : new Date(expense.date).toLocaleDateString())
                                    : "N/A"}
                                </TableCell>
                                <TableCell className="text-right">Rs {(expense.amount || 0).toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-gray-500">
                                No expense data available
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p>No report data available. Click "Generate Report" to create a report.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

