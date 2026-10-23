# KiranaPool ML Integration (Node.js + FastAPI)

## Service configuration

The ML service root URL is configured with `ML_SERVICE_URL` (do not append an endpoint path):

```env
ML_SERVICE_URL=https://kiranapool-05x4.onrender.com
ML_SERVICE_TOKEN=
ML_SERVICE_TIMEOUT_MS=5000
ML_ROUTE_TIMEOUT_MS=15000
ML_FALLBACK_ENABLED=true
ML_ROUTE_INTEGRATION_ENABLED=true
```

The shared ML documentation says its service currently has no token/API-key requirement. Keep `ML_SERVICE_TOKEN` blank unless the ML service owner enables authentication. These values belong in the Node backend local `backend/.env` and in the Node backend hosting provider's environment settings, never in the React/Vite frontend environment.

## Node routes exposed to authenticated callers

All proxy routes below are mounted under `/api/ml` and require the Node backend's JWT. The service checks the signed-in role before proxying a request.

| Node method + path | FastAPI method + path | Access |
|---|---|---|
| `GET /api/ml/health` | `GET /health` | Wholesaler, rider, shopkeeper |
| `POST /api/ml/route` | `POST /route` | Wholesaler |
| `POST /api/ml/routes/solve` | `POST /routes/solve` | Wholesaler |
| `POST /api/ml/batch` | `POST /batch` | Wholesaler |
| `POST /api/ml/routes/plan` | `POST /routes/plan` | Wholesaler |
| `POST /api/ml/travel-time` | `POST /travel-time` | Wholesaler, rider |
| `POST /api/ml/economics/costs` | `POST /economics/costs` | Wholesaler |

The proxy intentionally forwards the JSON body and returns the ML response shape. It does not persist a plan by itself. For a saved plan use the existing `/api/plans/*` workflow.

## Operational planning integration

When `ML_ROUTE_INTEGRATION_ENABLED=true` and `ML_SERVICE_URL` is configured:

- `POST /api/plans/preview` tries FastAPI `/batch` for automatic groups and `/routes/solve` plus `/economics/costs` for each displayed group.
- `POST /api/plans/auto-pool` tries `/batch` separately for each owned warehouse. A remote batch response is accepted only when every input order maps to exactly one local order and all local warehouse, time-window and distance constraints still pass.
- `POST /api/plans` and plans created by auto-pooling try `/routes/solve` and `/economics/costs`. An ML route sequence changes the displayed/persisted stop order only when every returned stop maps unambiguously to an order in that plan. Route distance/time from the service is retained as integration metadata because the schema does not confirm whether its distance includes a return to the warehouse.
- The existing local planner still independently checks time-window feasibility and computes estimated route metrics. Numeric economics values replace local costs only when both `solo_cost` and `pooled_cost` are numeric.
- `meta.mlIntegration` on a saved plan explains whether ML results were used, ignored, or replaced by the local fallback.

If a model response is malformed, omits orders, contains duplicate/unknown order IDs, or violates local safety constraints, the service uses local planning when `ML_FALLBACK_ENABLED=true`. Set it to `false` only when operators prefer ML failure to stop the operation.

## Schemas from the shared endpoint draft

The accompanying `KiranaPool_Exact_Endpoint_Schemas_Draft.docx` explicitly says the request and response schemas for `/route`, `/routes/solve`, `/batch`, `/economics/costs`, and `/routes/plan` are inferred. Exact stop/order item shapes, response values, required economics input combinations and valid `allocation_method` values are not confirmed by that draft alone.

The integration therefore:

- sends documented outer keys and mapping-safe order IDs/coordinates;
- validates ML output before using it for local database changes;
- falls back to local grouping/routing/cost estimates when the returned shape cannot be verified;
- exposes the raw pass-through endpoints above so a developer with a JWT can compare live responses.

Before treating these draft contracts as final, verify them against:

- `https://kiranapool-05x4.onrender.com/openapi.json`
- `https://kiranapool-05x4.onrender.com/docs`

A successful `/health` request only proves service health. It does not guarantee that every planning endpoint or inferred response shape works.

## Forecasting integration

Demand forecasting continues through the existing protected endpoint:

`POST /api/forecasts/run`

That controller builds a shop/history/slot request, calls FastAPI `POST /forecast`, validates the returned forecast rows, and upserts valid results into MongoDB. If the ML service cannot return valid forecast rows, the local historical-baseline forecaster is used when fallback is enabled.

The Node backend's API remains the frontend's API. The frontend should not call FastAPI directly or store backend secrets.

## Environment/security checklist

- Add `ML_SERVICE_URL=https://kiranapool-05x4.onrender.com` to the Node backend's local `.env` only if running locally.
- Set the same variable in the deployed Node backend's Render Environment.
- Keep `ML_SERVICE_TOKEN` blank unless the ML service requires it.
- Never commit `.env`, MongoDB URI, or JWT secret. Use `.env.example` only as a dummy template.
- CORS is configured separately via `FRONTEND_URL` and includes `http://localhost:5173` by default.

## Local validation

Run these commands from the `backend/` folder:

```bash
npm install
npm test
npm start
```

Test the Node health endpoint at `GET /api/health`. For ML proxy endpoints, send a valid Node backend JWT in `Authorization: Bearer <token>` and use the role listed in the endpoint table.

## Illustrative request bodies from the schema draft

These payloads show the draft's outer shape. The source document explicitly says exact item shapes are inferred; confirm them against the live OpenAPI schema before treating optional/extra fields as final.

### `POST /api/ml/route`

```json
{
  "orders": [
    { "order_id": "ord_1", "shop_id": "shop_1", "latitude": 26.9, "longitude": 75.8 }
  ]
}
```

### `POST /api/ml/routes/solve`

```json
{
  "stops": [
    { "order_id": "ord_1", "shop_id": "shop_1", "latitude": 26.9, "longitude": 75.8 },
    { "order_id": "ord_2", "shop_id": "shop_2", "latitude": 26.91, "longitude": 75.81 }
  ],
  "start_location": { "latitude": 26.92, "longitude": 75.82 },
  "algorithm": "auto"
}
```

### `POST /api/ml/batch`

```json
{
  "orders": [
    { "order_id": "ord_1", "shop_id": "shop_1", "latitude": 26.9, "longitude": 75.8 }
  ],
  "max_distance_km": 10,
  "max_time_window_minutes": 30,
  "max_orders_per_batch": 10,
  "max_weight_kg": 100
}
```

### `POST /api/ml/economics/costs`

```json
{
  "base_cost": 20,
  "cost_per_km": 5,
  "cost_per_drop": 8,
  "solo_distances": [2.5, 4.0],
  "shop_solo_costs": { "shop_1": 35, "shop_2": 42 },
  "total_pooled_cost": 50,
  "total_pooled_distance": 8.5,
  "num_orders": 2,
  "allocation_method": "proportional"
}
```

### `POST /api/ml/routes/plan`

The draft lists an `orders` array and optional batching constraints (`max_distance_km`, `max_time_window_minutes`, `max_orders_per_batch`, `max_weight_kg`), `start_location`, cost fields (`base_cost`, `cost_per_km`, `cost_per_drop`), `speed_kmh`, and `allocation_method`. Start with the exact `/docs` schema for the live service; do not assume the sample fields are all required or accepted.

The proxy endpoints require the Node backend's JWT. Example (PowerShell) after obtaining a wholesaler token:

```powershell
$headers = @{ Authorization = "Bearer YOUR_NODE_BACKEND_JWT" }
$body = @{ stops = @(@{ order_id = "ord_1"; shop_id = "shop_1"; latitude = 26.9; longitude = 75.8 }); start_location = @{ latitude = 26.92; longitude = 75.82 }; algorithm = "auto" } | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "http://localhost:5000/api/ml/routes/solve" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```
