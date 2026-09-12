// HR Service - Business logic for employee HR operations
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AttendanceRecord, User } from "@/lib/types";

export class HRService {
  /**
   * Record check-in
   */
  static async checkIn(uid: string): Promise<string> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const attendanceRef = await addDoc(collection(db, "attendance"), {
        uid,
        date: today,
        checkIn: Timestamp.now(),
        totalHours: 0,
      });
      return attendanceRef.id;
    } catch (error) {
      console.error("Error recording check-in:", error);
      throw error;
    }
  }

  /**
   * Record check-out
   */
  static async checkOut(attendanceId: string): Promise<void> {
    try {
      const attendanceDoc = await getDoc(doc(db, "attendance", attendanceId));
      if (!attendanceDoc.exists()) {
        throw new Error("Attendance record not found");
      }

      const attendance = attendanceDoc.data() as AttendanceRecord;
      const checkInTime = attendance.checkIn.toDate();
      const checkOutTime = new Date();
      const totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      await updateDoc(doc(db, "attendance", attendanceId), {
        checkOut: Timestamp.now(),
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
      });
    } catch (error) {
      console.error("Error recording check-out:", error);
      throw error;
    }
  }

  /**
   * Get today's attendance for a user
   */
  static async getTodayAttendance(uid: string): Promise<AttendanceRecord | null> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", uid),
        where("date", "==", today)
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as AttendanceRecord;
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      throw error;
    }
  }

  /**
   * Get all attendance records for a specific date (admin overview)
   */
  static async getAllAttendanceForDate(date?: string): Promise<AttendanceRecord[]> {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];
      const q = query(
        collection(db, "attendance"),
        where("date", "==", targetDate)
      );

      const querySnapshot = await getDocs(q);
      const records: AttendanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });

      return records;
    } catch (error) {
      console.error("Error fetching all attendance:", error);
      throw error;
    }
  }

  /**
   * Get attendance records for a date range
   */
  static async getAttendanceRecords(
    uid: string,
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, "attendance"),
        where("uid", "==", uid),
        where("date", ">=", startDate),
        where("date", "<=", endDate),
        orderBy("date", "desc")
      );

      const querySnapshot = await getDocs(q);
      const records: AttendanceRecord[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
      });

      return records;
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      throw error;
    }
  }

  /**
   * Calculate salary for an employee
   */
  static async calculateSalary(
    employeeId: string,
    month: number,
    year: number
  ): Promise<{
    baseSalary: number;
    daysPresent: number;
    salaryEarned: number;
    advances: number;
    commissions: number;
    netSalary: number;
  }> {
    try {
      const userDoc = await getDoc(doc(db, "users", employeeId));
      if (!userDoc.exists()) {
        throw new Error("Employee not found");
      }

      const user = { id: userDoc.id, ...userDoc.data() } as User;

      // Check if user has employee fields
      if (!user.baseSalary && user.baseSalary !== 0) {
        throw new Error("User is not an employee or missing salary information");
      }

      // Get attendance for the month
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-31`;
      const records = await this.getAttendanceRecords(employeeId, startDate, endDate);

      const daysPresent = records.filter((r) => r.checkOut).length;
      const salaryPerDay = (user.baseSalary || 0) / 30;
      const salaryEarned = salaryPerDay * daysPresent;
      const advances = user.finance?.currentAdvance || 0;
      const commissions = user.finance?.unpaidCommissions || 0;
      const netSalary = salaryEarned + commissions - advances;

      return {
        baseSalary: user.baseSalary || 0,
        daysPresent,
        salaryEarned,
        advances,
        commissions,
        netSalary,
      };
    } catch (error) {
      console.error("Error calculating salary:", error);
      throw error;
    }
  }
}

