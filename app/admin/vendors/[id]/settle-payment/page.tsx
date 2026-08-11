"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
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
import { VendorService } from "@/lib/services/vendorService";
import { ImageService } from "@/lib/services/imageService";
import { Vendor, PaymentMethod, RESOURCES, ACTIONS } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, DollarSign, Upload, X } from "lucide-react";
import Link from "next/link";

export default function SettleVendorPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const vendorId = params.id as string;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "CASH" as PaymentMethod,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (vendorId) {
      fetchVendor();
    }
  }, [vendorId]);

  const fetchVendor = async () => {
    try {
      const vendorData = await VendorService.getVendor(vendorId);
      setVendor(vendorData);
    } catch (error) {
      console.error("Error fetching vendor:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !vendor) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amount > vendor.balance) {
      setError(`Amount cannot exceed outstanding balance of Rs ${vendor.balance.toFixed(2)}`);
      return;
    }

    setSettling(true);
    setUploadingImage(true);

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        try {
          imageUrl = await ImageService.uploadImage(imageFile, `vendor-payments/${vendorId}`);
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          setError("Failed to upload image. Please try again.");
          setSettling(false);
          setUploadingImage(false);
          return;
        }
      }

      await VendorService.settleVendorPayment(
        vendorId,
        amount,
        formData.paymentMethod,
        user.uid,
        formData.notes || undefined,
        imageUrl
      );
      alert("Payment settled successfully!");
      router.push(`/admin/vendors/${vendorId}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Failed to settle payment");
    } finally {
      setSettling(false);
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.UPDATE }}>
        <AdminLayout>
          <div className="text-center py-12">Loading vendor details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!vendor) {
    return (
      <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.UPDATE }}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
            <Link href="/admin/vendors">
              <Button>Back to Vendors</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.UPDATE }}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/vendors/${vendorId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Settle Payment</h1>
              <p className="text-gray-600 mt-1">{vendor.companyName}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  Rs {vendor.balance.toFixed(2)}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Amount owed to {vendor.companyName}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Settlement</CardTitle>
                <CardDescription>Record a payment to reduce outstanding balance</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSettle} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="amount">Payment Amount (Rs) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={vendor.balance}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder={`Max: Rs ${vendor.balance.toFixed(2)}`}
                      required
                    />
                    <p className="text-xs text-gray-600">
                      Remaining balance after payment: Rs{" "}
                      {vendor.balance - (parseFloat(formData.amount) || 0) >= 0
                        ? (vendor.balance - (parseFloat(formData.amount) || 0)).toFixed(2)
                        : "0.00"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) =>
                        setFormData({ ...formData, paymentMethod: value as PaymentMethod })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="FONE_PAY">FonePay</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any notes about this payment..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="receiptImage">Receipt Image (Optional)</Label>
                    <Input
                      id="receiptImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      disabled={settling}
                    />
                    {imagePreview && (
                      <div className="relative mt-2">
                        <img
                          src={imagePreview}
                          alt="Receipt preview"
                          className="max-w-xs h-auto rounded border"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={settling || uploadingImage}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    {settling || uploadingImage ? "Processing..." : "Settle Payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

