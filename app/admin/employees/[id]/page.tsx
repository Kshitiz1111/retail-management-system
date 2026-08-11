"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, UserRole, EmployeePermissions, ROLES } from "@/lib/types";
import {
  ArrowLeft,
  BarChart3,
  Edit,
  Save,
  X,
  DollarSign,
  Plus,
  History,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { PayrollService } from "@/lib/services/payrollService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id as string;
  const [employee, setEmployee] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    role: "staff" as UserRole,
    baseSalary: "",
    employeeType: "FULL_TIME" as any,
    contractEndDate: "",
  });
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);

  const fetchEmployeeData = async () => {
    try {
      // Fetch user data (contains all employee information)
      const userDoc = await getDoc(doc(db, "users", employeeId));
      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() } as unknown as User;
        setEmployee(userData);

        // Set form data from user document
        setFormData({
          displayName: userData.displayName || "",
          role: userData.role || "staff",
          baseSalary: (userData.baseSalary || 0).toString(),
          employeeType: userData.employeeType || "FULL_TIME",
          contractEndDate: userData.contractEndDate ? (userData.contractEndDate as Timestamp).toDate().toISOString().split("T")[0] : "",
        });

        // Fetch payment history
        const paymentHistory = await PayrollService.getPaymentHistory(employeeId);
        setHistory(paymentHistory);

        // Initialize permissions from userData or create default
        // Always merge with complete default structure to ensure all resources are present
        const defaultPermissions: EmployeePermissions = {
          resources: {
            inventory: { view: false, create: false, update: false, delete: false },
            finance: { view: false, create: false, update: false, delete: false },
            customers: {
              view: false,
              create: false,
              update: false,
              delete: false,
              viewCredits: false,
              settleCredits: false,
            },
            employees: { view: false, create: false, update: false, delete: false },
            vendors: { view: false, create: false, update: false, delete: false },
            pos: { view: false, create: false, update: false, delete: false, applyDiscount: false },
            reports: { view: false, create: false, update: false, delete: false },
            orders: { view: false, create: false, update: false, delete: false },
            salesReturns: { view: false, create: false, update: false, delete: false },
            purchaseReturns: { view: false, create: false, update: false, delete: false },
            settings: { view: false, create: false, update: false, delete: false },
            hr: { view: false, create: false, update: false, delete: false },
          },
        };

        if (userData.permissions) {
          // Merge existing permissions with defaults to ensure all resources are present
          const mergedPermissions: EmployeePermissions = {
            resources: {
              ...defaultPermissions.resources,
              ...userData.permissions.resources,
              // Ensure customers resource has all fields
              customers: {
                ...defaultPermissions.resources.customers,
                ...(userData.permissions.resources.customers || {}),
              },
              // Ensure pos resource has all fields including applyDiscount
              pos: {
                ...defaultPermissions.resources.pos,
                ...(userData.permissions.resources.pos || {}),
              },
            },
          };
          setPermissions(mergedPermissions);
        } else {
          setPermissions(defaultPermissions);
        }
      }
    } catch (error) {
      console.error("Error fetching employee data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);


  const handleSave = async () => {
    if (!employee || !permissions) return;

    setSaving(true);
    try {
      // Update user document with all employee data
      await updateDoc(doc(db, "users", employeeId), {
        displayName: formData.displayName || undefined,
        role: formData.role,
        permissions,
        baseSalary: parseFloat(formData.baseSalary) || 0,
        employeeType: formData.employeeType,
        contractEndDate: formData.contractEndDate ? Timestamp.fromDate(new Date(formData.contractEndDate)) : null,
        status: employee.status || "ACTIVE",
        finance: employee.finance || {
          currentAdvance: 0,
          unpaidCommissions: 0,
        },
        updatedAt: serverTimestamp(),
      });

      setEditing(false);
      await fetchEmployeeData();
      alert("Employee updated successfully");
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  const handleGiveAdvance = async () => {
    if (!employee || !advanceAmount || isNaN(parseFloat(advanceAmount))) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await PayrollService.processAdvancePayment(
        employee.id,
        employee.displayName || employee.email,
        parseFloat(advanceAmount),
        "CASH", // Default to cash for now
        currentUser?.uid || "admin"
      );
      setAdvanceAmount("");
      setAdvanceDialogOpen(false);
      await fetchEmployeeData();
      alert("Advance payment recorded successfully");
    } catch (error) {
      console.error("Error giving advance:", error);
      alert("Failed to process advance payment");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole={ROLES.ADMIN}>
        <AdminLayout>
          <div className="text-center py-12">Loading employee details...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!employee) {
    return (
      <ProtectedRoute requiredRole={ROLES.ADMIN}>
        <AdminLayout>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Employee not found</h1>
            <Link href="/admin/employees">
              <Button>Back to Employees</Button>
            </Link>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole={ROLES.ADMIN}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/employees">
                <Button variant="outline" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold">{employee.displayName || "Employee"}</h1>
                <p className="text-gray-600 mt-1">Employee Details</p>
              </div>
            </div>
            {!editing ? (
              <div className="flex gap-2">
                <Link href={`/admin/employees/${employeeId}/pay-salary`}>
                  <Button variant="outline">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Pay Salary
                  </Button>
                </Link>
                <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Give Advance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Give Salary Advance</DialogTitle>
                      <DialogDescription>
                        This will record an advance payment for {employee.displayName}.
                        The amount will be deducted from their next salary.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="advanceAmount">Amount (Rs)</Label>
                        <Input
                          id="advanceAmount"
                          type="number"
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAdvanceDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleGiveAdvance}>Confirm Advance</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button onClick={() => setEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    fetchEmployeeData();
                  }}
                  disabled={saving}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input
                        id="displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeType">Employee Type</Label>
                      <Select
                        value={formData.employeeType}
                        onValueChange={(value) => setFormData({ ...formData, employeeType: value as any })}
                      >
                        <SelectTrigger id="employeeType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FULL_TIME">Full Time</SelectItem>
                          <SelectItem value="PART_TIME">Part Time</SelectItem>
                          <SelectItem value="CONTRACT">Contract Based</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.employeeType === "CONTRACT" && (
                      <div className="space-y-2">
                        <Label htmlFor="contractEndDate">Contract End Date</Label>
                        <Input
                          id="contractEndDate"
                          type="date"
                          value={formData.contractEndDate}
                          onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                          required={formData.employeeType === "CONTRACT"}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Full Name</p>
                      <p className="font-medium">{employee.displayName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{employee.email}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Role</p>
                        <p className="font-medium capitalize">{employee.role}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Employee Type</p>
                        <p className="font-medium capitalize">{(employee.employeeType || "FULL_TIME").replace("_", " ")}</p>
                      </div>
                    </div>
                    {employee.employeeType === "CONTRACT" && employee.contractEndDate && (
                      <div>
                        <p className="text-sm text-gray-600">Contract End Date</p>
                        <p className="font-medium text-red-600">
                          {employee.contractEndDate.toDate().toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-sm text-gray-600">Email Verified</p>
                  <p className={employee.emailVerified ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                    {employee.emailVerified ? "Yes" : "Pending"}
                  </p>
                </div>
                {employee.createdAt && (
                  <div>
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="font-medium">
                      {employee.createdAt.toDate().toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {employee && (employee.baseSalary !== undefined || employee.status || employee.finance) && (
              <Card>
                <CardHeader>
                  <CardTitle>Employee Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {employee.status && (
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="font-medium capitalize">{employee.status}</p>
                    </div>
                  )}
                  {editing ? (
                    <div className="space-y-2">
                      <Label htmlFor="baseSalary">Base Salary (Rs)</Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.baseSalary}
                        onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600">Base Salary</p>
                      <p className="font-medium">Rs {(employee.baseSalary || 0).toFixed(2)}</p>
                    </div>
                  )}
                  {employee.joiningDate && (
                    <div>
                      <p className="text-sm text-gray-600">Joining Date</p>
                      <p className="font-medium">
                        {employee.joiningDate.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {employee.finance && (
                    <>
                      <div>
                        <p className="text-sm text-gray-600">Current Advance</p>
                        <p className="font-medium">Rs {(employee.finance.currentAdvance || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Unpaid Commissions</p>
                        <p className="font-medium">Rs {(employee.finance.unpaidCommissions || 0).toFixed(2)}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Performance</CardTitle>
                    <CardDescription>View employee sales and attendance history</CardDescription>
                  </div>
                  <Link href={`/admin/employees/${employeeId}/performance`}>
                    <Button variant="outline">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      View Performance
                    </Button>
                  </Link>
                </div>
              </CardHeader>
            </Card>

            {employee.permissions && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>Resource access permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  {editing && permissions ? (
                    <PermissionMatrix permissions={permissions} onChange={setPermissions} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(employee.permissions.resources).map(([resource, perms]) => (
                        <div key={resource} className="border rounded p-4">
                          <h4 className="font-semibold mb-2 capitalize">{resource}</h4>
                          <div className="space-y-1 text-sm">
                            {Object.entries(perms).map(([action, allowed]) => {
                              if (typeof allowed === "boolean") {
                                return (
                                  <div key={action} className="flex justify-between">
                                    <span className="capitalize">{action}:</span>
                                    <span className={allowed ? "text-green-600" : "text-gray-400"}>
                                      {allowed ? "✓" : "✗"}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <CardTitle>Payment History</CardTitle>
                </div>
                <CardDescription>Recent salary and commission payments</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="py-2 px-4">Date</th>
                          <th className="py-2 px-4">Period</th>
                          <th className="py-2 px-4">Salary Earned</th>
                          <th className="py-2 px-4">Commission</th>
                          <th className="py-2 px-4">Advance Ded.</th>
                          <th className="py-2 px-4">Net Paid</th>
                          <th className="py-2 px-4">Method</th>
                          <th className="py-2 px-4">Proof</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {history.map((payment) => (
                          <tr key={payment.id}>
                            <td className="py-3 px-4">
                              {payment.createdAt?.toDate().toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              {payment.periodStart} to {payment.periodEnd}
                            </td>
                            <td className="py-3 px-4">Rs {payment.salaryEarned.toFixed(2)}</td>
                            <td className="py-3 px-4 text-green-600">
                              {payment.commissionEarned > 0 ? `+Rs ${payment.commissionEarned.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-3 px-4 text-red-600">
                              {payment.advanceDeducted > 0 ? `-Rs ${payment.advanceDeducted.toFixed(2)}` : "-"}
                            </td>
                            <td className="py-3 px-4 font-bold">Rs {payment.netAmount.toFixed(2)}</td>
                            <td className="py-3 px-4 capitalize">{payment.paymentMethod}</td>
                            <td className="py-3 px-4">
                              {payment.proofImageUrls && payment.proofImageUrls.length > 0 ? (
                                <div className="flex gap-2">
                                  {payment.proofImageUrls.map((url: string, i: number) => (
                                    <a
                                      key={i}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 transition-colors"
                                      title={`View Proof ${i + 1}`}
                                    >
                                      <ImageIcon className="h-4 w-4" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No payment history found.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute >
  );
}
