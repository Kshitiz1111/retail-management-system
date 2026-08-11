"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrinterService, PrinterType } from "@/lib/services/printerService";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Printer, CheckCircle, XCircle } from "lucide-react";

export default function PrintersPage() {
  const { hasPermission } = usePermissions();
  const [printerService] = useState(() => new PrinterService());
  const [selectedType, setSelectedType] = useState<PrinterType>("SERIAL");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);

    try {
      await printerService.connect(selectedType);
      setConnected(true);
    } catch (err: any) {
      setError(err.message || "Failed to connect to printer");
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printerService.disconnect();
      setConnected(false);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect from printer");
    }
  };

  const handleTestPrint = async () => {
    try {
      await printerService.printReceipt({
        header: "TEST PRINT",
        items: [
          { name: "Test Item 1", quantity: 2, price: 100 },
          { name: "Test Item 2", quantity: 1, price: 50 },
        ],
        subtotal: 250,
        total: 250,
        paymentMethod: "CASH",
        footer: "Thank you for your business!",
      });
      alert("Test print sent successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to print");
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.POS, action: ACTIONS.UPDATE }}>
      <AdminLayout>
        <div className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Printer Settings</h1>
            <p className="text-gray-600 mt-2">Configure and test your thermal printer</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Printer Connection</CardTitle>
              <CardDescription>Connect your thermal printer via USB, Serial, or Bluetooth</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Printer Type</label>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as PrinterType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERIAL">USB / Serial</SelectItem>
                    <SelectItem value="BLUETOOTH">Bluetooth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-600 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-600">Not Connected</span>
                  </>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                {!connected ? (
                  <Button onClick={handleConnect} disabled={connecting}>
                    <Printer className="mr-2 h-4 w-4" />
                    {connecting ? "Connecting..." : "Connect Printer"}
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleTestPrint} variant="outline">
                      Test Print
                    </Button>
                    <Button onClick={handleDisconnect} variant="outline">
                      Disconnect
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded text-sm text-blue-800">
                <p className="font-semibold mb-2">Instructions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>For USB/Serial: Click "Connect Printer" and select your printer from the device list</li>
                  <li>For Bluetooth: Make sure your printer is in pairing mode, then click "Connect Printer"</li>
                  <li>Use "Test Print" to verify the connection works</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

