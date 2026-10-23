# KiranaPool Backend

Node.js + Express + MongoDB/Mongoose backend. This archive keeps the Phase 1–5 APIs and adds Phase 6 delivery planning/pooling plus the Node-side Phase 7 forecast integration.

## Roles

- `shopkeeper`: owns kirana shop profiles; can place supply orders to active warehouses.
- `wholesaler`: owns warehouse(s); can record offline/manual kirana orders, preview/auto-create pooled routes, assign riders and generate demand forecasts.
- `rider`: owns a rider profile; sees assigned orders/plans and updates delivery status.

## Run locally

1. Use Node.js 20+.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a strong `JWT_SECRET`. `GOOGLE_CLIENT_ID` is only needed for Google sign-in.
3. From this folder, run `npm install`.
4. Run `npm run dev`.
5. Check `GET http://localhost:5000/api/health`.

## Demo data

Against a **demo database only**, run `npm run seed:demo`. Demo password: `KiranaDemo@123`. Demo account emails and seed behavior are described in `kiranapool_feature_api_docs/PHASE6_7_API_GUIDE.md`. Rerunning seed refreshes rows marked as synthetic and plans/forecasts belonging to the demo wholesaler; use the demo account only for local testing.

## Tests

Run `npm test`. Tests cover pooling/time compatibility, route/cost calculations, fallback forecasting, model role contracts and protected route mounting. The automated suite does not connect to MongoDB Atlas or verify a live FastAPI service.

## Phase 6 features

- Wholesaler-owned warehouses with service-area metadata.
- Supply order time slots and a wholesaler manual-entry endpoint for phone/offline orders.
- Route preview, automatic compatible grouping, nearest-neighbour stop ordering, estimated pooled-vs-solo cost/distance/time and per-shop savings.
- Rider assignment, cancellation before a route starts, and plan completion after all assigned orders are delivered.

## Phase 7 features

- Synthetic history/pending orders for demos.
- Shop-wise and area-wise forecasts in morning/afternoon/evening India-time slots.
- Forecast summaries and actual-demand recording.
- Optional FastAPI request/response integration and local historical-baseline fallback.

Import `kiranapool_feature_api_docs/KiranaPool_Phase6_7.postman_collection.json` into Postman for a ready-made workflow. Read `kiranapool_feature_api_docs/PHASE6_7_API_GUIDE.md` and `ML_INTEGRATION.md` before testing APIs.

## Estimate limitation

Routing uses great-circle distance multiplied by a configurable road-factor and nearest-neighbour heuristic. Costs and ETAs are **estimates**, not live road directions; tune cost/road/speed variables for the demo. No mapping provider is called.
