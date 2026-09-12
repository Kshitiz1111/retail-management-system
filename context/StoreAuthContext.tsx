"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Customer } from "@/lib/types";

interface StoreAuthContextType {
  customer: Customer | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const StoreAuthContext = createContext<StoreAuthContextType | undefined>(undefined);

export function StoreAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        // Check if user is a customer (has customer document)
        try {
          const customerDoc = await getDoc(doc(db, "customers", user.uid));
          if (customerDoc.exists()) {
            setCustomer({ id: customerDoc.id, ...customerDoc.data() } as Customer);
          } else {
            // User exists but not a customer - sign them out
            await firebaseSignOut(auth);
            setCustomer(null);
          }
        } catch (error: any) {
          console.error("Error fetching customer data:", error);
          // If permission denied, sign out the user
          if (error?.code === "permission-denied") {
            await firebaseSignOut(auth);
          }
          setCustomer(null);
        }
      } else {
        setCustomer(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    name: string,
    phone: string
  ): Promise<void> => {
    try {
      // Create Firebase auth user (no email verification required)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create customer document
      const customerData: Omit<Customer, "id"> = {
        name,
        phone,
        email,
        loyaltyPoints: 0,
        totalSpent: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "customers", user.uid), customerData);

      // Customer will be set via onAuthStateChanged
    } catch (error: any) {
      console.error("Error signing up:", error);
      throw new Error(error.message || "Failed to sign up");
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Customer will be set via onAuthStateChanged
    } catch (error: any) {
      console.error("Error signing in:", error);
      throw new Error(error.message || "Failed to sign in");
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      setCustomer(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <StoreAuthContext.Provider
      value={{
        customer,
        firebaseUser,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </StoreAuthContext.Provider>
  );
}

export function useStoreAuth() {
  const context = useContext(StoreAuthContext);
  if (context === undefined) {
    throw new Error("useStoreAuth must be used within a StoreAuthProvider");
  }
  return context;
}

