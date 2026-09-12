"use client";

import { StoreAuthProvider } from "@/contexts/StoreAuthContext";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreAuthProvider>{children}</StoreAuthProvider>;
}

