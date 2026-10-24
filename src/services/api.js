const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api"
).replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers,
        });
    } catch {
        throw new Error(
            "Backend se connection nahi ho pa raha. API URL aur backend status check karo."
        );
    }

    const contentType = response.headers.get("content-type") || "";
    let data = {};

    if (contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            throw new Error("Backend returned an invalid JSON response.");
        }
    } else {
        const text = await response.text();
        data = text ? { message: text } : {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

export const authApi = {
    signup: (payload) =>
        apiRequest("/auth/signup", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    login: (payload) =>
        apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    google: (payload) =>
        apiRequest("/auth/google", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    me: () => apiRequest("/auth/me"),

    logout: () => localStorage.removeItem("token"),
};

export const shopsApi = {
    getAll: () => apiRequest("/shops"),

    getById: (id) => apiRequest(`/shops/${id}`),

    create: (payload) =>
        apiRequest("/shops", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    update: (id, payload) =>
        apiRequest(`/shops/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),

    remove: (id) =>
        apiRequest(`/shops/${id}`, {
            method: "DELETE",
        }),
};

export const ridersApi = {
    // Authenticated users: rider directory
    getAll: () => apiRequest("/riders"),

    // Get one rider by profile ID
    getById: (id) => apiRequest(`/riders/${id}`),

    // Rider only: create own profile
    create: (payload) =>
        apiRequest("/riders", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    // Rider only: get own profile
    getMe: () => apiRequest("/riders/me"),

    // Rider only: update own profile
    updateMe: (payload) =>
        apiRequest("/riders/me", {
            method: "PATCH",
            body: JSON.stringify(payload),
        }),
};

export const ordersApi = {
    // List orders visible to the logged-in user
    getAll: (status) => {
        const query = status ?
            `?status=${encodeURIComponent(status)}` :
            "";

        return apiRequest(`/orders${query}`);
    },

    // Get one order by ID
    getById: (id) => apiRequest(`/orders/${id}`),

    // Shopkeeper only: create an order
    create: (payload) =>
        apiRequest("/orders", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    createManual: (payload) =>
        apiRequest("/orders/manual", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    // Role and transition rules are enforced by the backend
    updateStatus: (id, status) =>
        apiRequest(`/orders/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        }),
};

export const warehousesApi = {
    getAll: () => apiRequest("/warehouses"),
    create: (payload) => apiRequest("/warehouses", { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => apiRequest(`/warehouses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    getById: (id) => apiRequest(`/warehouses/${id}`),
};

export const plansApi = {
    getAll: () => apiRequest("/plans"),
    getLatest: () => apiRequest("/plans/latest"),
    getById: (id) => apiRequest(`/plans/${id}`),
    preview: (payload) => apiRequest("/plans/preview", { method: "POST", body: JSON.stringify(payload) }),
    create: (payload) => apiRequest("/plans", { method: "POST", body: JSON.stringify(payload) }),
    autoPool: (payload = {}) => apiRequest("/plans/auto-pool", { method: "POST", body: JSON.stringify(payload) }),
    assignRider: (id, rider) => apiRequest(`/plans/${id}/assign-rider`, { method: "PATCH", body: JSON.stringify({ riderId: rider }) }),
    cancel: (id) => apiRequest(`/plans/${id}/cancel`, { method: "POST" }),
};

export const forecastsApi = {
        getAll: (params = {}) => {
                const query = new URLSearchParams(params).toString();
                return apiRequest(`/forecasts${query ? `?${query}` : ""}`);
    },
    getSummary: () => apiRequest("/forecasts/summary"),
    run: (payload = {}) => apiRequest("/forecasts/run", { method: "POST", body: JSON.stringify(payload) }),
    recordActual: (id, actualOrders) => apiRequest(`/forecasts/${id}/actual`, { method: "PATCH", body: JSON.stringify({ actualOrders }) }),
};


export const mlApi = {
    getHealth: () => apiRequest("/ml/health"),

    getTravelTime: (payload) =>
        apiRequest("/ml/travel-time", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    getEconomics: (payload) =>
        apiRequest("/ml/economics/costs", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    solveRoute: (payload) =>
        apiRequest("/ml/route", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    solveRoutes: (payload) =>
        apiRequest("/ml/routes/solve", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    planRoutes: (payload) =>
        apiRequest("/ml/routes/plan", {
            method: "POST",
            body: JSON.stringify(payload),
        }),

    batch: (payload) =>
        apiRequest("/ml/batch", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};