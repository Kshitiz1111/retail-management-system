// Finance Analytics Service - Financial analytics and insights
import { LedgerService } from "./ledgerService";
import { SaleService } from "./saleService";
import { OrderService } from "./orderService";
import { VendorService } from "./vendorService";
import { ProductService } from "./productService";
import { CustomerService } from "./customerService";

export interface ProfitMargins {
  grossMargin: number; // (Revenue - COGS) / Revenue
  netMargin: number; // Net Profit / Revenue
  grossProfit: number;
  netProfit: number;
  revenue: number;
}

export interface RevenueTrend {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  profit?: number;
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  totalSpent: number;
  orderCount: number;
}

export interface PeriodComparison {
  current: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  previous: {
    revenue: number;
    expenses: number;
    profit: number;
  };
  change: {
    revenue: number; // percentage
    expenses: number; // percentage
    profit: number; // percentage
  };
}

export class FinanceAnalyticsService {
  /**
   * Calculate profit margins
   */
  static async calculateProfitMargins(
    startDate: Date,
    endDate: Date
  ): Promise<ProfitMargins> {
    try {
      // Get revenue from sales and orders
      const sales = await SaleService.getSales(startDate, endDate);
      const salesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const ordersRevenue = confirmedOrCompletedOrders.reduce(
        (sum, order) => sum + order.total,
        0
      );

      const revenue = salesRevenue + ordersRevenue;

      // Get purchase orders and ledger entries
      const [entries, purchaseOrders] = await Promise.all([
        LedgerService.getEntries(startDate, endDate),
        VendorService.getPurchaseOrdersByDateRange(startDate, endDate),
      ]);

      // Calculate expenses from actual purchase orders (received)
      const receivedPOs = purchaseOrders.filter((po) => po.status === "RECEIVED");
      const purchaseOrderExpenses = receivedPOs.reduce(
        (sum, po) => sum + (po.receivedTotalAmount ?? po.totalAmount),
        0
      );

      // Filter ledger entries (excluding auto-generated entries, VENDOR_PAY, and credit settlements)
      const validExpenseEntries = entries.filter((entry) => {
        // Exclude auto-generated sales entries
        if (entry.category === "SALES" && entry.relatedId) {
          return false;
        }
        // Exclude auto-generated purchase order entries
        if (entry.category === "PURCHASE" && entry.relatedId) {
          return false;
        }
        // Exclude VENDOR_PAY entries (these are just payments, not expenses)
        if (entry.category === "VENDOR_PAY") {
          return false;
        }
        // Exclude credit settlement entries
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) {
          return false;
        }
        return entry.type === "EXPENSE";
      });

      const ledgerExpenses = validExpenseEntries.reduce(
        (sum, entry) => sum + entry.amount,
        0
      );

      // Total expenses = purchase order expenses + ledger expenses
      const expenses = purchaseOrderExpenses + ledgerExpenses;

      // Estimate COGS (Cost of Goods Sold) - would need product cost prices
      // For now, estimate as 60% of revenue (typical retail margin)
      const cogs = revenue * 0.6;
      const grossProfit = revenue - cogs;
      const netProfit = revenue - expenses;

      return {
        grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
        netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        grossProfit,
        netProfit,
        revenue,
      };
    } catch (error) {
      console.error("Error calculating profit margins:", error);
      throw error;
    }
  }

  /**
   * Get revenue trends (daily, weekly, monthly)
   */
  static async getRevenueTrends(
    startDate: Date,
    endDate: Date,
    period: "daily" | "weekly" | "monthly" = "daily"
  ): Promise<RevenueTrend[]> {
    try {
      const sales = await SaleService.getSales(startDate, endDate);
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );

      // Get purchase orders and ledger entries
      const [entries, purchaseOrders] = await Promise.all([
        LedgerService.getEntries(startDate, endDate),
        VendorService.getPurchaseOrdersByDateRange(startDate, endDate),
      ]);
      const receivedPOs = purchaseOrders.filter((po) => po.status === "RECEIVED");

      // Filter ledger entries (excluding auto-generated entries, VENDOR_PAY, and credit settlements)
      const validEntries = entries.filter((entry) => {
        // Exclude auto-generated sales entries
        if (entry.category === "SALES" && entry.relatedId) {
          return false;
        }
        // Exclude auto-generated purchase order entries
        if (entry.category === "PURCHASE" && entry.relatedId) {
          return false;
        }
        // Exclude VENDOR_PAY entries (these are just payments, not expenses)
        if (entry.category === "VENDOR_PAY") {
          return false;
        }
        // Exclude credit settlement entries
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) {
          return false;
        }
        return true;
      });

      // Group by period
      const trendMap = new Map<string, { revenue: number; expenses: number }>();

      // Process sales
      sales.forEach((sale) => {
        const dateKey = this.getDateKey(sale.createdAt.toDate(), period);
        const existing = trendMap.get(dateKey) || { revenue: 0, expenses: 0 };
        existing.revenue += sale.total;
        trendMap.set(dateKey, existing);
      });

      // Process orders
      confirmedOrCompletedOrders.forEach((order) => {
        const dateKey = this.getDateKey(order.createdAt.toDate(), period);
        const existing = trendMap.get(dateKey) || { revenue: 0, expenses: 0 };
        existing.revenue += order.total;
        trendMap.set(dateKey, existing);
      });

      // Process purchase order expenses
      receivedPOs.forEach((po) => {
        const dateKey = this.getDateKey(po.createdAt.toDate(), period);
        const existing = trendMap.get(dateKey) || { revenue: 0, expenses: 0 };
        existing.expenses += po.receivedTotalAmount ?? po.totalAmount;
        trendMap.set(dateKey, existing);
      });

      // Process ledger expenses
      validEntries
        .filter((e) => e.type === "EXPENSE")
        .forEach((entry) => {
          const dateKey = this.getDateKey(entry.date.toDate(), period);
          const existing = trendMap.get(dateKey) || { revenue: 0, expenses: 0 };
          existing.expenses += entry.amount;
          trendMap.set(dateKey, existing);
        });

      // Convert to array and sort
      const trends: RevenueTrend[] = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return trends;
    } catch (error) {
      console.error("Error getting revenue trends:", error);
      throw error;
    }
  }

  /**
   * Get top selling products
   */
  static async getTopProducts(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<TopProduct[]> {
    try {
      const sales = await SaleService.getSales(startDate, endDate);
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrders = orders.filter((o) => o.status === "CONFIRMED");

      const productMap = new Map<
        string,
        { name: string; quantity: number; revenue: number }
      >();

      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const existing = productMap.get(item.productId) || {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          productMap.set(item.productId, existing);
        });
      });

      confirmedOrders.forEach((order) => {
        order.items.forEach((item) => {
          const existing = productMap.get(item.productId) || {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += item.quantity;
          existing.revenue += item.subtotal;
          productMap.set(item.productId, existing);
        });
      });

      return Array.from(productMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          quantitySold: data.quantity,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    } catch (error) {
      console.error("Error getting top products:", error);
      throw error;
    }
  }

  /**
   * Get top customers
   */
  static async getTopCustomers(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<TopCustomer[]> {
    try {
      const sales = await SaleService.getSales(startDate, endDate);
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrders = orders.filter((o) => o.status === "CONFIRMED");

      const customerMap = new Map<
        string,
        { name: string; totalSpent: number; orderCount: number }
      >();

      sales.forEach((sale) => {
        if (sale.customerId) {
          const existing = customerMap.get(sale.customerId) || {
            name: "Unknown",
            totalSpent: 0,
            orderCount: 0,
          };
          existing.totalSpent += sale.total;
          existing.orderCount += 1;
          customerMap.set(sale.customerId, existing);
        }
      });

      confirmedOrders.forEach((order) => {
        if (order.customerId) {
          const existing = customerMap.get(order.customerId) || {
            name: order.customerInfo.name,
            totalSpent: 0,
            orderCount: 0,
          };
          existing.totalSpent += order.total;
          existing.orderCount += 1;
          customerMap.set(order.customerId, existing);
        }
      });

      return Array.from(customerMap.entries())
        .map(([customerId, data]) => ({
          customerId,
          customerName: data.name,
          totalSpent: data.totalSpent,
          orderCount: data.orderCount,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, limit);
    } catch (error) {
      console.error("Error getting top customers:", error);
      throw error;
    }
  }

  /**
   * Compare two periods
   */
  static async comparePeriods(
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date
  ): Promise<PeriodComparison> {
    try {
      // Current period
      const currentSales = await SaleService.getSales(currentStart, currentEnd);
      const currentOrders = await OrderService.getAllOrders({
        startDate: currentStart,
        endDate: currentEnd,
      });
      const currentConfirmedOrCompletedOrders = currentOrders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const currentRevenue =
        currentSales.reduce((sum, s) => sum + s.total, 0) +
        currentConfirmedOrCompletedOrders.reduce((sum, o) => sum + o.total, 0);
      
      // Get current period purchase orders and ledger entries
      const [currentEntries, currentPOs] = await Promise.all([
        LedgerService.getEntries(currentStart, currentEnd),
        VendorService.getPurchaseOrdersByDateRange(currentStart, currentEnd),
      ]);
      
      // Calculate current expenses
      const currentReceivedPOs = currentPOs.filter((po) => po.status === "RECEIVED");
      const currentPOExpenses = currentReceivedPOs.reduce(
        (sum, po) => sum + (po.receivedTotalAmount ?? po.totalAmount),
        0
      );
      
      const currentValidEntries = currentEntries.filter((entry) => {
        if (entry.category === "SALES" && entry.relatedId) return false;
        if (entry.category === "PURCHASE" && entry.relatedId) return false;
        if (entry.category === "VENDOR_PAY") return false;
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) return false;
        return entry.type === "EXPENSE";
      });
      
      const currentLedgerExpenses = currentValidEntries.reduce(
        (sum, e) => sum + e.amount,
        0
      );
      const currentExpenses = currentPOExpenses + currentLedgerExpenses;
      const currentProfit = currentRevenue - currentExpenses;

      // Previous period
      const previousSales = await SaleService.getSales(
        previousStart,
        previousEnd
      );
      const previousOrders = await OrderService.getAllOrders({
        startDate: previousStart,
        endDate: previousEnd,
      });
      const previousConfirmedOrCompletedOrders = previousOrders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const previousRevenue =
        previousSales.reduce((sum, s) => sum + s.total, 0) +
        previousConfirmedOrCompletedOrders.reduce((sum, o) => sum + o.total, 0);
      
      // Get previous period purchase orders and ledger entries
      const [previousEntries, previousPOs] = await Promise.all([
        LedgerService.getEntries(previousStart, previousEnd),
        VendorService.getPurchaseOrdersByDateRange(previousStart, previousEnd),
      ]);
      
      // Calculate previous expenses
      const previousReceivedPOs = previousPOs.filter((po) => po.status === "RECEIVED");
      const previousPOExpenses = previousReceivedPOs.reduce(
        (sum, po) => sum + (po.receivedTotalAmount ?? po.totalAmount),
        0
      );
      
      const previousValidEntries = previousEntries.filter((entry) => {
        if (entry.category === "SALES" && entry.relatedId) return false;
        if (entry.category === "PURCHASE" && entry.relatedId) return false;
        if (entry.category === "VENDOR_PAY") return false;
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) return false;
        return entry.type === "EXPENSE";
      });
      
      const previousLedgerExpenses = previousValidEntries.reduce(
        (sum, e) => sum + e.amount,
        0
      );
      const previousExpenses = previousPOExpenses + previousLedgerExpenses;
      const previousProfit = previousRevenue - previousExpenses;

      return {
        current: {
          revenue: currentRevenue,
          expenses: currentExpenses,
          profit: currentProfit,
        },
        previous: {
          revenue: previousRevenue,
          expenses: previousExpenses,
          profit: previousProfit,
        },
        change: {
          revenue:
            previousRevenue > 0
              ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
              : 0,
          expenses:
            previousExpenses > 0
              ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
              : 0,
          profit:
            previousProfit !== 0
              ? ((currentProfit - previousProfit) / Math.abs(previousProfit)) *
                100
              : 0,
        },
      };
    } catch (error) {
      console.error("Error comparing periods:", error);
      throw error;
    }
  }

  /**
   * Helper to get date key for grouping
   */
  private static getDateKey(
    date: Date,
    period: "daily" | "weekly" | "monthly"
  ): string {
    if (period === "daily") {
      return date.toISOString().split("T")[0];
    } else if (period === "weekly") {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split("T")[0];
    } else {
      // monthly
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }
  }
}

