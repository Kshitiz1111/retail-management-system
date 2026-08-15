"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, X } from "lucide-react";

interface ImageViewerDialogProps {
    imageUrl: string;
    alt?: string;
    trigger: React.ReactNode;
}

export function ImageViewerDialog({ imageUrl, alt = "Image", trigger }: ImageViewerDialogProps) {
    const [open, setOpen] = useState(false);
    const [zoom, setZoom] = useState(1);

    const handleDownload = async () => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `receipt-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            // Fallback: open in new tab
            window.open(imageUrl, "_blank");
        }
    };

    return (
        <>
            <span onClick={() => setOpen(true)} className="cursor-pointer">
                {trigger}
            </span>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setZoom(1); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
                    <DialogTitle className="sr-only">{alt}</DialogTitle>
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-3 border-b bg-white">
                        <span className="text-sm font-medium truncate">{alt}</span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                                disabled={zoom <= 0.5}
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                                disabled={zoom >= 3}
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleDownload}>
                                <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => setOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    {/* Image */}
                    <div className="overflow-auto max-h-[calc(90vh-60px)] flex items-center justify-center bg-gray-100 p-4">
                        <img
                            src={imageUrl}
                            alt={alt}
                            style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.2s" }}
                            className="max-w-full"
                            draggable={false}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
