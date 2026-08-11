"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ReturnService } from "@/lib/services/returnService";
import { VendorService } from "@/lib/services/vendorService";
import { RESOURCES, ACTIONS } from "@/lib/types";
import { SalesReturn } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";
import {
    RotateCcw,
    Plus,
    Search,
    Filter,
    Package,
    Building2,
    Calendar,
    ChevronRight,
    AlertCircle,
} from "lucide-react";

type TabType = "sales" | "vendor";

const REASON_LABELS: Record<string, string> = {
    DEFECTIVE: "Defective",
    WRONG_ITEM: "Wrong Item",
    CUSTOMER_CHANGED_MIND: "Changed Mind",
    WARRANTY: "Warranty",
    DAMAGED: "Damaged",
    OTHER: "Other",
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "bg-yellow-100", text: "text-yellow-700" },
    APPROVED: { bg: "bg-blue-100", text: "text-blue-700" },
    COMPLETED: { bg: "bg-green-100", text: "text-green-700" },
    REJECTED: { bg: "bg-red-100", text: "text-red-700" },
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

export default function ReturnsPage() {
    const [activeTab, setActiveTab] = useState<TabType>("sales");
    const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
    const [vendorReturns, setVendorReturns] = useState<
        Array<Record<string, any>>
    >([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [sourceFilter, setSourceFilter] = useState<string>("ALL");

    useEffect(() => {
        fetchReturns();
    }, []);

    const fetchReturns = async () => {
        setLoading(true);
        try {
            const [sales, vendor] = await Promise.all([
                ReturnService.getAllSalesReturns(),
                VendorService.getAllVendorReturns(),
            ]);
            setSalesReturns(sales);
            setVendorReturns(vendor);
        } catch (error) {
            console.error("Error fetching returns:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter sales returns
    const filteredSalesReturns = salesReturns.filter((ret) => {
        if (statusFilter !== "ALL" && ret.status !== statusFilter) return false;
        if (sourceFilter !== "ALL" && ret.source !== sourceFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesNumber = ret.returnNumber?.toLowerCase().includes(q);
            const matchesCustomer = ret.customerName?.toLowerCase().includes(q);
            const matchesItem = ret.items?.some((item) =>
                item.productName?.toLowerCase().includes(q)
            );
            if (!matchesNumber && !matchesCustomer && !matchesItem) return false;
        }
        return true;
    });

    // Filter vendor returns
    const filteredVendorReturns = vendorReturns.filter((ret) => {
        if (statusFilter !== "ALL" && ret.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesNumber = ret.returnNumber?.toLowerCase().includes(q);
            const matchesVendor = ret.vendorName?.toLowerCase().includes(q);
            const matchesItem = ret.items?.some((item: any) =>
                item.productName?.toLowerCase().includes(q)
            );
            if (!matchesNumber && !matchesVendor && !matchesItem) return false;
        }
        return true;
    });

    // Stats
    const totalSalesReturnAmount = salesReturns
        .filter((r) => r.status === "COMPLETED")
        .reduce((sum, r) => sum + r.totalReturnAmount, 0);
    const totalVendorReturnAmount = vendorReturns
        .filter((r: any) => r.status === "COMPLETED")
        .reduce((sum, r: any) => sum + (r.totalReturnAmount || 0), 0);

    return (
        <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.UPDATE }}>
            <AdminLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
                            <p className="text-gray-500 text-sm mt-1">
                                Manage sales returns and vendor returns
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href="/admin/returns/sales/new"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                <Plus className="h-4 w-4" />
                                Sales Return
                            </Link>
                            <Link
                                href="/admin/returns/vendor/new"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                            >
                                <Plus className="h-4 w-4" />
                                Vendor Return
                            </Link>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <Package className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Sales Returns</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {salesReturns.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <RotateCcw className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Sales Return Value</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {formatCurrency(totalSalesReturnAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-50 rounded-lg">
                                    <Building2 className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Vendor Returns</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {vendorReturns.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-lg">
                                    <Calendar className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Vendor Return Value</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {formatCurrency(totalVendorReturnAmount)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="flex border-b">
                            <button
                                onClick={() => { setActiveTab("sales"); setStatusFilter("ALL"); setSourceFilter("ALL"); }}
                                className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium transition-colors ${activeTab === "sales"
                                    ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50/50"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                <div className="flex items-center gap-2 justify-center">
                                    <Package className="h-4 w-4" />
                                    Sales Returns ({salesReturns.length})
                                </div>
                            </button>
                            <button
                                onClick={() => { setActiveTab("vendor"); setStatusFilter("ALL"); setSourceFilter("ALL"); }}
                                className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium transition-colors ${activeTab === "vendor"
                                    ? "border-b-2 border-orange-600 text-orange-600 bg-orange-50/50"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                <div className="flex items-center gap-2 justify-center">
                                    <Building2 className="h-4 w-4" />
                                    Vendor Returns ({vendorReturns.length})
                                </div>
                            </button>
                        </div>

                        {/* Filters */}
                        <div className="p-4 border-b bg-gray-50/50 flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={
                                        activeTab === "sales"
                                            ? "Search by return #, customer, or product..."
                                            : "Search by return #, vendor, or product..."
                                    }
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="REJECTED">Rejected</option>
                                </select>
                                {activeTab === "sales" && (
                                    <select
                                        value={sourceFilter}
                                        onChange={(e) => setSourceFilter(e.target.value)}
                                        className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ALL">All Sources</option>
                                        <option value="POS">POS</option>
                                        <option value="ONLINE">Online</option>
                                    </select>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="divide-y">
                            {loading ? (
                                <div className="p-12 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                                    <p className="text-gray-500 text-sm">Loading returns...</p>
                                </div>
                            ) : activeTab === "sales" ? (
                                filteredSalesReturns.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium">No sales returns found</p>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {searchQuery || statusFilter !== "ALL"
                                                ? "Try adjusting your filters"
                                                : "Sales returns will appear here when processed"}
                                        </p>
                                    </div>
                                ) : (
                                    filteredSalesReturns.map((ret) => {
                                        const statusStyle = STATUS_STYLES[ret.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <Link
                                                key={ret.id}
                                                href={`/admin/returns/sales/${ret.id}`}
                                                className="block p-4 hover:bg-blue-50/50 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-start sm:items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                                {ret.returnNumber}
                                                            </span>
                                                            <span
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                                                            >
                                                                {ret.status}
                                                            </span>
                                                            <span
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ret.source === "POS"
                                                                    ? "bg-purple-100 text-purple-700"
                                                                    : "bg-teal-100 text-teal-700"
                                                                    }`}
                                                            >
                                                                {ret.source}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                                                            {ret.customerName && (
                                                                <span>Customer: {ret.customerName}</span>
                                                            )}
                                                            <span>
                                                                {ret.items.length} item{ret.items.length > 1 ? "s" : ""}
                                                            </span>
                                                            <span>{REASON_LABELS[ret.reason] || ret.reason}</span>
                                                            <span>{formatDate(ret.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="text-right">
                                                            <p className="font-semibold text-gray-900">
                                                                {formatCurrency(ret.totalReturnAmount)}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {ret.refundMethod}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )
                            ) : // Vendor Returns Tab
                                filteredVendorReturns.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium">No vendor returns found</p>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {searchQuery || statusFilter !== "ALL"
                                                ? "Try adjusting your filters"
                                                : "Vendor returns will appear here when processed"}
                                        </p>
                                    </div>
                                ) : (
                                    filteredVendorReturns.map((ret) => {
                                        const statusStyle = STATUS_STYLES[ret.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <Link
                                                key={ret.id}
                                                href={`/admin/returns/vendor/${ret.id}`}
                                                className="block p-4 hover:bg-orange-50/50 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-start sm:items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-sm font-medium text-gray-900">
                                                                {ret.returnNumber}
                                                            </span>
                                                            <span
                                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                                                            >
                                                                {ret.status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                                                            <span>Vendor: {ret.vendorName}</span>
                                                            <span>
                                                                {ret.items?.length || 0} item{(ret.items?.length || 0) > 1 ? "s" : ""}
                                                            </span>
                                                            <span>{REASON_LABELS[ret.reason] || ret.reason}</span>
                                                            <span>
                                                                {ret.createdAt ? formatDate(ret.createdAt) : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="text-right">
                                                            <p className="font-semibold text-gray-900">
                                                                {formatCurrency(ret.totalReturnAmount || 0)}
                                                            </p>
                                                            {ret.creditNoteNumber && (
                                                                <p className="text-xs text-gray-500 mt-0.5">
                                                                    CN: {ret.creditNoteNumber}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                        </div>
                    </div>
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
