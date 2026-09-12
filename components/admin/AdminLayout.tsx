"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { EmployeePermissions } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  DollarSign,
  CreditCard,
  Building2,
  Settings,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  ShoppingBag,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { OrderService } from "@/lib/services/orderService";
import { cn } from "@/lib/utils";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: {
    resource: string;
    action: string;
  };
}

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "POS",
    href: "/pos",
    icon: ShoppingCart,
    permission: { resource: "pos", action: "view" },
  },
  {
    title: "Employees",
    href: "/admin/employees",
    icon: Users,
    permission: { resource: "employees", action: "view" },
  },
  {
    title: "Products",
    href: "/admin/inventory/products",
    icon: Package,
    permission: { resource: "inventory", action: "view" },
  },
  {
    title: "Warehouses",
    href: "/admin/inventory/warehouses",
    icon: Warehouse,
    permission: { resource: "inventory", action: "view" },
  },
  {
    title: "Vendors",
    href: "/admin/vendors",
    icon: Building2,
    permission: { resource: "vendors", action: "view" },
  },
  {
    title: "Finance",
    href: "/admin/finance",
    icon: DollarSign,
    permission: { resource: "finance", action: "view" },
  },
  {
    title: "Customers",
    href: "/admin/customers",
    icon: UserIcon,
    permission: { resource: "customers", action: "view" },
  },
  {
    title: "Customer Credits",
    href: "/admin/customers/credits",
    icon: CreditCard,
    permission: { resource: "customers", action: "viewCredits" },
  },
  {
    title: "Orders",
    href: "/admin/orders",
    icon: ShoppingBag,
    permission: { resource: "orders", action: "view" },
  },
  {
    title: "Returns",
    href: "/admin/returns",
    icon: RotateCcw,
    permission: { resource: "orders", action: "update" },
  },
  {
    title: "Attendance",
    href: "/admin/hr/attendance",
    icon: Clock,
    permission: { resource: "hr", action: "view" },
  },
  {
    title: "Settings",
    href: "/admin/settings/printers",
    icon: Settings,
    permission: { resource: "settings", action: "view" },
  },
  {
    title: "Payroll Settings",
    href: "/admin/settings/payroll",
    icon: DollarSign,
    permission: { resource: "settings", action: "view" },
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    // Fetch pending orders count
    const fetchPendingCount = async () => {
      try {
        const count = await OrderService.getPendingOrdersCount();
        setPendingOrdersCount(count);
      } catch (error) {
        console.error("Error fetching pending orders count:", error);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    const resource = item.permission.resource as keyof EmployeePermissions["resources"];
    const action = item.permission.action as "view" | "create" | "update" | "delete" | "viewCredits" | "settleCredits";
    return hasPermission(resource, action);
  });

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r transform transition-transform duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="flex flex-col h-full">
            {/* Logo/Header */}
            <div className="p-6 border-b hidden lg:block">
              <h1 className="text-xl font-bold">RMS</h1>
              <p className="text-sm text-gray-500">ERP & POS System</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const showBadge = item.href === "/admin/orders" && pendingOrdersCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.title}</span>
                    {showBadge && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {pendingOrdersCount > 99 ? "99+" : pendingOrdersCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Info & Logout */}
            <div className="p-4 border-t space-y-2">
              <div className="flex items-center gap-3 px-4 py-2">
                <UserIcon className="h-5 w-5 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.displayName || user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

