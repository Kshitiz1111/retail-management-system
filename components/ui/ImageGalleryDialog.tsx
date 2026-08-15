"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, DownloadCloud } from "lucide-react";

interface ImageGalleryDialogProps {
    imageUrls: string[];
    initialIndex?: number;
    altPrefix?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImageGalleryDialog({
    imageUrls,
    initialIndex = 0,
    altPrefix = "Image",
    open,
    onOpenChange
}: ImageGalleryDialogProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);

    const imageUrl = imageUrls[currentIndex];

    const handleDownload = async (url: string, index: number) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `${altPrefix.toLowerCase().replace(/\s+/g, '-')}-${index + 1}-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            window.open(url, "_blank");
        }
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % imageUrls.length);
        setZoom(1);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
        setZoom(1);
    };

    if (!imageUrls.length) return null;

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setZoom(1); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">{`${altPrefix} ${currentIndex + 1}`}</DialogTitle>

                {/* Toolbar */}
                <div className="flex items-center justify-between p-3 border-b bg-white z-10">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold truncate">
                            {altPrefix} {imageUrls.length > 1 ? `(${currentIndex + 1} / ${imageUrls.length})` : ""}
                        </span>
                        {imageUrls.length > 1 && (
                            <span className="text-[10px] text-gray-400">Use arrows to switch</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-lg overflow-hidden mr-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-none border-r"
                                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                                disabled={zoom <= 0.5}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] text-gray-500 w-10 text-center bg-gray-50 h-8 flex items-center justify-center font-medium">
                                {Math.round(zoom * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-none border-l"
                                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                                disabled={zoom >= 3}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                        </div>

                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownload(imageUrl, currentIndex)}>
                            <Download className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Main Viewer Area */}
                <div className="relative flex-1 bg-gray-900 overflow-hidden group min-h-[50vh]">
                    {/* Image Container */}
                    <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
                        <img
                            src={imageUrl}
                            alt={`${altPrefix} ${currentIndex + 1}`}
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: "center center",
                                transition: zoom === 1 ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none"
                            }}
                            className="max-w-full max-h-full object-contain shadow-2xl"
                            draggable={false}
                        />
                    </div>

                    {/* Navigation Buttons */}
                    {imageUrls.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </>
                    )}
                </div>

                {/* Thumbnails (optional) */}
                {imageUrls.length > 1 && (
                    <div className="p-3 bg-gray-50 border-t overflow-x-auto">
                        <div className="flex gap-2 mx-auto justify-center">
                            {imageUrls.map((url, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setCurrentIndex(idx); setZoom(1); }}
                                    className={`relative h-12 w-12 rounded border-2 overflow-hidden transition-all ${currentIndex === idx ? "border-orange-500 ring-2 ring-orange-200" : "border-transparent opacity-60 hover:opacity-100"
                                        }`}
                                >
                                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
