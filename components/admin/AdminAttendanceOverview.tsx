"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HRService } from "@/lib/services/hrService";
import { AttendanceRecord, User } from "@/lib/types";
import { UserCheck, UserX, Timer, ChevronRight, Users } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type EmployeeAttendanceInfo = {
    employee: User;
    attendance: AttendanceRecord | null;
};

function formatTime(timestamp: any): string {
    if (!timestamp) return "-";
    try {
        return timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "-";
    }
}

export function AdminAttendanceOverview() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [employeeAttendance, setEmployeeAttendance] = useState<EmployeeAttendanceInfo[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

    useEffect(() => {
        fetchOverview();
    }, [selectedDate]);

    const fetchOverview = async () => {
        setLoading(true);
        try {
            // Fetch all employees (non-customer, non-admin users)
            const usersQuery = query(
                collection(db, "users"),
                where("role", "in", ["staff", "manager"])
            );
            const usersSnapshot = await getDocs(usersQuery);
            const employees: User[] = [];
            usersSnapshot.forEach((doc) => {
                employees.push({ id: doc.id, ...doc.data() } as User);
            });

            // Fetch all attendance for the selected date
            const allAttendance = await HRService.getAllAttendanceForDate(selectedDate);

            // Map employees to their attendance
            const mapped: EmployeeAttendanceInfo[] = employees.map((emp) => ({
                employee: emp,
                attendance: allAttendance.find((a) => a.uid === emp.id) || null,
            }));

            // Sort: present first, then absent, then alphabetical
            mapped.sort((a, b) => {
                if (a.attendance && !b.attendance) return -1;
                if (!a.attendance && b.attendance) return 1;
                return (a.employee.displayName || "").localeCompare(b.employee.displayName || "");
            });

            setEmployeeAttendance(mapped);
        } catch (error) {
            console.error("Error fetching admin overview:", error);
        } finally {
            setLoading(false);
        }
    };

    const presentCount = employeeAttendance.filter((e) => e.attendance).length;
    const absentCount = employeeAttendance.filter((e) => !e.attendance).length;
    const totalHoursToday = employeeAttendance.reduce(
        (sum, e) => sum + (e.attendance?.totalHours || 0),
        0
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Attendance Overview</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Team attendance for the selected date
                </p>
            </div>

            {/* Date Picker */}
            <div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full sm:w-auto px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <UserCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-700">{presentCount}</p>
                    <p className="text-[11px] text-green-600 font-medium">Present</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                    <UserX className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                    <p className="text-[11px] text-red-500 font-medium">Absent</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <Timer className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-700">{totalHoursToday.toFixed(1)}</p>
                    <p className="text-[11px] text-blue-600 font-medium">Total Hrs</p>
                </div>
            </div>

            {/* Employee List */}
            <div className="space-y-2">
                {employeeAttendance.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No employees found</p>
                    </div>
                ) : (
                    employeeAttendance.map(({ employee, attendance }) => {
                        const isPresent = !!attendance;
                        const hasCheckedOut = !!attendance?.checkOut;

                        return (
                            <button
                                key={employee.id}
                                onClick={() => router.push(`/admin/employees/${employee.id}/performance`)}
                                className="w-full text-left bg-white border rounded-xl p-4 hover:border-orange-300 hover:shadow-sm transition-all active:scale-[0.99]"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Avatar / Status indicator */}
                                    <div
                                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${isPresent
                                                ? hasCheckedOut
                                                    ? "bg-green-500"
                                                    : "bg-orange-500"
                                                : "bg-gray-300"
                                            }`}
                                    >
                                        {(employee.displayName || employee.email || "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-sm text-gray-900 truncate">
                                                {employee.displayName || employee.email}
                                            </p>
                                            <span
                                                className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isPresent
                                                        ? hasCheckedOut
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-orange-100 text-orange-700"
                                                        : "bg-red-100 text-red-600"
                                                    }`}
                                            >
                                                {isPresent ? (hasCheckedOut ? "Done" : "Working") : "Absent"}
                                            </span>
                                        </div>

                                        {isPresent ? (
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span>In: {formatTime(attendance.checkIn)}</span>
                                                {hasCheckedOut && (
                                                    <>
                                                        <span>Out: {formatTime(attendance.checkOut)}</span>
                                                        <span className="font-medium text-gray-700">
                                                            {attendance.totalHours?.toFixed(1)}h
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 mt-1">No check-in recorded</p>
                                        )}
                                    </div>

                                    {/* Arrow */}
                                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
