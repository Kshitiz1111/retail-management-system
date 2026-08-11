"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES, RESOURCES, ACTIONS } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoyaltyService } from "@/lib/services/loyaltyService";
import { LoyaltyRules } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Gift, Save } from "lucide-react";

export default function LoyaltySettingsPage() {
  const { hasPermission, isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<LoyaltyRules>({
    earnRate: 0.001,
    redeemRate: 1,
    minPointsToRedeem: 10,
    updatedAt: new Date() as any,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const currentRules = await LoyaltyService.getLoyaltyRules();
      if (currentRules) {
        setRules(currentRules);
      }
    } catch (error) {
      console.error("Error fetching loyalty rules:", error);
      setError("Failed to load loyalty rules");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (rules.earnRate < 0) {
      setError("Earn rate cannot be negative");
      return;
    }
    if (rules.redeemRate <= 0) {
      setError("Redeem rate must be greater than 0");
      return;
    }
    if (rules.minPointsToRedeem < 0) {
      setError("Minimum points to redeem cannot be negative");
      return;
    }

    setSaving(true);

    try {
      await LoyaltyService.updateLoyaltyRules(rules);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setError(error.message || "Failed to save loyalty rules");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute requiredRole={ROLES.ADMIN}>
        <AdminLayout>
          <div className="text-center py-12">
            <p className="text-gray-600">Access denied. Admin only.</p>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute requiredRole={ROLES.ADMIN}>
        <AdminLayout>
          <div className="text-center py-12">Loading loyalty settings...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole={ROLES.ADMIN}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Loyalty Program Settings</h1>
            <p className="text-gray-600 mt-2">Configure loyalty points earning and redemption rules</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Loyalty Rules
              </CardTitle>
              <CardDescription>
                Set how customers earn and redeem loyalty points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                    Loyalty rules saved successfully!
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="earnRate">Earn Rate</Label>
                    <Input
                      id="earnRate"
                      type="number"
                      step="0.0001"
                      min="0"
                      value={rules.earnRate}
                      onChange={(e) =>
                        setRules({ ...rules, earnRate: parseFloat(e.target.value) || 0 })
                      }
                      required
                    />
                    <p className="text-sm text-gray-600">
                      Points earned per rupee spent. Example: 0.001 means 1 point per Rs 1,000 spent
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="redeemRate">Redeem Rate</Label>
                    <Input
                      id="redeemRate"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={rules.redeemRate}
                      onChange={(e) =>
                        setRules({ ...rules, redeemRate: parseFloat(e.target.value) || 1 })
                      }
                      required
                    />
                    <p className="text-sm text-gray-600">
                      Rupees discount per point. Example: 1 means 1 point = Rs 1 discount
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minPointsToRedeem">Minimum Points to Redeem</Label>
                    <Input
                      id="minPointsToRedeem"
                      type="number"
                      step="1"
                      min="0"
                      value={rules.minPointsToRedeem}
                      onChange={(e) =>
                        setRules({ ...rules, minPointsToRedeem: parseInt(e.target.value) || 0 })
                      }
                      required
                    />
                    <p className="text-sm text-gray-600">
                      Minimum points required before customers can redeem
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <h4 className="font-semibold mb-2">Example Calculation:</h4>
                  <p className="text-sm text-gray-700">
                    With current settings:
                    <br />
                    • Customer spends Rs 10,000 → Earns {Math.floor(10000 * rules.earnRate)} points
                    <br />
                    • Customer has 100 points → Can redeem Rs {100 * rules.redeemRate} discount
                    <br />
                    • Minimum {rules.minPointsToRedeem} points required to redeem
                  </p>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Loyalty Rules"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

