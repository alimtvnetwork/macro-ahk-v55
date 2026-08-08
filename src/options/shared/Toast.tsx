/**
 * Marco Extension — Shared Toast Component
 */

import { useEffect, useState } from "react";
import { ToastVariantType } from "../../../standalone-scripts/macro-controller/src/types/enums";

interface ToastProps {
    message: string;
    variant: ToastVariantType;
    onDismiss: () => void;
}

const DURATION: Record<string, number> = {
    success: 2500,
    error: 4000,
    info: 3000,
};

const ICONS: Record<string, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
};

export function Toast({ message, variant, onDismiss }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, DURATION[variant] ?? 3000);
        return () => clearTimeout(timer);
    }, [variant, onDismiss]);

    return (
        <div className={`toast ${variant}`}>
            {ICONS[variant]} {message}
        </div>
    );
}
