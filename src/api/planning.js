import { USE_MOCK_DATA } from "./config";
import { apiRequest } from "./client";
import { demoPlan } from "../mocks/demoData";

export async function generatePlan(payload = {}) {
    if (USE_MOCK_DATA) return demoPlan;

    return apiRequest("/api/plans/preview", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getLatestPlan() {
    if (USE_MOCK_DATA) return demoPlan;

    return apiRequest("/api/plans/latest");
}

export async function autoPoolOrders(payload = {}) {
    if (USE_MOCK_DATA) return demoPlan;

    return apiRequest("/api/plans/auto-pool", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getMLHealth() {
    if (USE_MOCK_DATA) {
        return {
            success: false,
            mock: true,
            message: "ML health is unavailable in mock mode.",
        };
    }

    return apiRequest("/api/ml/health");
}

export async function getMLTravelTime(payload = {}) {
    if (USE_MOCK_DATA) return null;

    return apiRequest("/api/ml/travel-time", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function getMLEconomics(payload = {}) {
    if (USE_MOCK_DATA) return null;

    return apiRequest("/api/ml/economics/costs", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}