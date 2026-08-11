"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmployeePermissions } from "@/lib/types";

interface PermissionMatrixProps {
  permissions: EmployeePermissions;
  onChange: (permissions: EmployeePermissions) => void;
}

type ResourceName = keyof EmployeePermissions["resources"];

const resourceLabels: Record<ResourceName, string> = {
  inventory: "Inventory",
  finance: "Finance",
  customers: "Customers",
  employees: "Employees",
  vendors: "Vendors",
  pos: "Point of Sale",
  reports: "Reports",
  orders: "Orders",
  salesReturns: "Sales Returns",
  purchaseReturns: "Purchase Returns",
  hr: "HR",
  settings: "Settings",
};

const actionLabels: Record<string, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  viewCredits: "View Credits",
  settleCredits: "Settle Credits",
  applyDiscount: "Apply Discount",
};

// Complete list of all resources - always show all of them
const allResources: ResourceName[] = [
  "inventory",
  "finance",
  "customers",
  "employees",
  "vendors",
  "pos",
  "reports",
  "orders",
  "salesReturns",
  "purchaseReturns",
  "hr",
  "settings",
];

export function PermissionMatrix({ permissions, onChange }: PermissionMatrixProps) {
  const [localPermissions, setLocalPermissions] = useState<EmployeePermissions>(permissions);

  // Sync localPermissions when permissions prop changes
  useEffect(() => {
    setLocalPermissions(permissions);
  }, [permissions]);

  // Merge permissions with defaults to ensure all resources are present
  const getCompletePermissions = (): EmployeePermissions => {
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
        hr: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
      },
    };

    return {
      resources: {
        ...defaultPermissions.resources,
        ...localPermissions.resources,
        customers: {
          ...defaultPermissions.resources.customers,
          ...(localPermissions.resources.customers || {}),
        },
        pos: {
          ...defaultPermissions.resources.pos,
          ...(localPermissions.resources.pos || {}),
        },
      },
    };
  };

  const completePermissions = getCompletePermissions();

  const updatePermission = (
    resource: ResourceName,
    action: string,
    value: boolean
  ) => {
    const newPermissions = { ...localPermissions };
    // Ensure resource exists in newPermissions
    if (!newPermissions.resources[resource]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newPermissions.resources[resource] = { ...completePermissions.resources[resource] } as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resourcePerms = newPermissions.resources[resource] as any;

    if (resource === "customers" && (action === "viewCredits" || action === "settleCredits")) {
      resourcePerms[action] = value;
    } else if (resource === "pos" && action === "applyDiscount") {
      resourcePerms[action] = value;
    } else if (action === "view" || action === "create" || action === "update" || action === "delete") {
      resourcePerms[action] = value;
    }

    setLocalPermissions(newPermissions);
    onChange(newPermissions);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Resource Permissions</CardTitle>
        <CardDescription>
          Select the permissions this employee should have for each resource
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {allResources.map((resource) => {
            const resourcePerms = completePermissions.resources[resource];
            const isCustomers = resource === "customers";
            const isPos = resource === "pos";

            return (
              <div key={resource} className="space-y-3 border-b pb-4 last:border-b-0">
                <h4 className="font-semibold text-sm">{resourceLabels[resource]}</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Object.keys(resourcePerms).map((action) => {
                    if (typeof resourcePerms[action as keyof typeof resourcePerms] !== "boolean") {
                      // Handle nested permissions for customers
                      if (isCustomers && (action === "viewCredits" || action === "settleCredits")) {
                        const checked = (resourcePerms as Record<string, boolean>)[action] || false;
                        return (
                          <div key={action} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${resource}-${action}`}
                              checked={checked}
                              onCheckedChange={(checked) =>
                                updatePermission(resource, action, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`${resource}-${action}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {actionLabels[action]}
                            </Label>
                          </div>
                        );
                      }
                      // Handle nested permissions for pos
                      if (isPos && action === "applyDiscount") {
                        const checked = (resourcePerms as Record<string, boolean>)[action] || false;
                        return (
                          <div key={action} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${resource}-${action}`}
                              checked={checked}
                              onCheckedChange={(checked) =>
                                updatePermission(resource, action, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`${resource}-${action}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {actionLabels[action]}
                            </Label>
                          </div>
                        );
                      }
                      return null;
                    }

                    return (
                      <div key={action} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${resource}-${action}`}
                          checked={resourcePerms[action as keyof typeof resourcePerms] as boolean}
                          onCheckedChange={(checked) =>
                            updatePermission(resource, action, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`${resource}-${action}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {actionLabels[action] || action}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

