"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { SaleService } from "@/lib/services/saleService";
import { HRService } from "@/lib/services/hrService";
import { ROLES, Sale, AttendanceRecord } from "@/lib/types";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, TrendingUp, Calendar, DollarSign } from "lucide-react";
import Link from "next/link";

export default function EmployeePerformancePage() {
  const params = useParams();
  const employeeId = params.id as string;
  const [sales, setSales] = useState<Sale[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      fetchPerformanceData();
    }
  }, [employeeId]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // Fetch sales made by this employee
      const salesQuery = query(
        collection(db, "sales"),
        where("performedBy", "==", employeeId),
        orderBy("createdAt", "desc")
      );

      try {
        const salesSnapshot = await getDocs(salesQuery);
        const salesList: Sale[] = [];
        salesSnapshot.forEach((doc) => {
          salesList.push({ id: doc.id, ...doc.data() } as Sale);
        });
        setSales(salesList);
      } catch (error: unknown) {
        // If index is missing, fetch without orderBy and sort in memory
        const err = error as { code?: string; message?: string };
        if (err.code === "failed-precondition" || err.message?.includes("index")) {
          const salesQuery2 = query(
            collection(db, "sales"),
            where("performedBy", "==", employeeId)
          );
          const salesSnapshot = await getDocs(salesQuery2);
          const salesList: Sale[] = [];
          salesSnapshot.forEach((doc) => {
            salesList.push({ id: doc.id, ...doc.data() } as Sale);
          });
          salesList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis() || 0;
            const bTime = b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });
          setSales(salesList);
        } else {
          throw error;
        }
      }

      // Fetch attendance records (last 30 days)
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const startDateStr = startDate.toISOString().split("T")[0];

      const attendanceRecords = await HRService.getAttendanceRecords(
        employeeId,
        startDateStr,
        endDate
      );
      setAttendance(attendanceRecords);
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const averageSaleValue = sales.length > 0 ? totalSales / sales.length : 0;
  const totalAttendanceDays = attendance.length;

  if (loading) {
    return (
      <ProtectedRoute requiredRole={ROLES.ADMIN}>
        <AdminLayout>
          <div className="text-center py-12">Loading performance data...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole={ROLES.ADMIN}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/admin/employees/${employeeId}`}>
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Employee Performance</h1>
              <p className="text-gray-600 mt-1">Sales and attendance history</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sales.length}</div>
                <p className="text-xs text-gray-500 mt-1">Transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  Rs {totalSales.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Generated</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rs {averageSaleValue.toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Per transaction</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAttendanceDays}</div>
                <p className="text-xs text-gray-500 mt-1">Days (last 30 days)</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Sales History
              </CardTitle>
              <CardDescription>All sales made by this employee</CardDescription>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No sales found for this employee.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Payment Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {sale.createdAt.toDate().toLocaleDateString()}
                          </TableCell>
                          <TableCell>{sale.items.length} item(s)</TableCell>
                          <TableCell className="font-medium">
                            Rs {sale.total.toFixed(2)}
                          </TableCell>
                          <TableCell>{sale.paymentMethod}</TableCell>
                          <TableCell>
                            {sale.dueAmount > 0 ? (
                              <span className="text-red-600 font-medium">Credit</span>
                            ) : (
                              <span className="text-green-600 font-medium">Paid</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance History
              </CardTitle>
              <CardDescription>Last 30 days attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No attendance records found for the last 30 days.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.date}</TableCell>
                          <TableCell>
                            {record.checkIn.toDate().toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            {record.checkOut
                              ? record.checkOut.toDate().toLocaleTimeString()
                              : "Not checked out"}
                          </TableCell>
                          <TableCell>
                            {record.totalHours ? `${record.totalHours.toFixed(2)} hrs` : "N/A"}
                          </TableCell>
                          <TableCell>{record.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

