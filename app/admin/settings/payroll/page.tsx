"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { RESOURCES, ACTIONS, PayPeriod, CommissionRule, PayrollSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PayrollService } from "@/lib/services/payrollService";
import { Save, RefreshCw } from "lucide-react";

const ROLES = ["staff", "manager"];
const EMPLOYEE_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT"];

export default function PayrollSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<PayrollSettings | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const data = await PayrollService.getPayrollSettings();
        if (data) {
            setSettings(data);
        } else {
            // Initialize if not found
            setSettings({
                payPeriod: "MONTHLY",
                commissionRules: {},
                updatedAt: null as any,
            });
        }
        setLoading(false);
    };

    const handeSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await PayrollService.updatePayrollSettings(settings);
            alert("Payroll settings updated successfully");
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Failed to update settings");
        } finally {
            setSaving(false);
        }
    };

    const updateRule = (role: string, type: string, field: keyof CommissionRule, value: number) => {
        if (!settings) return;
        const key = `${role}_${type}`;
        const newRules = { ...settings.commissionRules };
        newRules[key] = {
            ...(newRules[key] || { salesThreshold: 0, commissionPercent: 0 }),
            [field]: value,
        };
        setSettings({ ...settings, commissionRules: newRules });
    };

    if (loading) return <AdminLayout>Loading...</AdminLayout>;

    return (
        <ProtectedRoute requiredPermission={{ resource: RESOURCES.SETTINGS, action: ACTIONS.UPDATE }}>
            <AdminLayout>
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold">Payroll & Commission Settings</h1>
                            <p className="text-gray-600 mt-2">Configure pay periods and company-wide commission rules</p>
                        </div>
                        <Button onClick={fetchSettings} variant="outline" size="icon">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Global Settings</CardTitle>
                            <CardDescription>Basic payroll configuration</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="max-w-xs space-y-2">
                                    <Label htmlFor="payPeriod">Pay Period</Label>
                                    <Select
                                        value={settings?.payPeriod}
                                        onValueChange={(value) => setSettings({ ...settings!, payPeriod: value as PayPeriod })}
                                    >
                                        <SelectTrigger id="payPeriod">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                                            <SelectItem value="YEARLY">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Commission Rules</CardTitle>
                            <CardDescription>
                                Set thresholds for company-wide sales and the commission percentage of employee salary.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="border-b bg-gray-50">
                                            <th className="py-2 px-4">Role</th>
                                            <th className="py-2 px-4">Type</th>
                                            <th className="py-2 px-4">Company Sales Threshold (Rs)</th>
                                            <th className="py-2 px-4">Commission (% of Base Salary)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {ROLES.map((role) =>
                                            EMPLOYEE_TYPES.map((type) => {
                                                const key = `${role}_${type}`;
                                                const rule = settings?.commissionRules[key] || { salesThreshold: 0, commissionPercent: 0 };
                                                return (
                                                    <tr key={key}>
                                                        <td className="py-3 px-4 capitalize font-medium">{role}</td>
                                                        <td className="py-3 px-4 text-xs">
                                                            <span className="bg-gray-100 px-2 py-1 rounded">{type.replace("_", " ")}</span>
                                                        </td>
                                                        <td className="py-1 px-4">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-xs max-w-[120px]"
                                                                value={rule.salesThreshold}
                                                                onChange={(e) => updateRule(role, type, "salesThreshold", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                        <td className="py-1 px-4">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-xs max-w-[100px]"
                                                                value={rule.commissionPercent}
                                                                onChange={(e) => updateRule(role, type, "commissionPercent", parseFloat(e.target.value) || 0)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button variant="outline" onClick={() => fetchSettings()}>Cancel</Button>
                        <Button onClick={handeSave} disabled={saving}>
                            <Save className="mr-2 h-4 w-4" />
                            {saving ? "Saving..." : "Save Settings"}
                        </Button>
                    </div>

                    <div className="mt-8 p-4 bg-yellow-50 rounded border border-yellow-200 text-sm text-yellow-800">
                        <h4 className="font-bold mb-2">How it works:</h4>
                        <p>
                            When processing payroll for a period, the system calculates the total company sales during that period.
                            If it meets the <strong>Company Sales Threshold</strong>, the employee receives the set
                            <strong> Commission %</strong> as a bonus based on their <strong>Base Salary</strong>.
                        </p>
                    </div>
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
