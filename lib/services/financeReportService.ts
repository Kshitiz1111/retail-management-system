// Finance Report Service - Generate comprehensive financial reports
import { LedgerService } from "./ledgerService";
import { SaleService } from "./saleService";
import { OrderService } from "./orderService";
import { VendorService } from "./vendorService";
import { CreditService } from "./creditService";
// Types are imported as needed in the code

export interface PLStatement {
  income: number;
  expenses: number;
  netProfit: number;
  incomeBreakdown: {
    sales: number;
    orders: number;
    other: number;
  };
  expenseBreakdown: {
    purchases: number;
    vendorPayments: number;
    salaries: number;
    rent: number;
    utilities: number;
    other: number;
  };
}

export interface CashFlow {
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  cashInBreakdown: {
    cash: number;
    bankTransfer: number;
    fonePay: number;
    cheque: number;
    credit: number;
  };
  cashOutBreakdown: {
    cash: number;
    bankTransfer: number;
    fonePay: number;
    cheque: number;
    credit: number;
  };
}

export interface BalanceSheet {
  assets: {
    cash: number;
    inventory: number;
    receivables: number; // Customer credits
    total: number;
  };
  liabilities: {
    payables: number; // Vendor balances
    total: number;
  };
  equity: number; // Assets - Liabilities
}

export interface SalesReport {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  salesByProduct: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  salesByCategory: Record<string, number>;
  salesByCustomer: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    orderCount: number;
  }>;
}

export interface ExpenseReport {
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  topExpenses: Array<{
    description: string;
    amount: number;
    category: string;
    date: Date;
  }>;
}

export class FinanceReportService {
  /**
   * Generate P&L Statement for a date range
   */
  static async generatePLStatement(
    startDate: Date,
    endDate: Date
  ): Promise<PLStatement> {
    try {
      // Get actual POS sales and online orders directly (more accurate than ledger alone)
      const sales = await SaleService.getSales(startDate, endDate);
      const posSalesRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);

      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );
      const onlineOrdersRevenue = confirmedOrCompletedOrders.reduce((sum, order) => sum + order.total, 0);

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

      let expenses = purchaseOrderExpenses;
      const incomeBreakdown = {
        sales: posSalesRevenue, // POS sales revenue
        orders: onlineOrdersRevenue, // Online orders revenue
        other: 0,
      };
      const expenseBreakdown = {
        purchases: purchaseOrderExpenses, // Purchase orders expenses
        vendorPayments: 0,
        salaries: 0,
        rent: 0,
        utilities: 0,
        other: 0,
      };

      // Calculate expenses and other income from ledger (excluding auto-generated entries)
      const manualLedgerEntries = entries.filter((entry) => {
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

      manualLedgerEntries.forEach((entry) => {
        if (entry.type === "INCOME") {
          // Only count other income (not sales, as we're using direct sales/orders data)
          if (entry.category !== "SALES") {
            incomeBreakdown.other += entry.amount;
          }
        } else if (entry.type === "EXPENSE") {
          expenses += entry.amount;
          switch (entry.category) {
            case "SALARY":
              expenseBreakdown.salaries += entry.amount;
              break;
            case "RENT":
              expenseBreakdown.rent += entry.amount;
              break;
            case "UTILITY":
              expenseBreakdown.utilities += entry.amount;
              break;
            default:
              expenseBreakdown.other += entry.amount;
          }
        }
      });

      // Total income = POS sales + Online orders + Other income
      const income = posSalesRevenue + onlineOrdersRevenue + incomeBreakdown.other;

      return {
        income,
        expenses,
        netProfit: income - expenses,
        incomeBreakdown,
        expenseBreakdown,
      };
    } catch (error) {
      console.error("Error generating P&L statement:", error);
      throw error;
    }
  }

  /**
   * Generate Cash Flow statement
   */
  static async generateCashFlow(
    startDate: Date,
    endDate: Date
  ): Promise<CashFlow> {
    try {
      // Get actual sales and orders for accurate cash flow
      const sales = await SaleService.getSales(startDate, endDate);
      const orders = await OrderService.getAllOrders({
        startDate,
        endDate,
      });
      const confirmedOrCompletedOrders = orders.filter(
        (o) => o.status === "CONFIRMED" || o.status === "COMPLETED"
      );

      // Get expenses from ledger
      const entries = await LedgerService.getEntries(startDate, endDate);

      const cashInBreakdown = {
        cash: 0,
        bankTransfer: 0,
        fonePay: 0,
        cheque: 0,
        credit: 0,
      };
      const cashOutBreakdown = {
        cash: 0,
        bankTransfer: 0,
        fonePay: 0,
        cheque: 0,
        credit: 0,
      };

      // Process POS sales (accrual accounting: include all sales as income when sale happens)
      // All payment methods are included as cash in (accrual accounting)
      sales.forEach((sale) => {
        switch (sale.paymentMethod) {
          case "CASH":
            cashInBreakdown.cash += sale.total;
            break;
          case "BANK_TRANSFER":
            cashInBreakdown.bankTransfer += sale.total;
            break;
          case "FONE_PAY":
            cashInBreakdown.fonePay += sale.total;
            break;
          case "CHEQUE":
            cashInBreakdown.cheque += sale.total;
            break;
          case "CREDIT":
            // Credit sales: include as cash in (accrual accounting - income when sale happens)
            cashInBreakdown.credit += sale.total;
            break;
        }
      });

      // Process online orders (accrual accounting: include all orders as income when order happens)
      // All orders are included as cash in (accrual accounting - income when order happens)
      confirmedOrCompletedOrders.forEach((order) => {
        // Map COD to CASH, others to their respective categories
        // In accrual accounting, all orders count as income regardless of payment method
        if (order.paymentMethod === "COD" || order.paymentMethod === "BANK_TRANSFER") {
          // COD is cash on delivery, BANK_TRANSFER goes to bank
          if (order.paymentMethod === "COD") {
            cashInBreakdown.cash += order.total;
          } else {
            cashInBreakdown.bankTransfer += order.total;
          }
        } else if (order.paymentMethod === "FONE_PAY") {
          cashInBreakdown.fonePay += order.total;
        } else {
          // Default to CASH for any other payment method (accrual accounting)
          cashInBreakdown.cash += order.total;
        }
      });

      // Get purchase orders for cash flow (accrual accounting: include as expenses when purchase happens)
      const purchaseOrders = await VendorService.getPurchaseOrdersByDateRange(startDate, endDate);
      
      // Process purchase orders (received) as cash out (accrual accounting - expense when purchase happens)
      // Purchase orders are included as cash out (even though cash not paid yet)
      const receivedPOs = purchaseOrders.filter((po) => po.status === "RECEIVED");
      receivedPOs.forEach((po) => {
        const poAmount = po.receivedTotalAmount ?? po.totalAmount;
        // Purchase orders are typically on credit, but we include as cash out (accrual accounting)
        // Categorize as CREDIT since they're typically on credit terms
        cashOutBreakdown.credit += poAmount;
      });

      // Filter ledger entries (excluding auto-generated entries, but including VENDOR_PAY for cash flow)
      const validEntries = entries.filter((entry) => {
        // Exclude auto-generated sales entries
        if (entry.category === "SALES" && entry.relatedId) {
          return false;
        }
        // Exclude auto-generated purchase order entries (we're using actual PO data above)
        if (entry.category === "PURCHASE" && entry.relatedId) {
          return false;
        }
        // Include VENDOR_PAY entries for cash flow (these are actual cash outflows)
        // But note: VENDOR_PAY doesn't create new expense (already recorded in PO), just cash movement
        // Exclude credit settlement entries (these are just collections, not new income)
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        if (isCreditSettlement) {
          return false;
        }
        return true;
      });

      // Process other income and expenses from ledger
      validEntries.forEach((entry) => {
        if (entry.type === "INCOME" && entry.category !== "SALES") {
          // Other income (not sales, as we've already processed sales/orders)
          switch (entry.paymentMethod) {
            case "CASH":
              cashInBreakdown.cash += entry.amount;
              break;
            case "BANK_TRANSFER":
              cashInBreakdown.bankTransfer += entry.amount;
              break;
            case "FONE_PAY":
              cashInBreakdown.fonePay += entry.amount;
              break;
            case "CHEQUE":
              cashInBreakdown.cheque += entry.amount;
              break;
            case "CREDIT":
              cashInBreakdown.credit += entry.amount;
              break;
          }
        } else if (entry.type === "EXPENSE" || entry.category === "VENDOR_PAY") {
          // Include all expenses AND VENDOR_PAY entries (these are actual cash outflows)
          // Note: VENDOR_PAY is excluded from P&L expenses but included in cash flow
          switch (entry.paymentMethod) {
            case "CASH":
              cashOutBreakdown.cash += entry.amount;
              break;
            case "BANK_TRANSFER":
              cashOutBreakdown.bankTransfer += entry.amount;
              break;
            case "FONE_PAY":
              cashOutBreakdown.fonePay += entry.amount;
              break;
            case "CHEQUE":
              cashOutBreakdown.cheque += entry.amount;
              break;
            case "CREDIT":
              // Credit expenses: include as cash out (accrual accounting - expense when incurred)
              cashOutBreakdown.credit += entry.amount;
              break;
          }
        }
      });

      const cashIn =
        cashInBreakdown.cash +
        cashInBreakdown.bankTransfer +
        cashInBreakdown.fonePay +
        cashInBreakdown.cheque +
        cashInBreakdown.credit;
      const cashOut =
        cashOutBreakdown.cash +
        cashOutBreakdown.bankTransfer +
        cashOutBreakdown.fonePay +
        cashOutBreakdown.cheque +
        cashOutBreakdown.credit;

      return {
        cashIn: cashIn || 0,
        cashOut: cashOut || 0,
        netCashFlow: (cashIn || 0) - (cashOut || 0),
        cashInBreakdown: cashInBreakdown || { cash: 0, bankTransfer: 0, fonePay: 0 },
        cashOutBreakdown: cashOutBreakdown || { cash: 0, bankTransfer: 0, fonePay: 0 },
      };
    } catch (error) {
      console.error("Error generating cash flow:", error);
      throw error;
    }
  }

  /**
   * Generate Balance Sheet
   */
  static async generateBalanceSheet(): Promise<BalanceSheet> {
    try {
      // Calculate receivables (outstanding customer credits)
      const outstandingCredits = await CreditService.getAllOutstandingCredits();
      const receivables = outstandingCredits.reduce(
        (sum, credit) => sum + (credit.dueAmount || 0),
        0
      );

      // Calculate payables (outstanding vendor balances)
      const vendors = await VendorService.getAllVendors();
      const payables = vendors.reduce(
        (sum, vendor) => sum + (vendor.balance > 0 ? vendor.balance : 0),
        0
      );

      // Calculate inventory value from products
      const { ProductService } = await import("./productService");
      const products = await ProductService.getAllProducts();
      let inventory = 0;
      products.forEach((product) => {
        if (product.costPrice) {
          Object.values(product.warehouses || {}).forEach((warehouse) => {
            inventory += (warehouse.quantity || 0) * (product.costPrice || 0);
          });
        }
      });

      // Calculate cash from actual sales and orders + ledger entries
      // Get all POS sales with CASH payment
      const allSales = await SaleService.getSales(new Date(0), new Date());
      let cashFromSales = 0;
      allSales.forEach((sale) => {
        if (sale.paymentMethod === "CASH") {
          cashFromSales += sale.total;
        }
      });

      // Get all confirmed/completed orders with COD (which is CASH)
      const allOrders = await OrderService.getAllOrders({});
      const allConfirmedOrders = allOrders.filter(
        (o) => (o.status === "CONFIRMED" || o.status === "COMPLETED") && o.paymentMethod === "COD"
      );
      const cashFromOrders = allConfirmedOrders.reduce((sum, order) => sum + order.total, 0);

      // Get cash from ledger (other income and expenses)
      const allEntries = await LedgerService.getEntries(
        new Date(0), // From beginning
        new Date() // To now
      );
      
      let cashFromLedger = 0;
      allEntries.forEach((entry) => {
        // Exclude credit settlement entries (these are just collections, not new income)
        const isCreditSettlement = entry.category === "SALES" && 
          entry.description?.toLowerCase().includes("credit settlement");
        
        // Skip SALES category as we've already counted from actual sales/orders
        // Also exclude credit settlements
        if (entry.type === "INCOME" && entry.category !== "SALES" && !isCreditSettlement) {
          if (entry.paymentMethod === "CASH") {
            cashFromLedger += entry.amount;
          }
        } else if (entry.type === "EXPENSE" && entry.category !== "VENDOR_PAY") {
          // Exclude VENDOR_PAY entries (these are just payments, not expenses)
          if (entry.paymentMethod === "CASH") {
            cashFromLedger -= entry.amount;
          }
        }
      });

      const cash = cashFromSales + cashFromOrders + cashFromLedger;

      const assets = {
        cash: cash || 0,
        inventory: inventory || 0,
        receivables: receivables || 0,
        total: (cash || 0) + (inventory || 0) + (receivables || 0),
      };

      const liabilities = {
        payables: payables || 0,
        total: payables || 0,
      };

      return {
        assets,
        liabilities,
        equity: assets.total - liabilities.total,
      };
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      // Return default values on error
      return {
        assets: {
          cash: 0,
          inventory: 0,
          receivables: 0,
          total: 0,
        },
        liabilities: {
          payables: 0,
          total: 0,
        },
        equity: 0,
      };
    }
  }

  /**
   * Generate Sales Report
   */
  static async generateSalesReport(
    startDate: Date,
    endDate: Date
  ): Promise<SalesReport> {
    try {
      // Get POS sales
      const sales = await SaleService.getSales(startDate, endDate);
      const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);

      // Get online orders (include both CONFIRMED and COMPLETED)
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

      const totalRevenue = totalSales + ordersRevenue;
      const totalOrderCount = sales.length + confirmedOrCompletedOrders.length;
      const averageOrderValue =
        totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

      // Aggregate by product
      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
      
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

      confirmedOrCompletedOrders.forEach((order) => {
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

      const salesByProduct = Array.from(productMap.entries()).map(
        ([productId, data]) => ({
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: data.revenue,
        })
      );

      // Aggregate by customer
      const customerMap = new Map<string, { name: string; totalSpent: number; orderCount: number }>();
      
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

      confirmedOrCompletedOrders.forEach((order) => {
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

      const salesByCustomer = Array.from(customerMap.entries()).map(
        ([customerId, data]) => ({
          customerId,
          customerName: data.name,
          totalSpent: data.totalSpent,
          orderCount: data.orderCount,
        })
      );

      return {
        totalSales: totalRevenue || 0,
        totalOrders: totalOrderCount || 0,
        averageOrderValue: averageOrderValue || 0,
        salesByProduct: salesByProduct.sort((a, b) => b.revenue - a.revenue) || [],
        salesByCategory: {}, // Would need product category data
        salesByCustomer: salesByCustomer.sort((a, b) => b.totalSpent - a.totalSpent) || [],
      };
    } catch (error) {
      console.error("Error generating sales report:", error);
      // Return default values on error
      return {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        salesByProduct: [],
        salesByCategory: {},
        salesByCustomer: [],
      };
    }
  }

  /**
   * Generate Expense Report
   */
  static async generateExpenseReport(
    startDate: Date,
    endDate: Date
  ): Promise<ExpenseReport> {
    try {
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
      const totalExpenses = purchaseOrderExpenses + ledgerExpenses;

      const expensesByCategory: Record<string, number> = {
        PURCHASE: purchaseOrderExpenses,
      };
      
      validExpenseEntries.forEach((entry) => {
        expensesByCategory[entry.category] =
          (expensesByCategory[entry.category] || 0) + entry.amount;
      });

      // Add purchase orders to top expenses
      const poExpenses = receivedPOs.map((po) => ({
        description: `Purchase Order #${po.id.substring(0, 8)}`,
        amount: po.receivedTotalAmount ?? po.totalAmount,
        category: "PURCHASE",
        date: po.createdAt.toDate(),
      }));

      const ledgerExpenseList = validExpenseEntries.map((entry) => ({
        description: entry.description,
        amount: entry.amount,
        category: entry.category,
        date: entry.date.toDate(),
      }));

      const topExpenses = [...poExpenses, ...ledgerExpenseList]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20);

      return {
        totalExpenses: totalExpenses || 0,
        expensesByCategory: expensesByCategory || {},
        topExpenses: topExpenses || [],
      };
    } catch (error) {
      console.error("Error generating expense report:", error);
      // Return default values on error
      return {
        totalExpenses: 0,
        expensesByCategory: {},
        topExpenses: [],
      };
    }
  }
}

