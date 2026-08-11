"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, ROLES } from "@/lib/types";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        // Fetch directly from users collection, filtering out customers
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const employeeList: User[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.role !== "customer") {
            employeeList.push({ id: doc.id, ...data } as User);
          }
        });
        setEmployees(employeeList);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  return (
    <ProtectedRoute requiredRole={ROLES.MANAGER}>
      <AdminLayout>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Employees</h1>
            <p className="text-gray-600 mt-2">Manage your staff and their permissions</p>
          </div>
          <Link href="/admin/employees/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Employee List</CardTitle>
            <CardDescription>All employees in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No employees found. Create your first employee to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Email Verified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          {employee.displayName || "N/A"}
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>
                          <span className="capitalize">{employee.role}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600">Active</span>
                        </TableCell>
                        <TableCell>
                          {employee.emailVerified ? (
                            <span className="text-green-600">Yes</span>
                          ) : (
                            <span className="text-yellow-600">Pending</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/employees/${employee.id}`)}
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

