"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmailVerification, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isVerificationError, setIsVerificationError] = useState(false);

  const handleResendVerification = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    if (!password) {
      setError("Please enter your password to resend verification email");
      return;
    }

    setResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      // Try to sign in to get the user (even if email is not verified)
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user.emailVerified) {
        setError("Your email is already verified. You can login now.");
        await auth.signOut();
        setIsVerificationError(false);
        return;
      }

      // Send verification email
      await sendEmailVerification(user, {
        url: window.location.origin + "/login",
        handleCodeInApp: false,
      });

      await auth.signOut();
      setResendSuccess(true);
      setError(null);
      setIsVerificationError(true); // Keep showing the button
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email address.");
        setIsVerificationError(false);
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please check your password.");
        setIsVerificationError(false);
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a few minutes before trying again.");
        setIsVerificationError(true);
      } else {
        setError(err.message || "Failed to resend verification email. Please try again.");
        setIsVerificationError(true);
      }
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendSuccess(false);
    setIsVerificationError(false);

    try {
      // Sign in first to get authentication token
      // The signIn function in AuthContext will handle all verification checks
      await signIn(email, password);

      // Get user data to determine redirect destination
      // Wait a moment for the auth context to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get the current user from auth
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Fetch user document to get role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role as UserRole;
          console.log('userData', userData);
          // Redirect based on role
          if (role === "admin") {
            router.push("/admin");
          } else if (role === "staff" || role === "manager") {
            router.push("/admin/hr/attendance");
          } else {
            // Default to admin for unknown roles
            router.push("/admin");
          }
        } else {
          // If user document doesn't exist, default to admin
          router.push("/admin");
        }
      } else {
        // Fallback to admin if user not found
        router.push("/admin");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to sign in";

      // Check if it's a verification error
      if (
        errorMessage.toLowerCase().includes("verify") ||
        errorMessage.toLowerCase().includes("verification") ||
        errorMessage.toLowerCase().includes("email not verified")
      ) {
        setIsVerificationError(true);
        setError(
          errorMessage + " Use the 'Resend Verification Email' button below if you didn't receive it."
        );
      } else if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("insufficient")) {
        // Handle Firestore permission errors
        setIsVerificationError(false);
        setError("Authentication error. Please check your credentials and try again. If the problem persists, contact your administrator.");
        console.error("Permission error during login:", err);
      } else {
        setIsVerificationError(false);
        setError(errorMessage);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your credentials to access the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
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
            {resendSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
                ✓ Verification email sent! Please check your inbox (and spam folder). The email may take a few minutes to arrive.
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Show resend button when there's a verification error or after successful resend */}
          {(isVerificationError || resendSuccess) && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600 mb-2">
                {resendSuccess
                  ? "Still didn't receive it? Try resending again:"
                  : "Didn't receive the verification email?"}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVerification}
                disabled={resending || !email || !password}
                className="w-full"
              >
                {resending ? "Sending..." : "Resend Verification Email"}
              </Button>
              {resendSuccess && (
                <p className="mt-2 text-xs text-gray-500 text-center">
                  If you still don't receive it, check your spam folder or wait a few minutes.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600">
            <p className="font-semibold mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Check your spam/junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>Wait a few minutes - emails can be delayed</li>
              <li>First admin can login without verification for setup</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

