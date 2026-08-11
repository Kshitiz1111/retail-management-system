"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { UserRole, EmployeePermissions, RESOURCES, ACTIONS, ROLES } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

const defaultPermissions: EmployeePermissions = {
  resources: {
    [RESOURCES.INVENTORY]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.FINANCE]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.CUSTOMERS]: {
      [ACTIONS.VIEW]: false,
      [ACTIONS.CREATE]: false,
      [ACTIONS.UPDATE]: false,
      [ACTIONS.DELETE]: false,
      [ACTIONS.VIEW_CREDITS]: false,
      [ACTIONS.SETTLE_CREDITS]: false,
    },
    [RESOURCES.EMPLOYEES]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.VENDORS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.POS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false, [ACTIONS.APPLY_DISCOUNT]: false
    },
    [RESOURCES.REPORTS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.ORDERS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.SALES_RETURNS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.PURCHASE_RETURNS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.HR]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
    [RESOURCES.SETTINGS]: {
      [ACTIONS.VIEW]: false, [ACTIONS.CREATE]: false, [ACTIONS.UPDATE]: false, [ACTIONS.DELETE]: false
    },
  },
};

export default function CreateEmployeePage() {
  const router = useRouter();
  const { createEmployee, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "staff" as UserRole,
    baseSalary: "",
    employeeType: "FULL_TIME" as any,
    contractEndDate: "",
  });

  const [permissions, setPermissions] = useState<EmployeePermissions>(defaultPermissions);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Create employee account (this now handles both user and employee profile creation)
      await createEmployee(
        formData.email,
        formData.password,
        formData.role,
        permissions,
        formData.displayName,
        formData.baseSalary ? parseFloat(formData.baseSalary) : undefined,
        formData.employeeType,
        formData.contractEndDate ? Timestamp.fromDate(new Date(formData.contractEndDate)) : null
      );

      router.push("/admin/employees");
    } catch (err: any) {
      setError(err.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole={ROLES.ADMIN}>
      <AdminLayout>
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Create New Employee</h1>
            <p className="text-gray-600 mt-2">Add a new employee and assign their permissions</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Employee account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseSalary">Base Salary (Monthly Rs)</Label>
                    <Input
                      id="baseSalary"
                      type="number"
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      placeholder="e.g. 25000"
                    />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Role Management</CardTitle>
                <CardDescription>Assign the employee's role</CardDescription>
              </CardHeader>
              <CardContent>
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
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      {/* Note: Roles are predefined in types/index.ts */}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <PermissionMatrix permissions={permissions} onChange={setPermissions} />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </form>
        </div>
      </AdminLayout>
    </ProtectedRoute >
  );
}

