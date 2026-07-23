/**
 * Smoke test — DiagnosticsPanel
 *
 * Verifies the diagnostics panel renders status grid and controls.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DiagnosticsPanel } from "@/options/sections/DiagnosticsPanel";
import { flushEffects } from "@/test/support";


async function assertPanelRenders(): Promise<void> {
        const { container } = render(<DiagnosticsPanel />);
        await flushEffects();
        expect(container).toBeTruthy();
}

async function assertHeaderRenders(): Promise<void> {
        render(<DiagnosticsPanel />);
        await flushEffects();
        expect(screen.getByText("🩺 Diagnostics")).toBeInTheDocument();
}

async function assertDescriptionRenders(): Promise<void> {
        render(<DiagnosticsPanel />);
        await flushEffects();
        expect(screen.getByText(/Service worker boot status/)).toBeInTheDocument();
}

async function assertDiagnosticCardsRender(): Promise<void> {
        render(<DiagnosticsPanel />);
        await waitFor(() => {
            expect(screen.getByText("Boot Phase")).toBeInTheDocument();
            expect(screen.getByText("DB Mode")).toBeInTheDocument();
            expect(screen.getByText("Total Boot Time")).toBeInTheDocument();
            expect(screen.getByText("Version")).toBeInTheDocument();
        });
}

async function assertBootTimingsRender(): Promise<void> {
        render(<DiagnosticsPanel />);
        await waitFor(() => {
            expect(screen.getByText("Boot Step Timings")).toBeInTheDocument();
        });
}

async function assertRuntimeInfoRenders(): Promise<void> {
        render(<DiagnosticsPanel />);
        await waitFor(() => {
            expect(screen.getByText("Runtime Info")).toBeInTheDocument();
        });
}

async function assertActionsRender(): Promise<void> {
        render(<DiagnosticsPanel />);
        await waitFor(() => {
            expect(screen.getByText("↻ Refresh")).toBeInTheDocument();
            expect(screen.getByText("📋 Copy Diagnostics Report")).toBeInTheDocument();
        });
}

async function assertAutoRefreshRenders(): Promise<void> {
        render(<DiagnosticsPanel />);
        await waitFor(() => {
            expect(screen.getByText(/Auto-refresh/)).toBeInTheDocument();
        });
}

describe("DiagnosticsPanel", () => {
    it("renders without crashing", assertPanelRenders);
    it("renders the section header", assertHeaderRenders);
    it("renders section description", assertDescriptionRenders);
    it("renders diagnostic cards after data loads", assertDiagnosticCardsRender);
    it("renders boot step timings section after data loads", assertBootTimingsRender);
    it("renders runtime info section after data loads", assertRuntimeInfoRenders);
    it("renders action buttons after data loads", assertActionsRender);
    it("renders auto-refresh indicator", assertAutoRefreshRenders);
});
