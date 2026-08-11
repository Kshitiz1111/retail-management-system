"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminAttendanceOverview } from "@/components/admin/AdminAttendanceOverview";
import { SelfAttendanceCheckIn } from "@/components/admin/SelfAttendanceCheckIn";
import { ROLES } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export default function AttendancePage() {
  const { user, firebaseUser } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  return (
    <ProtectedRoute>
      <AdminLayout>
        {isAdmin ? (
          <AdminAttendanceOverview />
        ) : firebaseUser ? (
          <SelfAttendanceCheckIn uid={firebaseUser.uid} />
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
