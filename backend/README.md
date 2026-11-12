# KiranaPool Backend

Node.js + Express + MongoDB/Mongoose API for shopkeepers, wholesalers and riders. Includes orders, warehouses, delivery planning/pooling, rider assignment, demand forecasts, role-scoped dashboard analytics and ML-service integration.

## Roles

- `shopkeeper`: manages own shop profiles and supply orders.
- `wholesaler`: owns warehouses, records manual orders, pools deliveries, assigns riders and generates forecasts.
- `rider`: sees assigned deliveries, updates their own GPS location and advances assigned order status.

## Run locally

1. Use Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` and generate a fresh `JWT_SECRET` with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Install dependencies: `npm install`.
5. Start: `npm run dev`.
6. Check `GET http://localhost:5000/api/health`.

The API now waits for MongoDB before listening. `JWT_SECRET` must be at least 32 characters.

## Browser authentication

The API sets an `HttpOnly` JWT cookie; the JWT is not included in login/signup JSON and should not be stored in browser storage. Browser fetch requests need `credentials: "include"`; unsafe methods need the CSRF value returned by login/signup or `GET /api/auth/csrf` in `X-CSRF-Token`. Keep only the CSRF value in memory; it is not an authentication credential. See `kiranapool_feature_api_docs/02-auth-apis.md` and `SECURITY_AND_FEATURES_AUDIT.md` for the migration. Native clients can still use `Authorization: Bearer <JWT>`.

Public signup is open to shopkeepers. New wholesaler/rider signups require private `WHOLESALER_SIGNUP_INVITE_CODE` / `RIDER_SIGNUP_INVITE_CODE` values in the backend environment.

## Demo data

Against a **dedicated demo database only**, set `ALLOW_DEMO_SEED=true` and a unique `DEMO_SEED_PASSWORD` of at least 16 characters, then run `npm run seed:demo`. The seed script is disabled by default, refuses production unless a second explicit `ALLOW_DEMO_SEED_IN_PRODUCTION=true` override is set, and never prints the password. Do not use a shared demo password on a live database.

## Tests

Run `npm test`. Tests cover auth-session response behavior, protected routes, serviceability, planning/time compatibility, route/economics integration fallback and forecast generation. The automated suite does not connect to MongoDB Atlas or verify a live FastAPI service.

## Key backend features

- Role-based authentication/authorization with revocable JWT sessions.
- Order lifecycle history (`statusHistory`) for auditability.
- Guarded shop deactivation (historical records remain connected).
- Wholesaler-scoped rider directory and rider unassignment before a route starts.
- Bounded pagination on collection endpoints (`page`, `limit`; maximum `limit=100`).
- `GET /api/analytics/overview` for role-aware dashboard metrics.
- ML-backed forecasting, batching, route solver and economics with validation-safe local fallbacks.

## Routing / costs limitation

Routing uses great-circle distance multiplied by a configurable road-factor and a nearest-neighbour heuristic. Cost and ETA are estimates, not live road directions. No mapping provider is called in this release; map integration is intentionally deferred to a separate pass.
