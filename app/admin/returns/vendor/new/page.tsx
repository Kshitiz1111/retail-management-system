"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VendorService } from "@/lib/services/vendorService";
import { ProductService } from "@/lib/services/productService";
import { ImageService } from "@/lib/services/imageService";
import { Vendor, PurchaseOrder, ReturnReason, Product } from "@/lib/types";
import { RESOURCES, ACTIONS } from "@/lib/types";
import {
    ArrowLeft,
    ArrowRight,
    Search,
    CheckCircle2,
    AlertTriangle,
    Upload,
    X,
    Building2,
    Minus,
    Plus,
} from "lucide-react";
import Link from "next/link";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

type Step = 1 | 2 | 3 | 4;

const REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
    { value: "DEFECTIVE", label: "Defective / Malfunctioning" },
    { value: "WRONG_ITEM", label: "Wrong Item Received" },
    { value: "DAMAGED", label: "Damaged in Transit" },
    { value: "WARRANTY", label: "Warranty Return" },
    { value: "OTHER", label: "Other" },
];

function formatCurrency(amount: number): string {
    return `Rs ${amount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;
}

export default function NewVendorReturnPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState<Step>(1);
    const [processing, setProcessing] = useState(false);

    // Step 1: Select Vendor
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [vendorSearch, setVendorSearch] = useState("");
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [loadingVendors, setLoadingVendors] = useState(true);

    // Step 2: Select Items
    const [returnItems, setReturnItems] = useState<
        Record<string, { qty: number; warehouseId: string }>
    >({});
    const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
    const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
    // Maps productId -> { warehouseId -> quantity } for showing stock info
    const [productStockMap, setProductStockMap] = useState<Record<string, Record<string, number>>>({});

    // Step 3: Details
    const [reason, setReason] = useState<ReturnReason>("DEFECTIVE");
    const [reasonNotes, setReasonNotes] = useState("");
    const [creditNoteNumber, setCreditNoteNumber] = useState("");
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // Load vendors and warehouses
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [vendorList] = await Promise.all([
                    VendorService.getAllVendors(),
                ]);
                setVendors(vendorList);

                // Fetch warehouses
                const whSnapshot = await getDocs(query(collection(db, "warehouses")));
                const wh: Array<{ id: string; name: string }> = [];
                whSnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.isActive !== false) {
                        wh.push({ id: doc.id, name: data.name || doc.id });
                    }
                });
                setWarehouses(wh);
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setLoadingVendors(false);
            }
        };
        fetchData();
    }, []);

    const filteredVendors = vendors.filter((v) =>
        vendorSearch
            ? v.companyName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
            v.contactPerson?.toLowerCase().includes(vendorSearch.toLowerCase())
            : true
    );

    // When vendor is selected, fetch their purchase orders
    const handleSelectVendor = async (vendor: Vendor) => {
        setSelectedVendor(vendor);
        try {
            const allPOs = await VendorService.getAllPurchaseOrders();
            // Filter to this vendor's received POs (that have items to return)
            const receivedPOs = allPOs.filter(
                (po: PurchaseOrder) => po.vendorId === vendor.id && po.status === "RECEIVED"
            );
            setPurchaseOrders(receivedPOs);
        } catch (error) {
            console.error("Error fetching POs:", error);
        }
    };

    // Select PO and move to step 2
    const handleSelectPO = async (po: PurchaseOrder) => {
        setSelectedPO(po);

        // Get already-returned quantities for this PO
        const returned = await VendorService.getReturnedVendorQuantities(po.id);
        setAlreadyReturned(returned);

        // Fetch each product to find the warehouse with stock
        const stockMap: Record<string, Record<string, number>> = {};
        const initial: Record<string, { qty: number; warehouseId: string }> = {};
        const defaultWarehouse = warehouses[0]?.id || "default";

        for (const item of po.items) {
            const product = await ProductService.getProduct(item.productId);
            if (product && product.warehouses) {
                // Store stock info per warehouse for this product
                const warehouseStock: Record<string, number> = {};
                let bestWarehouseId = defaultWarehouse;
                let bestQty = 0;

                for (const [whId, whData] of Object.entries(product.warehouses)) {
                    const qty = whData.quantity || 0;
                    warehouseStock[whId] = qty;
                    if (qty > bestQty) {
                        bestQty = qty;
                        bestWarehouseId = whId;
                    }
                }
                stockMap[item.productId] = warehouseStock;
                initial[item.productId] = { qty: 0, warehouseId: bestWarehouseId };
            } else {
                initial[item.productId] = { qty: 0, warehouseId: defaultWarehouse };
            }
        }

        setProductStockMap(stockMap);
        setReturnItems(initial);
        setStep(2);
    };

    const getReturnableItems = () => {
        if (!selectedPO) return [];
        return selectedPO.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.receivedQuantity || item.quantity,
            unitPrice: item.receivedUnitPrice || item.unitPrice,
        }));
    };

    const buildReturnItemsList = () => {
        return getReturnableItems()
            .filter((item) => (returnItems[item.productId]?.qty || 0) > 0)
            .map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: returnItems[item.productId].qty,
                unitPrice: item.unitPrice,
                subtotal: returnItems[item.productId].qty * item.unitPrice,
                warehouseId: returnItems[item.productId].warehouseId,
            }));
    };

    const totalReturnAmount = buildReturnItemsList().reduce(
        (sum, item) => sum + item.subtotal,
        0
    );
    const hasSelectedItems = buildReturnItemsList().length > 0;

    // Image handling
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newFiles = [...imageFiles, ...files];
        setImageFiles(newFiles);

        // Generate previews for new files
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews((prev) => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });

        // Reset input so same file can be picked again
        e.target.value = "";
    };

    const removeImage = (index: number) => {
        setImageFiles((prev) => prev.filter((_, i) => i !== index));
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    // Process the vendor return
    const handleSubmit = async () => {
        if (!selectedVendor || !user) return;
        setProcessing(true);

        try {
            // Upload images if provided
            let reasonImageUrls: string[] = [];
            if (imageFiles.length > 0) {
                reasonImageUrls = await Promise.all(
                    imageFiles.map(file => ImageService.uploadImage(file, "vendor-returns"))
                );
            }

            await VendorService.createVendorReturn({
                vendorId: selectedVendor.id,
                vendorName: selectedVendor.companyName,
                originalPurchaseOrderId: selectedPO?.id,
                items: buildReturnItemsList(),
                reason,
                reasonNotes: reasonNotes || undefined,
                reasonImageUrls: reasonImageUrls.length > 0 ? reasonImageUrls : undefined,
                creditNoteNumber: creditNoteNumber || undefined,
                processedBy: user.uid,
            });

            router.push("/admin/returns");
        } catch (error) {
            console.error("Error processing vendor return:", error);
            alert("Failed to process vendor return. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ProtectedRoute requiredPermission={{ resource: RESOURCES.VENDORS, action: ACTIONS.UPDATE }}>
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
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                New Vendor Return
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Return items to a vendor from a purchase order
                            </p>
                        </div>
                    </div>

                    {/* Step Progress */}
                    <div className="flex items-center gap-2 px-1">
                        {[
                            { num: 1, label: "Vendor & PO" },
                            { num: 2, label: "Select Items" },
                            { num: 3, label: "Details" },
                            { num: 4, label: "Confirm" },
                        ].map((s, i) => (
                            <div key={s.num} className="flex items-center flex-1">
                                <div
                                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${step >= s.num
                                        ? "bg-orange-600 text-white"
                                        : "bg-gray-200 text-gray-500"
                                        }`}
                                >
                                    {step > s.num ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        s.num
                                    )}
                                </div>
                                <span
                                    className={`ml-2 text-xs font-medium hidden sm:inline ${step >= s.num ? "text-orange-700" : "text-gray-400"
                                        }`}
                                >
                                    {s.label}
                                </span>
                                {i < 3 && (
                                    <div
                                        className={`flex-1 h-0.5 mx-2 ${step > s.num ? "bg-orange-600" : "bg-gray-200"
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Select Vendor & PO */}
                    {step === 1 && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50">
                                <h2 className="font-semibold text-gray-800">Select Vendor</h2>
                            </div>

                            {/* Vendor Search */}
                            <div className="p-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search vendors by name..."
                                        value={vendorSearch}
                                        onChange={(e) => setVendorSearch(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>

                                {/* Vendor list or selected vendor */}
                                {selectedVendor ? (
                                    <div className="mt-4 space-y-3">
                                        <div className="p-3 rounded-lg border border-orange-300 bg-orange-50/50 flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {selectedVendor.companyName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {selectedVendor.contactPerson} •{" "}
                                                    {selectedVendor.phone}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Balance (AP): {formatCurrency(selectedVendor.balance)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedVendor(null);
                                                    setSelectedPO(null);
                                                    setPurchaseOrders([]);
                                                }}
                                                className="text-xs text-orange-600 hover:underline"
                                            >
                                                Change
                                            </button>
                                        </div>

                                        {/* Purchase Orders */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">
                                                Select Purchase Order
                                            </p>
                                            {purchaseOrders.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-4">
                                                    No received purchase orders for this vendor
                                                </p>
                                            ) : (
                                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                    {purchaseOrders.map((po) => (
                                                        <button
                                                            key={po.id}
                                                            onClick={() => handleSelectPO(po)}
                                                            className="w-full text-left p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-medium text-sm">
                                                                        PO #{po.id.slice(0, 8)}...
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                                        {po.items.length} items • Received{" "}
                                                                        {po.receivedAt
                                                                            ? new Date(
                                                                                po.receivedAt.toDate()
                                                                            ).toLocaleDateString()
                                                                            : ""}
                                                                    </p>
                                                                </div>
                                                                <p className="text-sm font-semibold">
                                                                    {formatCurrency(
                                                                        po.receivedTotalAmount || po.totalAmount
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                                        {loadingVendors ? (
                                            <div className="text-center py-8">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto"></div>
                                            </div>
                                        ) : filteredVendors.length === 0 ? (
                                            <p className="text-center py-8 text-gray-500 text-sm">
                                                No vendors found
                                            </p>
                                        ) : (
                                            filteredVendors.map((vendor) => (
                                                <button
                                                    key={vendor.id}
                                                    onClick={() => handleSelectVendor(vendor)}
                                                    className="w-full text-left p-3 rounded-lg border hover:border-orange-300 hover:bg-orange-50/30 transition-colors"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium text-sm">
                                                                {vendor.companyName}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {vendor.contactPerson} • {vendor.phone}
                                                            </p>
                                                        </div>
                                                        <Building2 className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Items */}
                    {step === 2 && selectedPO && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50">
                                <h2 className="font-semibold text-gray-800">
                                    Select Items to Return
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Choose which items and quantities to return to{" "}
                                    {selectedVendor?.companyName}
                                </p>
                            </div>
                            <div className="p-4 space-y-2">
                                {getReturnableItems().map((item) => {
                                    const returnable =
                                        item.quantity - (alreadyReturned[item.productId] || 0);
                                    const selectedQty = returnItems[item.productId]?.qty || 0;

                                    if (returnable <= 0) {
                                        return (
                                            <div
                                                key={item.productId}
                                                className="p-3 bg-gray-50 rounded-lg opacity-60"
                                            >
                                                <p className="font-medium text-gray-700 text-sm">
                                                    {item.productName}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    All items already returned
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={item.productId}
                                            className={`p-3 rounded-lg border transition-colors ${selectedQty > 0
                                                ? "border-orange-300 bg-orange-50/50"
                                                : "border-gray-200"
                                                }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 text-sm">
                                                        {item.productName}
                                                    </p>
                                                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                                        <span>
                                                            Cost: {formatCurrency(item.unitPrice)}
                                                        </span>
                                                        <span>Received: {item.quantity}</span>
                                                        {(alreadyReturned[item.productId] || 0) > 0 && (
                                                            <span className="text-orange-600">
                                                                Returned:{" "}
                                                                {alreadyReturned[item.productId]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {warehouses.length > 1 && selectedQty > 0 && (
                                                        <select
                                                            value={
                                                                returnItems[item.productId]?.warehouseId || ""
                                                            }
                                                            onChange={(e) =>
                                                                setReturnItems((prev) => ({
                                                                    ...prev,
                                                                    [item.productId]: {
                                                                        ...prev[item.productId],
                                                                        warehouseId: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            className="text-xs px-2 py-1 border rounded bg-white"
                                                        >
                                                            {warehouses.map((w) => {
                                                                const stockQty = productStockMap[item.productId]?.[w.id] ?? 0;
                                                                return (
                                                                    <option key={w.id} value={w.id}>
                                                                        {w.name} (Stock: {stockQty})
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() =>
                                                                setReturnItems((prev) => ({
                                                                    ...prev,
                                                                    [item.productId]: {
                                                                        ...prev[item.productId],
                                                                        qty: Math.max(0, selectedQty - 1),
                                                                    },
                                                                }))
                                                            }
                                                            disabled={selectedQty === 0}
                                                            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                                        >
                                                            <Minus className="h-3.5 w-3.5" />
                                                        </button>
                                                        <span className="w-8 text-center text-sm font-medium">
                                                            {selectedQty}
                                                        </span>
                                                        <button
                                                            onClick={() =>
                                                                setReturnItems((prev) => ({
                                                                    ...prev,
                                                                    [item.productId]: {
                                                                        ...prev[item.productId],
                                                                        qty: Math.min(returnable, selectedQty + 1),
                                                                    },
                                                                }))
                                                            }
                                                            disabled={selectedQty >= returnable}
                                                            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </button>
                                                        <span className="text-xs text-gray-400 ml-1">
                                                            / {returnable}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedQty > 0 && (
                                                <div className="mt-2 text-right">
                                                    <span className="text-sm font-medium text-orange-700">
                                                        Return: {formatCurrency(selectedQty * item.unitPrice)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">
                                        {buildReturnItemsList().length} item(s) selected
                                    </p>
                                    <p className="text-lg font-bold text-gray-900">
                                        Total: {formatCurrency(totalReturnAmount)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => setStep(3)}
                                        disabled={!hasSelectedItems}
                                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        Next <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Return Details */}
                    {step === 3 && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50">
                                <h2 className="font-semibold text-gray-800">Return Details</h2>
                            </div>
                            <div className="p-4 space-y-5">
                                {/* Reason */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Reason for Return *
                                    </label>
                                    <select
                                        value={reason}
                                        onChange={(e) =>
                                            setReason(e.target.value as ReturnReason)
                                        }
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500"
                                    >
                                        {REASON_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Additional Notes
                                    </label>
                                    <textarea
                                        value={reasonNotes}
                                        onChange={(e) => setReasonNotes(e.target.value)}
                                        placeholder="Details about the return..."
                                        rows={3}
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 resize-none"
                                    />
                                </div>

                                {/* Credit Note Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Vendor Credit Note # (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={creditNoteNumber}
                                        onChange={(e) => setCreditNoteNumber(e.target.value)}
                                        placeholder="e.g., CN-2024-001"
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Evidence Photos (Optional)
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {imagePreviews.map((preview, index) => (
                                            <div key={index} className="relative inline-block">
                                                <img
                                                    src={preview}
                                                    alt={`Evidence ${index + 1}`}
                                                    className="h-32 w-32 object-cover rounded-lg border"
                                                />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="flex items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50/50 transition-colors">
                                            <div className="flex flex-col items-center gap-1 text-gray-400">
                                                <Upload className="h-6 w-6" />
                                                <span className="text-[10px]">Add Photo</span>
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleImageChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t bg-gray-50 flex justify-between">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(4)}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors flex items-center gap-2"
                                >
                                    Review <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review & Confirm */}
                    {step === 4 && selectedVendor && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-amber-50">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                    <h2 className="font-semibold text-gray-800">
                                        Review & Confirm Vendor Return
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">
                                    Review all details. This action cannot be undone.
                                </p>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Vendor Info */}
                                <div className="p-3 rounded-lg bg-gray-50">
                                    <p className="text-xs text-gray-500 uppercase font-medium">
                                        Vendor
                                    </p>
                                    <p className="text-sm font-medium mt-0.5">
                                        {selectedVendor.companyName}
                                    </p>
                                    {selectedPO && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            PO #{selectedPO.id.slice(0, 12)}...
                                        </p>
                                    )}
                                </div>

                                {/* Items */}
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-medium mb-2">
                                        Items Being Returned
                                    </p>
                                    <div className="space-y-2">
                                        {buildReturnItemsList().map((item) => (
                                            <div
                                                key={item.productId}
                                                className="flex justify-between items-center p-2 rounded-lg bg-gray-50"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {item.productName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {item.quantity} × {formatCurrency(item.unitPrice)}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-semibold">
                                                    {formatCurrency(item.subtotal)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500">Reason</p>
                                        <p className="text-sm font-medium">
                                            {REASON_OPTIONS.find((r) => r.value === reason)?.label}
                                        </p>
                                    </div>
                                    {creditNoteNumber && (
                                        <div className="p-3 rounded-lg bg-gray-50">
                                            <p className="text-xs text-gray-500">Credit Note #</p>
                                            <p className="text-sm font-medium">
                                                {creditNoteNumber}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {reasonNotes && (
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500">Notes</p>
                                        <p className="text-sm">{reasonNotes}</p>
                                    </div>
                                )}

                                {imagePreviews.length > 0 && (
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500 mb-2">Evidence Photos ({imagePreviews.length})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {imagePreviews.map((preview, index) => (
                                                <img
                                                    key={index}
                                                    src={preview}
                                                    alt={`Evidence ${index + 1}`}
                                                    className="h-16 w-16 object-cover rounded-md border"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Adjustments */}
                                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/50">
                                    <p className="text-xs text-orange-700 uppercase font-medium mb-2">
                                        What Will Happen
                                    </p>
                                    <ul className="space-y-1 text-sm text-orange-800">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-orange-600 shrink-0" />
                                            Inventory will be deducted for{" "}
                                            {buildReturnItemsList().length} item(s)
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-orange-600 shrink-0" />
                                            Ledger entry ({formatCurrency(totalReturnAmount)}{" "}
                                            contra-expense) will be created
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-orange-600 shrink-0" />
                                            Vendor balance (AP) will be reduced by{" "}
                                            {formatCurrency(totalReturnAmount)}
                                        </li>
                                    </ul>
                                </div>

                                {/* Total */}
                                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-center">
                                    <p className="text-sm text-orange-600">
                                        Total Vendor Return Amount
                                    </p>
                                    <p className="text-2xl font-bold text-orange-700">
                                        {formatCurrency(totalReturnAmount)}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 border-t bg-gray-50 flex justify-between">
                                <button
                                    onClick={() => setStep(3)}
                                    className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={processing}
                                    className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {processing ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Process Return
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </AdminLayout>
        </ProtectedRoute>
    );
}
