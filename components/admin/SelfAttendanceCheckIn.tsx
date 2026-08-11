"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HRService } from "@/lib/services/hrService";
import { AttendanceRecord } from "@/lib/types";
import { Clock } from "lucide-react";

interface SelfAttendanceCheckInProps {
    uid: string;
}

export function SelfAttendanceCheckIn({ uid }: SelfAttendanceCheckInProps) {
    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchTodayAttendance();
    }, [uid]);

    const fetchTodayAttendance = async () => {
        try {
            const attendance = await HRService.getTodayAttendance(uid);
            setTodayAttendance(attendance);
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        setProcessing(true);
        try {
            await HRService.checkIn(uid);
            await fetchTodayAttendance();
        } catch (error) {
            console.error("Error checking in:", error);
            alert("Failed to check in");
        } finally {
            setProcessing(false);
        }
    };

    const handleCheckOut = async () => {
        if (!todayAttendance) return;
        setProcessing(true);
        try {
            await HRService.checkOut(todayAttendance.id);
            await fetchTodayAttendance();
        } catch (error) {
            console.error("Error checking out:", error);
            alert("Failed to check out");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
                <p className="text-sm text-gray-500 mt-1">Record your check-in and check-out</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Today&apos;s Attendance</CardTitle>
                    <CardDescription>
                        {new Date().toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {todayAttendance ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Check In</p>
                                    <p className="text-lg font-semibold">
                                        {todayAttendance.checkIn.toDate().toLocaleTimeString()}
                                    </p>
                                </div>
                                {todayAttendance.checkOut && (
                                    <div>
                                        <p className="text-sm text-gray-600">Check Out</p>
                                        <p className="text-lg font-semibold">
                                            {todayAttendance.checkOut.toDate().toLocaleTimeString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {todayAttendance.totalHours && todayAttendance.totalHours > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600">Total Hours</p>
                                    <p className="text-lg font-semibold">{todayAttendance.totalHours} hours</p>
                                </div>
                            )}
                            {!todayAttendance.checkOut && (
                                <Button onClick={handleCheckOut} disabled={processing} className="w-full">
                                    <Clock className="mr-2 h-4 w-4" />
                                    Check Out
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Button onClick={handleCheckIn} disabled={processing} className="w-full">
                            <Clock className="mr-2 h-4 w-4" />
                            Check In
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
