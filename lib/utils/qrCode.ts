// QR Code utility functions
import QRCode from "react-qr-code";

export interface QRCodeData {
  type: "item" | "product" | "sale";
  id: string;
  [key: string]: any;
}

/**
 * Generate QR code data string from object
 */
export function generateQRData(data: QRCodeData): string {
  return JSON.stringify(data);
}

/**
 * Parse QR code data string to object
 */
export function parseQRData(dataString: string): QRCodeData | null {
  try {
    return JSON.parse(dataString) as QRCodeData;
  } catch (error) {
    console.error("Error parsing QR data:", error);
    return null;
  }
}

/**
 * Generate QR code component for a product
 */
export function generateProductQR(productId: string, sku: string) {
  const data: QRCodeData = {
    type: "product",
    id: productId,
    sku: sku,
  };
  return generateQRData(data);
}

/**
 * React component wrapper for QR code
 */
export { default as QRCodeSVG } from "react-qr-code";

