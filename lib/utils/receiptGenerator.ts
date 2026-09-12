// Receipt Generator - Generate HTML and PDF receipts for orders
import { Order } from "@/lib/types";

/**
 * Generate HTML receipt
 */
export function generateReceiptHTML(order: Order, companyName: string = "Retail Management System(epr pos)"): string {
  const orderDate = order.createdAt.toDate().toLocaleString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${order.orderNumber}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .order-info {
      margin-bottom: 20px;
    }
    .order-info p {
      margin: 5px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .items-table th,
    .items-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .items-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .items-table .text-right {
      text-align: right;
    }
    .totals {
      margin-top: 20px;
      border-top: 2px solid #000;
      padding-top: 10px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    .total-row {
      font-weight: bold;
      font-size: 18px;
      margin-top: 10px;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .status {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: bold;
      margin-top: 10px;
    }
    .status-pending { background-color: #ffc107; color: #000; }
    .status-confirmed { background-color: #28a745; color: #fff; }
    .status-shipped { background-color: #17a2b8; color: #fff; }
    .status-cancelled { background-color: #dc3545; color: #fff; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName}</h1>
    <p>Order Receipt</p>
  </div>

  <div class="order-info">
    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
    <p><strong>Date:</strong> ${orderDate}</p>
    <p><strong>Status:</strong> <span class="status status-${order.status.toLowerCase()}">${order.status}</span></p>
  </div>

  <div class="order-info">
    <h3>Customer Information</h3>
    <p><strong>Name:</strong> ${order.customerInfo.name}</p>
    <p><strong>Phone:</strong> ${order.customerInfo.phone}</p>
    ${order.customerInfo.email ? `<p><strong>Email:</strong> ${order.customerInfo.email}</p>` : ''}
    <p><strong>Address:</strong> ${order.customerInfo.address}</p>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Item</th>
        <th>SKU</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Price</th>
        <th class="text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map(item => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.sku}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">Rs ${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">Rs ${item.subtotal.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>Rs ${order.subtotal.toFixed(2)}</span>
    </div>
    ${order.discount > 0 ? `
    <div class="totals-row">
      <span>Discount:</span>
      <span>-Rs ${order.discount.toFixed(2)}</span>
    </div>
    ` : ''}
    ${order.loyaltyPointsUsed ? `
    <div class="totals-row">
      <span>Loyalty Points Used:</span>
      <span>${order.loyaltyPointsUsed} points</span>
    </div>
    ` : ''}
    <div class="totals-row total-row">
      <span>Total:</span>
      <span>Rs ${order.total.toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Payment Method:</span>
      <span>${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</span>
    </div>
  </div>

  ${order.loyaltyPointsEarned ? `
  <div class="order-info">
    <p><strong>Loyalty Points Earned:</strong> ${order.loyaltyPointsEarned} points</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for your order!</p>
    <p>For inquiries, please contact us with your order number.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF receipt (using browser print functionality)
 */
export function printReceipt(order: Order, companyName?: string): void {
  const html = generateReceiptHTML(order, companyName);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Download receipt as HTML file
 */
export function downloadReceiptHTML(order: Order, companyName?: string): void {
  const html = generateReceiptHTML(order, companyName);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${order.orderNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

