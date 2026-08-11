"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ReturnService } from "@/lib/services/returnService";
import { SaleService } from "@/lib/services/saleService";
import { OrderService } from "@/lib/services/orderService";
import { ProductService } from "@/lib/services/productService";
import { CreditTransaction } from "@/lib/types";
import { CreditService } from "@/lib/services/creditService";
import {
    Sale,
    SaleItem,
    Order,
    OrderItem,
    SalesReturnItem,
    PaymentMethod,
    ReturnReason,
    Product,
} from "@/lib/types";
import { RESOURCES, ACTIONS } from "@/lib/types";
import {
    ArrowLeft,
    ArrowRight,
    Search,
    CheckCircle2,
    Package,
    AlertTriangle,
    Upload,
    X,
    ShoppingCart,
    ShoppingBag,
    Minus,
    Plus,
    Image as ImageIcon,
    Calendar,
    Users,
    Loader2,
} from "lucide-react";
import Link from "next/link";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    doc,
    getDoc,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

type Step = 1 | 2 | 3 | 4;
type SourceTab = "POS" | "ONLINE";

const REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
    { value: "DEFECTIVE", label: "Defective / Malfunctioning" },
    { value: "WRONG_ITEM", label: "Wrong Item Delivered" },
    { value: "CUSTOMER_CHANGED_MIND", label: "Customer Changed Mind" },
    { value: "WARRANTY", label: "Warranty Claim" },
    { value: "DAMAGED", label: "Damaged in Transit/Storage" },
    { value: "OTHER", label: "Other" },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
    { value: "CASH", label: "Cash" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "FONE_PAY", label: "Fone Pay" },
    { value: "CHEQUE", label: "Cheque" },
];

function formatCurrency(amount: number): string {
    return `Rs ${amount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;
}

// A single return item row with quantity selector
function ReturnItemRow({
    item,
    maxQty,
    alreadyReturned,
    selectedQty,
    warehouseId,
    warehouses,
    onQtyChange,
    onWarehouseChange,
}: {
    item: { productId: string; productName: string; sku?: string; quantity: number; unitPrice: number };
    maxQty: number;
    alreadyReturned: number;
    selectedQty: number;
    warehouseId: string;
    warehouses: Array<{ id: string; name: string }>;
    onQtyChange: (qty: number) => void;
    onWarehouseChange: (warehouseId: string) => void;
}) {
    const returnable = maxQty - alreadyReturned;
    if (returnable <= 0) {
        return (
            <div className="p-3 bg-gray-50 rounded-lg opacity-60">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="font-medium text-gray-700 text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-400">All {maxQty} items already returned</p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded">Fully Returned</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-3 rounded-lg border transition-colors ${selectedQty > 0 ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-white"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{item.productName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        <span>Price: {formatCurrency(item.unitPrice)}</span>
                        <span>Bought: {maxQty}</span>
                        {alreadyReturned > 0 && (
                            <span className="text-orange-600">Returned: {alreadyReturned}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Warehouse selector */}
                    {warehouses.length > 1 && selectedQty > 0 && (
                        <select
                            value={warehouseId}
                            onChange={(e) => onWarehouseChange(e.target.value)}
                            className="text-xs px-2 py-1 border rounded bg-white"
                        >
                            {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Quantity control */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onQtyChange(Math.max(0, selectedQty - 1))}
                            disabled={selectedQty === 0}
                            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{selectedQty}</span>
                        <button
                            onClick={() => onQtyChange(Math.min(returnable, selectedQty + 1))}
                            disabled={selectedQty >= returnable}
                            className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-xs text-gray-400 ml-1">/ {returnable}</span>
                    </div>
                </div>
            </div>
            {selectedQty > 0 && (
                <div className="mt-2 text-right">
                    <span className="text-sm font-medium text-blue-700">
                        Return: {formatCurrency(selectedQty * item.unitPrice)}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function NewSalesReturnPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState<Step>(1);
    const [processing, setProcessing] = useState(false);

    // Step 1: Find original transaction
    const [sourceTab, setSourceTab] = useState<SourceTab>("POS");
    const [searchQuery, setSearchQuery] = useState("");
    const [allTransactions, setAllTransactions] = useState<Array<Sale | Order>>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState<Sale | Order | null>(null);

    // Filters
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [customerFilter, setCustomerFilter] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Step 2: Select items
    const [returnItems, setReturnItems] = useState<
        Record<string, { qty: number; warehouseId: string }>
    >({});
    const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
    const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);

    // Step 3: Return details
    const [reason, setReason] = useState<ReturnReason>("DEFECTIVE");
    const [reasonNotes, setReasonNotes] = useState("");
    const [refundMethod, setRefundMethod] = useState<PaymentMethod>("CASH");
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // Linked credits for the selected transaction/customer
    const [linkedCredits, setLinkedCredits] = useState<CreditTransaction[]>([]);
    const [customerTotalDue, setCustomerTotalDue] = useState<number>(0);
    const [customerNameMap, setCustomerNameMap] = useState<Record<string, string>>({});

    // Debounce ref
    const debounceRef = useRef<NodeJS.Timeout | null>(null);


    // Load warehouses and recent transactions on mount
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch warehouses
                const whQuery = query(collection(db, "warehouses"));
                const whSnapshot = await getDocs(whQuery);
                const wh: Array<{ id: string; name: string }> = [];
                whSnapshot.forEach((d) => {
                    const data = d.data();
                    if (data.isActive !== false) {
                        wh.push({ id: d.id, name: data.name || d.id });
                    }
                });
                setWarehouses(wh);
            } catch (error) {
                console.error("Error fetching warehouses:", error);
            }
        };
        fetchInitialData();
    }, []);

    // Auto-load recent transactions when tab changes
    useEffect(() => {
        loadRecentTransactions();
    }, [sourceTab]);

    const loadRecentTransactions = async () => {
        setLoadingRecent(true);
        try {
            if (sourceTab === "POS") {
                // Load last 7 days of POS sales
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const salesQuery = query(
                    collection(db, "sales"),
                    where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
                    orderBy("createdAt", "desc"),
                    limit(100)
                );
                const snapshot = await getDocs(salesQuery);
                const results: Sale[] = [];
                snapshot.forEach((docSnap) => {
                    results.push({ id: docSnap.id, ...docSnap.data() } as Sale);
                });
                setAllTransactions(results);

                // Build customer name map for filter support
                const customerIds = [...new Set(results.map((s) => (s as Sale).customerId).filter(Boolean))];
                if (customerIds.length > 0) {
                    try {
                        const custMap: Record<string, string> = {};
                        const custSnapshots = await Promise.all(
                            customerIds.map((id) => getDoc(doc(db, "customers", id as string)))
                        );
                        custSnapshots.forEach((snap) => {
                            if (snap.exists()) {
                                const d = snap.data();
                                custMap[snap.id] = d.name || d.phone || snap.id;
                            }
                        });
                        setCustomerNameMap(custMap);
                    } catch (err) {
                        console.warn("Could not load customer names for filter:", err);
                    }
                }
            } else {
                // Load recent online orders
                const orders = await OrderService.getAllOrders();
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const recent = orders.filter((o) => {
                    const created = o.createdAt?.toDate?.();
                    return created && created >= sevenDaysAgo;
                });
                setAllTransactions(recent.length > 0 ? recent : orders.slice(0, 50));
            }
        } catch (error) {
            console.error("Error loading recent transactions:", error);
        } finally {
            setLoadingRecent(false);
        }
    };

    // Client-side filtered results (debounced via useMemo)
    const filteredResults = useMemo(() => {
        let results = [...allTransactions];

        // Text search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            results = results.filter((tx) => {
                const isSale = sourceTab === "POS";
                const matchId = tx.id.toLowerCase().includes(q);
                const matchItem = tx.items?.some((item: any) =>
                    item.productName?.toLowerCase().includes(q)
                );
                if (isSale) {
                    return matchId || matchItem;
                } else {
                    const order = tx as Order;
                    const matchNumber = order.orderNumber?.toLowerCase().includes(q);
                    const matchCustomer = order.customerInfo?.name?.toLowerCase().includes(q);
                    return matchId || matchItem || matchNumber || matchCustomer;
                }
            });
        }

        // Customer name filter
        if (customerFilter.trim()) {
            const cf = customerFilter.toLowerCase();
            results = results.filter((tx) => {
                if (sourceTab === "POS") {
                    // POS sales: lookup customer name via map
                    const customerId = (tx as any).customerId as string | undefined;
                    const name = customerId ? (customerNameMap[customerId] || customerId) : "";
                    return name.toLowerCase().includes(cf);
                } else {
                    return (tx as Order).customerInfo?.name?.toLowerCase().includes(cf);
                }
            });
        }

        // Date range filter
        if (dateFrom) {
            const from = new Date(dateFrom);
            from.setHours(0, 0, 0, 0);
            results = results.filter((tx) => {
                const d = tx.createdAt?.toDate?.();
                return d && d >= from;
            });
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            results = results.filter((tx) => {
                const d = tx.createdAt?.toDate?.();
                return d && d <= to;
            });
        }

        return results;
    }, [allTransactions, searchQuery, customerFilter, dateFrom, dateTo, sourceTab, customerNameMap]);

    // Select a transaction and move to step 2
    const handleSelectTransaction = async (transaction: Sale | Order) => {
        setSelectedTransaction(transaction);

        // Get already-returned quantities
        const id = transaction.id;
        const returned = await ReturnService.getReturnedQuantities(
            id,
            sourceTab
        );
        setAlreadyReturned(returned);

        // Initialize return items with 0 quantity
        const items = getTransactionItems(transaction);
        const defaultWarehouse = warehouses[0]?.id || "default";
        const initial: Record<string, { qty: number; warehouseId: string }> = {};
        items.forEach((item) => {
            initial[item.productId] = { qty: 0, warehouseId: defaultWarehouse };
        });
        setReturnItems(initial);
        // Fetch customer's total outstanding credits if they have any
        const customerInfo = sourceTab === "POS"
            ? { id: (transaction as Sale).customerId }
            : { id: (transaction as Order).customerId };

        if (customerInfo.id) {
            try {
                // Fetch all credits for this customer, not just from this sale
                const credits = await CreditService.getCustomerCredits(customerInfo.id);
                const outstanding = credits.filter(c => c.dueAmount > 0);
                setLinkedCredits(outstanding);

                // Sum up total outstanding balance
                const totalDue = outstanding.reduce((sum, c) => sum + c.dueAmount, 0);
                setCustomerTotalDue(totalDue);
            } catch (error) {
                console.error("Error fetching customer credits:", error);
                setLinkedCredits([]);
                setCustomerTotalDue(0);
            }
        } else {
            setLinkedCredits([]);
            setCustomerTotalDue(0);
        }

        setStep(2);
    };

    const getTransactionItems = (
        transaction: Sale | Order
    ): Array<{ productId: string; productName: string; sku?: string; quantity: number; unitPrice: number }> => {
        return transaction.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        }));
    };

    const getCustomerInfo = (): { id?: string; name?: string } => {
        if (!selectedTransaction) return {};
        if (sourceTab === "POS") {
            return { id: (selectedTransaction as Sale).customerId };
        } else {
            const order = selectedTransaction as Order;
            return {
                id: order.customerId,
                name: order.customerInfo?.name,
            };
        }
    };

    // Build the return items array for the service
    const buildReturnItemsList = (): SalesReturnItem[] => {
        if (!selectedTransaction) return [];
        const items = getTransactionItems(selectedTransaction);
        return items
            .filter((item) => (returnItems[item.productId]?.qty || 0) > 0)
            .map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sku: item.sku || "",
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

    const totalOutstandingCredit = linkedCredits.reduce((sum, c) => sum + c.dueAmount, 0);
    const creditReduction = Math.min(totalReturnAmount, totalOutstandingCredit);
    const cashRefundAmount = totalReturnAmount - creditReduction;

    const hasSelectedItems = buildReturnItemsList().length > 0;

    // Handle image upload (multi-image append)
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const newFiles = [...imageFiles, ...files];
        setImageFiles(newFiles);
        // Generate previews for new files
        files.forEach((file) => {
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

    // Process the return
    const handleSubmit = async () => {
        if (!selectedTransaction || !user) return;
        setProcessing(true);

        try {
            const returnItemsList = buildReturnItemsList();
            const customerInfo = getCustomerInfo();

            await ReturnService.createSalesReturn({
                source: sourceTab,
                originalSaleId: sourceTab === "POS" ? selectedTransaction.id : undefined,
                originalOrderId: sourceTab === "ONLINE" ? selectedTransaction.id : undefined,
                originalOrderNumber:
                    sourceTab === "ONLINE"
                        ? (selectedTransaction as Order).orderNumber
                        : undefined,
                customerId: customerInfo.id,
                customerName: customerInfo.name,
                items: returnItemsList,
                refundMethod,
                reason,
                reasonNotes: reasonNotes || undefined,
                reasonImageFiles: imageFiles.length > 0 ? imageFiles : undefined,
                processedBy: user.uid,
            });

            router.push("/admin/returns");
        } catch (error) {
            console.error("Error processing return:", error);
            alert("Failed to process return. Please try again.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <ProtectedRoute requiredPermission={{ resource: RESOURCES.ORDERS, action: ACTIONS.UPDATE }}>
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
                            <h1 className="text-2xl font-bold text-gray-900">New Sales Return</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Process a customer return for a POS sale or online order
                            </p>
                        </div>
                    </div>

                    {/* Step Progress */}
                    <div className="flex items-center gap-2 px-1">
                        {[
                            { num: 1, label: "Find Sale" },
                            { num: 2, label: "Select Items" },
                            { num: 3, label: "Details" },
                            { num: 4, label: "Confirm" },
                        ].map((s, i) => (
                            <div key={s.num} className="flex items-center flex-1">
                                <div
                                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${step >= s.num
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-500"
                                        }`}
                                >
                                    {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                                </div>
                                <span
                                    className={`ml-2 text-xs font-medium hidden sm:inline ${step >= s.num ? "text-blue-700" : "text-gray-400"
                                        }`}
                                >
                                    {s.label}
                                </span>
                                {i < 3 && (
                                    <div
                                        className={`flex-1 h-0.5 mx-2 ${step > s.num ? "bg-blue-600" : "bg-gray-200"
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Find Original Transaction */}
                    {step === 1 && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            {/* Source Tabs */}
                            <div className="flex border-b">
                                <button
                                    onClick={() => { setSourceTab("POS"); setSearchQuery(""); }}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${sourceTab === "POS"
                                        ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50/50"
                                        : "text-gray-500 hover:text-gray-700"
                                        }`}
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    POS Sales
                                </button>
                                <button
                                    onClick={() => { setSourceTab("ONLINE"); setSearchQuery(""); }}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${sourceTab === "ONLINE"
                                        ? "border-b-2 border-teal-600 text-teal-600 bg-teal-50/50"
                                        : "text-gray-500 hover:text-gray-700"
                                        }`}
                                >
                                    <ShoppingBag className="h-4 w-4" />
                                    Online Orders
                                </button>
                            </div>

                            {/* Search & Filters */}
                            <div className="p-4 space-y-3">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder={
                                                sourceTab === "POS"
                                                    ? "Search by product name or sale ID..."
                                                    : "Search by order number or product name..."
                                            }
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${showFilters ? "bg-blue-50 border-blue-300 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Filters
                                    </button>
                                </div>

                                {/* Advanced Filters Panel */}
                                {showFilters && (
                                    <div className="p-3 rounded-lg bg-gray-50 border space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
                                                <input
                                                    type="date"
                                                    value={dateFrom}
                                                    onChange={(e) => setDateFrom(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
                                                <input
                                                    type="date"
                                                    value={dateTo}
                                                    onChange={(e) => setDateTo(e.target.value)}
                                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
                                            <div className="relative">
                                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Filter by customer name..."
                                                    value={customerFilter}
                                                    onChange={(e) => setCustomerFilter(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                        {(dateFrom || dateTo || customerFilter) && (
                                            <button
                                                onClick={() => { setDateFrom(""); setDateTo(""); setCustomerFilter(""); }}
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Results Header */}
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500">
                                        {loadingRecent
                                            ? "Loading recent transactions..."
                                            : `${filteredResults.length} transaction(s) found`}
                                    </p>
                                </div>

                                {/* Results */}
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {loadingRecent && (
                                        <div className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                                            <p className="text-xs text-gray-400 mt-2">Loading recent transactions...</p>
                                        </div>
                                    )}
                                    {!loadingRecent && filteredResults.length === 0 && (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            No transactions found. Try adjusting your search or filters.
                                        </div>
                                    )}
                                    {!loadingRecent && filteredResults.map((result: Sale | Order) => {
                                        const isSale = sourceTab === "POS";
                                        const sale = result as Sale;
                                        const order = result as Order;
                                        return (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSelectTransaction(result)}
                                                className="w-full text-left p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-medium text-sm text-gray-900">
                                                            {isSale
                                                                ? `Sale #${sale.id.slice(0, 8)}...`
                                                                : `Order #${order.orderNumber}`}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {result.items?.length || 0} items •{" "}
                                                            {result.createdAt
                                                                ? new Date(result.createdAt.toDate()).toLocaleDateString()
                                                                : ""}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {result.items
                                                                ?.map((i: any) => i.productName)
                                                                .join(", ")}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold text-sm">
                                                            {formatCurrency(
                                                                isSale ? sale.total : order.total
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            {isSale
                                                                ? sale.paymentMethod
                                                                : order.paymentMethod}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Items to Return */}
                    {step === 2 && selectedTransaction && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-gray-50/50">
                                <h2 className="font-semibold text-gray-800">
                                    Select Items to Return
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Choose items and quantities to return. Items already returned
                                    are shown with reduced availability.
                                </p>
                            </div>
                            <div className="p-4 space-y-2">
                                {getTransactionItems(selectedTransaction).map((item) => (
                                    <ReturnItemRow
                                        key={item.productId}
                                        item={item}
                                        maxQty={item.quantity}
                                        alreadyReturned={alreadyReturned[item.productId] || 0}
                                        selectedQty={returnItems[item.productId]?.qty || 0}
                                        warehouseId={
                                            returnItems[item.productId]?.warehouseId ||
                                            warehouses[0]?.id ||
                                            ""
                                        }
                                        warehouses={warehouses}
                                        onQtyChange={(qty) =>
                                            setReturnItems((prev) => ({
                                                ...prev,
                                                [item.productId]: {
                                                    ...prev[item.productId],
                                                    qty,
                                                },
                                            }))
                                        }
                                        onWarehouseChange={(wId) =>
                                            setReturnItems((prev) => ({
                                                ...prev,
                                                [item.productId]: {
                                                    ...prev[item.productId],
                                                    warehouseId: wId,
                                                },
                                            }))
                                        }
                                    />
                                ))}
                            </div>

                            {/* Summary bar */}
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
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
                                <p className="text-xs text-gray-500 mt-1">
                                    Provide the reason and refund method for this return
                                </p>
                            </div>
                            <div className="p-4 space-y-5">
                                {/* Reason */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Reason for Return *
                                    </label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value as ReturnReason)}
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
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
                                        placeholder="Any additional details about the return..."
                                        rows={3}
                                        className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>

                                {/* Refund Method */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Refund Method *
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {PAYMENT_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setRefundMethod(opt.value)}
                                                className={`px-3 py-2.5 border rounded-lg text-sm font-medium transition-colors ${refundMethod === opt.value
                                                    ? "border-blue-600 bg-blue-50 text-blue-700"
                                                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Image Upload (multi) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Evidence Photos (Optional)
                                    </label>
                                    <div className="flex flex-wrap gap-3 mb-3">
                                        {imagePreviews.map((preview, idx) => (
                                            <div key={idx} className="relative inline-block">
                                                <img
                                                    src={preview}
                                                    alt={`Evidence ${idx + 1}`}
                                                    className="h-24 w-24 object-cover rounded-lg border"
                                                />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="flex items-center justify-center h-24 w-24 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                                            <div className="flex flex-col items-center gap-1 text-gray-400">
                                                <Upload className="h-5 w-5" />
                                                <span className="text-xs">Add photo</span>
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
                                    {imagePreviews.length === 0 && (
                                        <p className="text-xs text-gray-400">No photos uploaded yet</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t bg-gray-50 flex justify-between">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => setStep(4)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    Review <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review & Confirm */}
                    {step === 4 && selectedTransaction && (
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-4 border-b bg-amber-50">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                    <h2 className="font-semibold text-gray-800">
                                        Review & Confirm Return
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">
                                    Please review all details carefully. This action cannot be
                                    undone.
                                </p>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Transaction Reference */}
                                <div className="p-3 rounded-lg bg-gray-50">
                                    <p className="text-xs text-gray-500 uppercase font-medium">
                                        Original Transaction
                                    </p>
                                    <p className="text-sm font-medium mt-0.5">
                                        {sourceTab === "POS"
                                            ? `POS Sale #${selectedTransaction.id.slice(0, 12)}...`
                                            : `Online Order #${(selectedTransaction as Order).orderNumber}`}
                                    </p>
                                </div>

                                {/* Return Items */}
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

                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500">Reason</p>
                                        <p className="text-sm font-medium">
                                            {REASON_OPTIONS.find((r) => r.value === reason)?.label}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500">Refund Method</p>
                                        <p className="text-sm font-medium">
                                            {PAYMENT_OPTIONS.find((p) => p.value === refundMethod)?.label}
                                        </p>
                                    </div>
                                </div>

                                {reasonNotes && (
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500">Notes</p>
                                        <p className="text-sm">{reasonNotes}</p>
                                    </div>
                                )}

                                {imagePreviews.length > 0 && (
                                    <div className="p-3 rounded-lg bg-gray-50">
                                        <p className="text-xs text-gray-500 mb-2">Evidence Photos</p>
                                        <div className="flex flex-wrap gap-2">
                                            {imagePreviews.map((preview, idx) => (
                                                <img
                                                    key={idx}
                                                    src={preview}
                                                    alt={`Evidence ${idx + 1}`}
                                                    className="h-20 w-20 object-cover rounded-lg"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Adjustments Summary */}
                                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                                    <p className="text-xs text-blue-700 uppercase font-medium mb-2">
                                        What Will Happen
                                    </p>
                                    <ul className="space-y-1 text-sm text-blue-800">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                            Inventory will be restocked for {buildReturnItemsList().length} item(s)
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                            Ledger entry ({formatCurrency(totalReturnAmount)} contra-revenue) will be created
                                        </li>
                                        {getCustomerInfo().id && (
                                            <>
                                                <li className="flex items-start gap-2">
                                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                                    Customer&apos;s total spent will be reduced
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                                                    Loyalty points earned will be reversed
                                                </li>
                                            </>
                                        )}
                                    </ul>
                                </div>

                                {/* Total */}
                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-sm text-gray-600">Total Return Amount</p>
                                        <p className="text-lg font-bold text-gray-900">{formatCurrency(totalReturnAmount)}</p>
                                    </div>

                                    {customerTotalDue > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-gray-200">
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <p>Current Customer Due</p>
                                                <p>{formatCurrency(customerTotalDue)}</p>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <p className="text-red-600 font-medium">Deduction from Due</p>
                                                <p className="text-red-600 font-bold">-{formatCurrency(creditReduction)}</p>
                                            </div>
                                            {customerTotalDue > creditReduction && (
                                                <div className="flex justify-between items-center text-xs text-gray-500 italic">
                                                    <p>Remaining Customer Due</p>
                                                    <p>{formatCurrency(customerTotalDue - creditReduction)}</p>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2 border-t font-semibold">
                                                <p className="text-blue-700">Actual {refundMethod.replace("_", " ")} Refund</p>
                                                <p className="text-blue-700 text-xl">{formatCurrency(cashRefundAmount)}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 text-center italic mt-1">
                                                Customer&apos;s outstanding balance will be adjusted automatically.
                                            </p>
                                        </div>
                                    )}

                                    {customerTotalDue <= 0 && (
                                        <div className="pt-2 border-t border-gray-200 text-center">
                                            <p className="text-sm text-blue-600">Total {refundMethod.replace("_", " ")} Refund</p>
                                            <p className="text-2xl font-bold text-blue-700">
                                                {formatCurrency(totalReturnAmount)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
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
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
