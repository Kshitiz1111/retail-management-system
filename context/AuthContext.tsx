"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db, secondaryAuth } from "@/lib/firebase";
import { User, UserRole, EmployeePermissions } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createEmployee: (
    email: string,
    password: string,
    role: UserRole,
    permissions: EmployeePermissions,
    displayName?: string,
    baseSalary?: number,
    employeeType?: string,
    contractEndDate?: any
  ) => Promise<string>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      // Reload Firebase user to get updated email verification status
      await firebaseUser.reload();
      const userData = await fetchUserData(firebaseUser.uid);
      setUser(userData);
    }
  };

  // Reload Firebase user to refresh email verification status
  const reloadFirebaseUser = async (firebaseUser: FirebaseUser): Promise<void> => {
    try {
      await firebaseUser.reload();
    } catch (error) {
      console.error("Error reloading Firebase user:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      if (firebaseUser) {
        // Reload user to get latest email verification status
        await reloadFirebaseUser(firebaseUser);

        // Fetch user data from Firestore to get role (not from custom claims)
        try {
          const userData = await fetchUserData(firebaseUser.uid);

          if (userData) {
            const role = userData.role as UserRole;

            // Check email verification for admin/staff (not customers)
            if (role && role !== "customer") {
              // Check if this is the first admin (allow login without verification for setup)
              if (role === "admin") {
                try {
                  const adminUsers = await getDocs(
                    query(collection(db, "users"), where("role", "==", "admin"))
                  );
                  const isFirstAdmin = adminUsers.size === 1;

                  // Allow first admin to login without verification for setup
                  if (!isFirstAdmin && !firebaseUser.emailVerified) {
                    // Block other admins/staff from logging in without verification
                    await signOut(auth);
                    setUser(null);
                    setLoading(false);
                    return;
                  }
                } catch (queryError: any) {
                  // If query fails (e.g., permission error), log but don't block
                  console.error("Error checking admin users in onAuthStateChanged:", queryError);
                  // Allow login to proceed if user document exists
                }
              } else if (!firebaseUser.emailVerified) {
                // Block staff from logging in without verification
                await signOut(auth);
                setUser(null);
                setLoading(false);
                return;
              }
            }
          }

          setUser(userData);
        } catch (error: any) {
          // If there's a permission error, log it but don't block completely
          if (error.code === "permission-denied" || error.message?.includes("permission")) {
            console.error("Firestore permission error in onAuthStateChanged:", error);
            // Still set user to null but don't sign out (might be a temporary issue)
            setUser(null);
          } else {
            // For other errors, still set user to null
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Reload user to get latest email verification status (important after email verification)
    await reloadFirebaseUser(user);

    // Check email verification for admin/staff
    // Allow first admin to login without verification for initial setup
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role as UserRole;

        // Check if this is the only admin (first admin)
        if (role === "admin") {
          try {
            const adminUsers = await getDocs(
              query(collection(db, "users"), where("role", "==", "admin"))
            );
            const isFirstAdmin = adminUsers.size === 1;

            // Allow first admin to login without verification for setup
            if (isFirstAdmin && !user.emailVerified) {
              // Don't block, but user should verify email soon
              console.warn("First admin logging in without email verification");
            } else if (!isFirstAdmin && !user.emailVerified) {
              // Block other admins/staff from logging in without verification
              await signOut(auth);
              throw new Error("Please verify your email before logging in. Check your inbox for the verification link.");
            }
          } catch (queryError: any) {
            // If query fails (e.g., permission error), log but don't block login
            console.error("Error checking admin users:", queryError);
            // Still allow login if user document exists and role is admin
            if (!user.emailVerified) {
              console.warn("Could not verify admin count, but allowing login for admin user");
            }
          }
        } else if (role !== "customer" && !user.emailVerified) {
          // Block staff from logging in without verification
          await signOut(auth);
          throw new Error("Please verify your email before logging in. Check your inbox for the verification link.");
        }
      } else {
        // User document doesn't exist - this shouldn't happen for employees
        console.warn("User document not found in Firestore for uid:", user.uid);
        throw new Error("User account not found. Please contact your administrator.");
      }
    } catch (error: any) {
      // If it's a permission error, provide a helpful message
      if (error.code === "permission-denied" || error.message?.includes("permission") || error.message?.includes("insufficient")) {
        console.error("Firestore permission error during login:", error);
        await signOut(auth);
        throw new Error("Permission denied. Please ensure your Firestore security rules allow authenticated users to read their own user document. Contact your administrator if this persists.");
      }
      // Re-throw other errors
      throw error;
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const createEmployee = async (
    email: string,
    password: string,
    role: UserRole,
    permissions: EmployeePermissions,
    displayName?: string,
    baseSalary?: number,
    employeeType?: any,
    contractEndDate?: any
  ): Promise<string> => {
    // Create Firebase Auth user using secondary instance to avoid logging out the admin
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const firebaseUser = userCredential.user;

    // Send email verification
    await sendEmailVerification(firebaseUser);

    // Create user document in Firestore with all employee data
    const userData: Omit<User, "id"> = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName,
      emailVerified: false,
      role,
      permissions,
      createdAt: serverTimestamp() as any,
      // Employee-specific fields
      baseSalary: baseSalary || 0,
      joiningDate: serverTimestamp() as any,
      status: "ACTIVE" as const,
      employeeType: employeeType || "FULL_TIME",
      contractEndDate: contractEndDate || null,
      finance: {
        currentAdvance: 0,
        unpaidCommissions: 0,
      },
    };

    await setDoc(doc(db, "users", firebaseUser.uid), userData);

    // Sign out from secondary auth immediately so it doesn't persist
    await signOut(secondaryAuth);

    // Note: Setting custom claims requires a Cloud Function
    // This will be handled separately via Firebase Admin SDK
    // For now, we store permissions in Firestore

    return firebaseUser.uid;
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    signIn,
    signOut: signOutUser,
    createEmployee,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

