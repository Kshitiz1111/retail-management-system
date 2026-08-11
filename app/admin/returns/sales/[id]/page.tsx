"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ReturnService } from "@/lib/services/returnService";
import { ROLES, RESOURCES, ACTIONS, Customer, Sale, SalesReturn, PaymentMethod } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import {
    ArrowLeft,
    Package,
    ShoppingCart,
    ShoppingBag,
    Calendar,
    User,
    CreditCard,
    FileText,
    Image as ImageIcon,
    AlertCircle,
    CheckCircle2,
    Loader2,
    DownloadCloud,
} from "lucide-react";
import { ImageGalleryDialog } from "@/components/ui/ImageGalleryDialog";
import { Button } from "@/components/ui/button";

const REASON_LABELS: Record<string, string> = {
    DEFECTIVE: "Defective",
    WRONG_ITEM: "Wrong Item",
    CUSTOMER_CHANGED_MIND: "Changed Mind",
    WARRANTY: "Warranty",
    DAMAGED: "Damaged",
    OTHER: "Other",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
    APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
    COMPLETED: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
};

function formatDate(timestamp: Timestamp | undefined): string {
    if (!timestamp) return "—";
    const date = timestamp.toDate();
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatCurrency(amount: number): string {
    return `Rs ${amount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;
}

export default function SalesReturnDetailPage() {
    const params = useParams();
    const router = useRouter();
    const returnId = params.id as string;

    const [returnData, setReturnData] = useState<SalesReturn | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const allEvidenceUrls = [
        ...(returnData?.reasonImageUrls || [])
    ];

    useEffect(() => {
        if (!returnId) return;
        const fetchReturn = async () => {
            setLoading(true);
            try {
                const data = await ReturnService.getSalesReturn(returnId);
                if (!data) {
                    setError("Return not found");
                } else {
                    setReturnData(data);
                }
            } catch (err) {
                console.error("Error fetching return:", err);
                setError("Failed to load return details");
            } finally {
                setLoading(false);
            }
        };
        fetchReturn();
    }, [returnId]);

    if (loading) {
        return (
            <ProtectedRoute requiredPermission={{ resource: RESOURCES.SALES_RETURNS, action: ACTIONS.VIEW }}>
                <AdminLayout>
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                </AdminLayout>
            </ProtectedRoute>
        );
    }

    if (error || !returnData) {
        return (
            <ProtectedRoute requiredPermission={{ resource: RESOURCES.SALES_RETURNS, action: ACTIONS.VIEW }}>
                <AdminLayout>
                    <div className="max-w-2xl mx-auto text-center py-16">
                        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-700">{error || "Return not found"}</h2>
                        <Link
                            href="/admin/returns"
                            className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to Returns
                        </Link>
                    </div>
                </AdminLayout>
            </ProtectedRoute>
        );
    }

    const statusStyle = STATUS_STYLES[returnData.status] || STATUS_STYLES.PENDING;

    const handleDownloadAll = async () => {
        if (!allEvidenceUrls.length) return;

        for (let i = 0; i < allEvidenceUrls.length; i++) {
            const url = allEvidenceUrls[i];
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = `evidence-${returnData.returnNumber}-${i + 1}-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error("Error downloading image:", error);
            }
        }
    };

    return (
        <ProtectedRoute requiredRole={ROLES.STAFF} requiredPermission={{ resource: RESOURCES.SALES_RETURNS, action: ACTIONS.VIEW }}>
            <AdminLayout>
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/returns"
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {returnData.returnNumber}
                                </h1>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                    {statusStyle.label}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Sales Return • {returnData.source === "POS" ? "POS Sale" : "Online Order"}
                            </p>
                        </div>
                    </div>

                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl border p-3">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Date</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                                {formatDate(returnData.createdAt)}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl border p-3">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                {returnData.source === "POS"
                                    ? <ShoppingCart className="h-3.5 w-3.5" />
                                    : <ShoppingBag className="h-3.5 w-3.5" />
                                }
                                <span className="text-xs font-medium">Source</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                                {returnData.source === "POS"
                                    ? `#${(returnData.originalSaleId || "").slice(0, 8)}...`
                                    : `Order #${returnData.originalOrderNumber || (returnData.originalOrderId || "").slice(0, 8)}`
                                }
                            </p>
                        </div>
                        <div className="bg-white rounded-xl border p-3">
                            <div className="flex items-center gap-2 text-gray-500 mb-1">
                                <CreditCard className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Refund</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">
                                {returnData.refundMethod}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl border p-3">
                            <div className="flex items-center gap-2 text-red-500 mb-1">
                                <Package className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">
                                    {(returnData.creditAdjustment || 0) > 0 ? "Actual Refund" : "Total"}
                                </span>
                            </div>
                            <p className="text-lg font-bold text-red-600">
                                {formatCurrency(returnData.cashRefundAmount ?? returnData.totalReturnAmount)}
                            </p>
                        </div>
                    </div>

                    {/* Customer Info */}
                    {(returnData.customerName || returnData.customerId) && (
                        <div className="bg-white rounded-xl border p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="h-4 w-4 text-gray-500" />
                                <h3 className="text-sm font-semibold text-gray-800">Customer</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-sm font-medium text-blue-600">
                                        {(returnData.customerName || "?")[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {returnData.customerName || "Unnamed Customer"}
                                    </p>
                                    {returnData.customerId && (
                                        <p className="text-xs text-gray-500">ID: {returnData.customerId}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items Returned */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="p-4 border-b bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-800">
                                Items Returned ({returnData.items.length})
                            </h3>
                        </div>
                        <div className="divide-y">
                            {returnData.items.map((item, idx) => (
                                <div key={`${item.productId}-${idx}`} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                                        <div className="flex gap-4 mt-1">
                                            <span className="text-xs text-gray-500">SKU: {item.sku}</span>
                                            <span className="text-xs text-gray-500">
                                                Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                                            </span>
                                        </div>
                                        {item.reason && (
                                            <p className="text-xs text-orange-600 mt-1">
                                                Reason: {REASON_LABELS[item.reason] || item.reason}
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {formatCurrency(item.subtotal)}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {/* Totals */}
                        <div className="p-4 border-t bg-red-50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-red-700">Total Return Amount</span>
                                <span className="text-lg font-bold text-red-700">
                                    {formatCurrency(returnData.totalReturnAmount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Reason & Details */}
                    <div className="bg-white rounded-xl border p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            Return Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Reason</p>
                                <p className="text-sm font-medium text-gray-900 mt-0.5">
                                    {REASON_LABELS[returnData.reason] || returnData.reason}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Refund Method</p>
                                <p className="text-sm font-medium text-gray-900 mt-0.5">
                                    {returnData.refundMethod}
                                </p>
                            </div>
                        </div>

                        {returnData.reasonNotes && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase font-medium">Notes</p>
                                <p className="text-sm text-gray-700 mt-0.5 bg-gray-50 p-2 rounded-lg">
                                    {returnData.reasonNotes}
                                </p>
                            </div>
                        )}

                        {allEvidenceUrls.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-gray-500 uppercase font-medium">Evidence Photos</p>
                                    {allEvidenceUrls.length > 1 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-2 text-[10px]"
                                            onClick={handleDownloadAll}
                                        >
                                            <DownloadCloud className="h-3 w-3" />
                                            Download All ({allEvidenceUrls.length})
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {allEvidenceUrls.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={url}
                                                alt={`Return evidence ${index + 1}`}
                                                className="h-32 w-32 object-cover rounded-lg border shadow-sm cursor-zoom-in group-hover:opacity-90 transition-all"
                                                onClick={() => {
                                                    setGalleryIndex(index);
                                                    setGalleryOpen(true);
                                                }}
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                <div className="bg-black/40 text-white px-2 py-1 rounded-md text-[10px] font-medium backdrop-blur-sm">
                                                    View
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <ImageGalleryDialog
                                    imageUrls={allEvidenceUrls}
                                    initialIndex={galleryIndex}
                                    altPrefix="Evidence Photo"
                                    open={galleryOpen}
                                    onOpenChange={setGalleryOpen}
                                />
                            </div>
                        )}
                    </div>

                    {/* Adjustments Made */}
                    {(returnData.loyaltyPointsReversed || returnData.creditAdjustment) && (
                        <div className="bg-white rounded-xl border p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Adjustments Applied
                            </h3>
                            <div className="space-y-2">
                                {returnData.loyaltyPointsReversed && returnData.loyaltyPointsReversed > 0 && (
                                    <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-600">Loyalty Points Reversed</span>
                                        <span className="text-sm font-medium text-orange-600">
                                            -{returnData.loyaltyPointsReversed} pts
                                        </span>
                                    </div>
                                )}
                                {returnData.creditAdjustment && returnData.creditAdjustment > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                                            <span className="text-sm text-gray-600">Credit Adjustment (Deducted)</span>
                                            <span className="text-sm font-medium text-red-600">
                                                -{formatCurrency(returnData.creditAdjustment)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <span className="text-sm font-medium text-blue-700">Actual {returnData.refundMethod} Refund</span>
                                            <span className="text-sm font-bold text-blue-700">
                                                {formatCurrency(returnData.cashRefundAmount ?? (returnData.totalReturnAmount - returnData.creditAdjustment))}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="bg-gray-50 rounded-xl border p-4">
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                                <span className="uppercase font-medium">Return ID</span>
                                <p className="text-gray-700 mt-0.5 font-mono text-[11px]">{returnData.id}</p>
                            </div>
                            <div>
                                <span className="uppercase font-medium">Processed By</span>
                                <p className="text-gray-700 mt-0.5 font-mono text-[11px]">{returnData.processedBy}</p>
                            </div>
                            <div>
                                <span className="uppercase font-medium">Created At</span>
                                <p className="text-gray-700 mt-0.5">{formatDate(returnData.createdAt)}</p>
                            </div>
                            {returnData.completedAt && (
                                <div>
                                    <span className="uppercase font-medium">Completed At</span>
                                    <p className="text-gray-700 mt-0.5">{formatDate(returnData.completedAt)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
