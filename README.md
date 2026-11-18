# KiranaPool Frontend

React + Vite frontend for the KiranaPool backend.

## Roles

- `shopkeeper`: registers/manages their kirana shop and views its supply orders.
- `wholesaler`: manages warehouses, records manually received shop orders, pools compatible deliveries, assigns riders, and generates demand forecasts.
- `rider`: manages their rider profile, views assigned deliveries, and advances delivery status.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend origin plus `/api` (for example `http://localhost:5000/api`).
3. Set `VITE_GOOGLE_CLIENT_ID` to the same Google OAuth client ID configured by the backend.
4. Run `npm install`.
5. Run `npm run dev`.

Live API mode is the default. To show the old synthetic UI fixtures offline, set `VITE_USE_MOCK_DATA=true`; mock mode does not perform live role/API validation.

## Connected backend flows

- Auth: signup/login/Google login and session restore with bearer JWT.
- Shops: kirana shop registration and wholesaler shop selection .
- Warehouses: wholesaler-owned warehouse creation/listing with service areas.
- Orders: wholesaler manual supply order with warehouse and future delivery slots; role-specific order lists and rider status updates.
- Planning: auto-pool compatible pending orders, view plans, assign available riders, cancel plans.
- Forecasts: generate shop-wise/area-wise time-slot forecasts, inspect results, and record actual demand.

The frontend does not include backend credentials. Use the backend `.env` separately.
      