"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer, RESOURCES, ACTIONS } from "@/lib/types";
import { CustomerService } from "@/lib/services/customerService";
import { usePermissions } from "@/lib/hooks/usePermissions";
import Fuse from "fuse.js";
import Link from "next/link";
import { Plus, Search, DollarSign } from "lucide-react";

export default function CustomersPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const fuse = new Fuse(customers, {
      keys: ["name", "phone", "email", "address"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    setFilteredCustomers(results.map((result) => result.item));
  }, [searchQuery, customers]);

  const fetchCustomers = async () => {
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const customerList: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customerList.push({ id: doc.id, ...doc.data() } as Customer);
      });

      // Calculate totalSpent from sales for each customer (in background)
      // This ensures accurate display even if database value is outdated
      const customersWithCalculatedTotal = await Promise.all(
        customerList.map(async (customer) => {
          try {
            const calculatedTotal = await CustomerService.getCustomerSalesTotal(customer.id);
            // Use calculated value if it's different from stored value
            if (Math.abs(calculatedTotal - (customer.totalSpent || 0)) > 0.01) {
              return {
                ...customer,
                totalSpent: calculatedTotal, // Display calculated value
              };
            }
            return customer;
          } catch (error) {
            console.error(`Error calculating totalSpent for customer ${customer.id}:`, error);
            return customer; // Return original if calculation fails
          }
        })
      );

      setCustomers(customersWithCalculatedTotal);
      setFilteredCustomers(customersWithCalculatedTotal);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredPermission={{ resource: RESOURCES.CUSTOMERS, action: ACTIONS.VIEW }}>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Customers</h1>
            <p className="text-gray-600 mt-2">Manage your customers</p>
          </div>
          {hasPermission("customers", "create") && (
            <Link href="/admin/customers/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <CardTitle>Customer List</CardTitle>
                <CardDescription>All customers in the system</CardDescription>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? "No customers found matching your search." : "No customers found. Create your first customer to get started."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Outstanding Due</TableHead>
                      <TableHead>Loyalty Points</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.email || "N/A"}</TableCell>
                        <TableCell>Rs {(customer.totalSpent || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {customer.totalDue && customer.totalDue > 0 ? (
                            <span className="text-red-600 font-semibold">
                              Rs {customer.totalDue.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-green-600">Rs 0.00</span>
                          )}
                        </TableCell>
                        <TableCell>{customer.loyaltyPoints}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/customers/${customer.id}`)}
                          >
                            View
                          </Button>
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

