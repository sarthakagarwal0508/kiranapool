# KiranaPool — Backend API Documentation

Base URL: `http://localhost:5000/api`

Roles: `shopkeeper` (kirana retailer), `wholesaler` (supplier/warehouse owner), `rider` (delivery rider). All protected routes require `Authorization: Bearer <JWT_TOKEN>`.

## Docs
- `01-health-api.md` — health check
- `02-auth-apis.md` — signup, login, Google auth and current user
- `03-shops-apis.md` — kirana shop CRUD
- `04-riders-apis.md` — rider profile and directory
- `05-orders-apis.md` — legacy orders + wholesaler supply orders
- `PHASE6_7_API_GUIDE.md` — warehouses, delivery pooling, rider assignment, route metrics and forecasting
- `ML_INTEGRATION.md` — FastAPI request/response contract and local fallback
- `API-INVENTORY.md` — endpoint list
- `SCHEMAS.md` — MongoDB schemas and relationships

## Status
Phase 1–5 endpoints are retained, with backward-compatible legacy order support. Phase 6 adds wholesaler-owned warehouses, compatibility-based pooling, route estimates, plan creation and rider assignment. Phase 7 adds shop/area and time-slot forecasts, cost/savings metrics, a demo data seed, and optional FastAPI integration with a local fallback.

Run `npm test` for the included pure-service tests. Run `npm run seed:demo` only against a demo database to create reproducible sample data. Demo logins and password are documented in `PHASE6_7_API_GUIDE.md`.
