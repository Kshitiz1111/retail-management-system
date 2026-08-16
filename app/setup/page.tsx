"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserRole, EmployeePermissions, RESOURCES, ACTIONS } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";

const adminPermissions: EmployeePermissions = {
  resources: {
    [RESOURCES.INVENTORY]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.FINANCE]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.CUSTOMERS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
      [ACTIONS.VIEW_CREDITS]: true,
      [ACTIONS.SETTLE_CREDITS]: true,
    },
    [RESOURCES.EMPLOYEES]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.VENDORS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.POS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
      [ACTIONS.APPLY_DISCOUNT]: true,
    },
    [RESOURCES.REPORTS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.ORDERS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.SALES_RETURNS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.PURCHASE_RETURNS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.HR]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
    [RESOURCES.SETTINGS]: {
      [ACTIONS.VIEW]: true,
      [ACTIONS.CREATE]: true,
      [ACTIONS.UPDATE]: true,
      [ACTIONS.DELETE]: true,
    },
  },
};

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    confirmPassword: "",
  });



  const checkIfSetupNeeded = async () => {
    try {
      const snap = await getDoc(doc(db, "config", "app"));

      if (snap.exists() && snap.data().setupComplete) {
        setSetupComplete(true);
        router.push("/login");
      }
    } catch (error) {
      console.error("Error checking setup status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkIfSetupNeeded();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setCreating(true);

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const firebaseUser = userCredential.user;

      // Send email verification
      await sendEmailVerification(firebaseUser);

      // Create user document in Firestore with all employee data
      const userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: formData.displayName,
        emailVerified: false,
        role: "admin" as UserRole,
        permissions: adminPermissions,
        createdAt: serverTimestamp(),
        // Employee-specific fields
        baseSalary: 0,
        joiningDate: serverTimestamp(),
        status: "ACTIVE" as const,
        finance: {
          currentAdvance: 0,
          unpaidCommissions: 0,
        },
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userData);

      await setDoc(
        doc(db, "config", "app"),
        { setupComplete: true },
        { merge: true }
      );
      // Show success message with instructions
      const message = `Admin account created successfully!\n\n` +
        `IMPORTANT:\n` +
        `1. Check your email inbox (and spam folder) for the verification link\n` +
        `2. As the first admin, you can login immediately even without verification\n` +
        `3. However, please verify your email soon for security\n\n` +
        `You can now proceed to login.`;

      alert(message);
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to create admin account");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Checking setup status...</div>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Setup Complete</CardTitle>
            <CardDescription>An admin account already exists</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">The system has already been set up. Please login with your admin credentials.</p>
            <Button onClick={() => router.push("/login")} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Initial Setup</CardTitle>
          <CardDescription>Create your first admin account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                placeholder="John Doe"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Re-enter your password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? "Creating Admin Account..." : "Create Admin Account"}
            </Button>
          </form>
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-semibold mb-2">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You'll receive an email verification link (check spam folder if not received)</li>
              <li>As the first admin, you can login immediately for setup</li>
              <li>Please verify your email soon for security</li>
              <li>This is a one-time setup process</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              If you don't receive the email, you can still login and use the "Resend Verification Email" button on the login page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

