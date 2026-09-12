"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { EmployeePermissions, ResourceName, PermissionAction, ROLES, ACTIONS, RESOURCES } from "@/lib/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: typeof ROLES[keyof typeof ROLES];
  requiredPermission?: {
    resource: ResourceName;
    action: PermissionAction;
  };
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Check if user is authenticated
    if (!user) {
      router.push(redirectTo);
      return;
    }

    // Check role requirement
    if (requiredRole) {
      const roleHierarchy: Record<string, number> = {
        admin: 3,
        manager: 2,
        staff: 1,
      };

      const userRoleLevel = roleHierarchy[user.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        router.push("/unauthorized");
        return;
      }
    }

    // Check permission requirement
    if (requiredPermission) {
      if (!hasPermission(requiredPermission.resource as any, requiredPermission.action as any)) {
        router.push("/unauthorized");
        return;
      }
    }
  }, [user, loading, requiredRole, requiredPermission, router, hasPermission]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

