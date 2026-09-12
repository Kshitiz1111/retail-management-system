"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EmployeePermissions, ResourceName, PermissionAction, ROLES, ACTIONS, RESOURCES } from "@/lib/types";

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (
    resource: ResourceName,
    action: PermissionAction
  ): boolean => {
    if (!user) return false;

    if (user.role === ROLES.ADMIN) return true;

    // Check permissions for other roles
    if (user.permissions) {
      const resourcePerms = user.permissions.resources[resource];
      if (!resourcePerms) return false;

      // Handle special permissions for customers resource
      if (resource === RESOURCES.CUSTOMERS) {
        if (action === ACTIONS.VIEW_CREDITS || action === ACTIONS.SETTLE_CREDITS) {
          return (resourcePerms as any)[action] === true;
        }
      }

      // Handle special permissions for pos resource
      if (resource === RESOURCES.POS) {
        if (action === ACTIONS.APPLY_DISCOUNT) {
          return (resourcePerms as any)[action] === true;
        }
      }

      // Handle standard permissions
      if (action === ACTIONS.VIEW || action === ACTIONS.CREATE || action === ACTIONS.UPDATE || action === ACTIONS.DELETE) {
        return (resourcePerms as any)[action] === true;
      }
    }

    return false;
  };

  const canAccessRoute = (route: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;

    // Check route-specific permissions
    if (route.startsWith("/admin/finance")) {
      return hasPermission("finance", "view");
    }
    if (route.startsWith("/admin/inventory")) {
      return hasPermission("inventory", "view");
    }
    if (route.startsWith("/admin/vendors")) {
      return hasPermission("vendors", "view");
    }
    if (route.startsWith("/admin/employees")) {
      return hasPermission("employees", "view");
    }
    if (route.startsWith("/pos")) {
      return hasPermission("pos", "view");
    }

    return false;
  };

  return {
    hasPermission,
    canAccessRoute,
    userRole: user?.role,
    isAdmin: user?.role === "admin",
  };
}

