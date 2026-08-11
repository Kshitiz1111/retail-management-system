"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendorService } from "@/lib/services/vendorService";
import { Vendor, RESOURCES, ACTIONS } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function VendorsPage() {
  const { hasPermission } = usePermissions();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const vendorList = await VendorService.getAllVendors();
      setVendors(vendorList);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-gray-600 mt-2">Manage your suppliers and vendors</p>
          </div>
          {hasPermission("vendors", "create") && (
            <Link href="/admin/vendors/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor List</CardTitle>
            <CardDescription>All vendors in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No vendors found. Create your first vendor to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Balance (Rs)</TableHead>
                      {/* <TableHead>Status</TableHead> */}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.companyName}</TableCell>
                        <TableCell>{vendor.category}</TableCell>
                        <TableCell>{vendor.phone}</TableCell>
                        <TableCell>
                          <span className={vendor.balance > 0 ? "text-red-600" : "text-green-600"}>
                            Rs {vendor.balance.toFixed(2)}
                          </span>
                        </TableCell>
                        {/* <TableCell>
                          <span className={vendor.isActive ? "text-green-600" : "text-gray-400"}>
                            {vendor.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell> */}
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/admin/vendors/${vendor.id}`}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            <Link href={`/admin/vendors/${vendor.id}/purchase-orders`}>
                              <Button variant="outline" size="sm">
                                POs
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AdminLayout>
    </ProtectedRoute>
  );
}

