"use client";

import { Button } from "@/components/ui/button";
import { Percent, XCircle } from "lucide-react";

interface DiscountSectionProps {
  discount: number;
  hasPermission: boolean;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
}

export function DiscountSection({
  discount,
  hasPermission,
  onApplyDiscount,
  onRemoveDiscount,
}: DiscountSectionProps) {
  return (
    <>
      <div className="flex justify-between text-sm items-center">
        <span>Discount:</span>
        <div className="flex items-center gap-2">
          {discount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onRemoveDiscount}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
          <span>Rs {discount.toFixed(2)}</span>
        </div>
      </div>
      {hasPermission && (
        <Button
          variant="outline"
          size="sm"
          onClick={onApplyDiscount}
          className="w-full"
        >
          <Percent className="mr-2 h-4 w-4" />
          {discount > 0 ? "Edit Discount" : "Apply Discount"}
        </Button>
      )}
    </>
  );
}

