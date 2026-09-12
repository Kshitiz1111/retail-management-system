// Printer Service - Business logic for thermal printer operations
import { PrinterType, PrinterConnection } from "@/lib/types";
export type { PrinterType, PrinterConnection };

export interface PrinterAdapter {
  connect(): Promise<void>;
  print(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
}

// ESC/POS commands
const ESC = "\x1B";
const GS = "\x1D";

export class ESCPOSCommands {
  static initialize() {
    return ESC + "@";
  }

  static text(text: string) {
    return text;
  }

  static lineFeed(lines: number = 1) {
    return "\n".repeat(lines);
  }

  static center() {
    return ESC + "a" + "\x01";
  }

  static left() {
    return ESC + "a" + "\x00";
  }

  static bold(on: boolean = true) {
    return ESC + "E" + (on ? "\x01" : "\x00");
  }

  static cut() {
    return GS + "V" + "\x41" + "\x03";
  }

  static setSize(width: number = 1, height: number = 1) {
    return ESC + "!" + String.fromCharCode(((width - 1) << 4) | (height - 1));
  }
}

// Serial Printer Adapter
export class SerialPrinter implements PrinterAdapter {
  // @ts-ignore
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  async connect(): Promise<void> {
    if (!("serial" in navigator)) {
      throw new Error("Web Serial API is not supported in this browser");
    }

    try {
      // @ts-ignore
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable?.getWriter() || null;

      if (!this.writer) {
        throw new Error("Failed to get writer for serial port");
      }
    } catch (error) {
      console.error("Error connecting to serial printer:", error);
      throw error;
    }
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error("Printer not connected");
    }

    try {
      await this.writer.write(data);
    } catch (error) {
      console.error("Error printing:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }
}

// Bluetooth Printer Adapter (placeholder)
export class BluetoothPrinter implements PrinterAdapter {
  // @ts-ignore
  private device: BluetoothDevice | null = null;

  async connect(): Promise<void> {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth API is not supported in this browser");
    }

    try {
      // @ts-ignore
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }], // Standard Printer Service UUID
      });

      const server = await this.device.gatt?.connect();
      // Connect to GATT server and get characteristic for printing
      // Implementation depends on specific printer model
    } catch (error) {
      console.error("Error connecting to Bluetooth printer:", error);
      throw error;
    }
  }

  async print(data: Uint8Array): Promise<void> {
    // Implementation for Bluetooth printing
    throw new Error("Bluetooth printing not yet fully implemented");
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
  }
}

// Printer Service
export class PrinterService {
  private static instance: PrinterService | null = null;
  private adapter: PrinterAdapter | null = null;
  private type: PrinterType | null = null;

  static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  static async getSettings(): Promise<{ type: PrinterType; connection?: PrinterConnection } | null> {
    // Get printer settings from Firestore or localStorage
    try {
      const settings = localStorage.getItem("printerSettings");
      if (settings) {
        return JSON.parse(settings);
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  static async connect(type: PrinterType): Promise<void> {
    const instance = PrinterService.getInstance();
    await instance.connect(type);
  }

  static async printText(text: string): Promise<void> {
    const instance = PrinterService.getInstance();
    if (!instance.adapter) {
      throw new Error("Printer not connected");
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await instance.adapter.print(data);
  }

  static async disconnect(): Promise<void> {
    const instance = PrinterService.getInstance();
    await instance.disconnect();
  }

  async connect(type: PrinterType): Promise<void> {
    this.type = type;

    if (type === "SERIAL") {
      this.adapter = new SerialPrinter();
    } else if (type === "BLUETOOTH") {
      this.adapter = new BluetoothPrinter();
    } else {
      throw new Error(`Unsupported printer type: ${type}`);
    }

    await this.adapter.connect();
  }

  async printReceipt(receiptData: {
    header?: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    discount?: number;
    total: number;
    paymentMethod: string;
    footer?: string;
  }): Promise<void> {
    if (!this.adapter) {
      throw new Error("Printer not connected");
    }

    let receipt = ESCPOSCommands.initialize();
    receipt += ESCPOSCommands.center();
    receipt += ESCPOSCommands.bold(true);
    receipt += receiptData.header || "RECEIPT";
    receipt += ESCPOSCommands.lineFeed(2);
    receipt += ESCPOSCommands.bold(false);
    receipt += ESCPOSCommands.left();

    receipt += "Date: " + new Date().toLocaleString();
    receipt += ESCPOSCommands.lineFeed();
    receipt += "--------------------------------";
    receipt += ESCPOSCommands.lineFeed();

    receiptData.items.forEach((item) => {
      receipt += `${item.name} x${item.quantity}`;
      receipt += ESCPOSCommands.lineFeed();
      receipt += `  Rs ${(item.quantity * item.price).toFixed(2)}`;
      receipt += ESCPOSCommands.lineFeed();
    });

    receipt += "--------------------------------";
    receipt += ESCPOSCommands.lineFeed();
    receipt += `Subtotal: Rs ${receiptData.subtotal.toFixed(2)}`;
    receipt += ESCPOSCommands.lineFeed();

    if (receiptData.discount) {
      receipt += `Discount: Rs ${receiptData.discount.toFixed(2)}`;
      receipt += ESCPOSCommands.lineFeed();
    }

    receipt += ESCPOSCommands.bold(true);
    receipt += `Total: Rs ${receiptData.total.toFixed(2)}`;
    receipt += ESCPOSCommands.bold(false);
    receipt += ESCPOSCommands.lineFeed(2);

    receipt += `Payment: ${receiptData.paymentMethod}`;
    receipt += ESCPOSCommands.lineFeed(2);

    if (receiptData.footer) {
      receipt += receiptData.footer;
      receipt += ESCPOSCommands.lineFeed();
    }

    receipt += ESCPOSCommands.lineFeed(3);
    receipt += ESCPOSCommands.cut();

    const encoder = new TextEncoder();
    const data = encoder.encode(receipt);

    await this.adapter.print(data);
  }

  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
      this.type = null;
    }
  }

  isConnected(): boolean {
    return this.adapter !== null;
  }
}

