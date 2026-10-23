# KiranaPool — Phase 6 & 7 Backend API Guide

Base URL: `http://localhost:5000/api`  
Authentication: `Authorization: Bearer <JWT>` unless noted.  
Roles: `shopkeeper` = kirana retailer, `wholesaler` = supplier/warehouse owner, `rider` = delivery rider.

## Recommended end-to-end workflow

1. Sign up/login as `wholesaler`.
2. Create one or more warehouses with `POST /warehouses`.
3. Sign up/login as `shopkeeper`, create a kirana shop with `POST /shops`.
4. As the wholesaler, call `GET /shops` to select an active kirana in the service areas, then record an offline order with `POST /orders/manual`; alternatively, the shopkeeper can place a supply order via `POST /orders` with a warehouse and future slot.
5. As the wholesaler, use `POST /plans/preview`, then `POST /plans` to create a selected plan, or `POST /plans/auto-pool` to batch all compatible pending orders.
6. Assign a rider with `PATCH /plans/:id/assign-rider`.
7. The rider gets assigned orders from `GET /orders` and updates each order with `PATCH /orders/:id/status` (`planned` → `picked` → `delivered`). A plan completes when all its orders are delivered.
8. Generate forecasts using `POST /forecasts/run`; the Node backend calls FastAPI if configured, otherwise it runs its local fallback forecast.

## Warehouses

### `POST /warehouses` — wholesaler only

```json
{
  "name": "Jaipur Central Warehouse",
  "supplierName": "Fresh Wholesale",
  "address": "Sitapura Industrial Area, Jaipur",
  "location": { "lat": 26.785, "lng": 75.850 },
  "serviceAreas": ["Mansarovar", "Malviya Nagar"]
}
```

### `GET /warehouses`

Wholesalers see their own warehouses. Shopkeepers and riders see active warehouses for selecting/viewing supply sources. Optional query: `?area=Mansarovar`.

`GET /shops` lists the current shopkeeper's own shops; wholesalers can select active shops in their warehouse service areas (or all active shops if no service areas are configured); riders see active shops for delivery context. This lets a wholesaler record the first manual order without needing a previous order ID.

### `PATCH /warehouses/:id` — owning wholesaler only

Updates `name`, `supplierName`, `address`, `location`, `serviceAreas` or `isActive`.

## Supply orders

`POST /orders` remains shopkeeper-only and preserves the original Phase 5 request shape. For a wholesaler supply order use:

```json
{
  "shop": "<SHOP_ID>",
  "warehouse": "<ACTIVE_WAREHOUSE_ID>",
  "deliverySlotStart": "2030-01-01T10:00:00+05:30",
  "deliverySlotEnd": "2030-01-01T12:00:00+05:30",
  "items": [
    { "name": "Rice 25kg", "quantity": 2, "price": 1250 },
    { "name": "Cooking Oil 5L", "quantity": 3, "price": 700 }
  ]
}
```

For supply orders, shop name/phone/address/location are taken from the selected shop when omitted. `deliverySlotStart` and `deliverySlotEnd` must be future dates, and end must be after start. Orders created without `warehouse` continue to work with the legacy Phase 5 fields but are not eligible for pooling.

### `POST /orders/manual` — wholesaler only

Use this when a kirana shop gives an order offline/by phone and the wholesaler records it. The `shop` must be a registered active shop; the wholesaler can set its delivery location/time slot in the payload.

```json
{
  "shop": "<SHOP_ID>",
  "warehouse": "<WAREHOUSE_ID_OWNED_BY_THIS_WHOLESALER>",
  "deliveryAddress": "Shop 12, Mansarovar, Jaipur",
  "location": { "lat": 26.854, "lng": 75.764 },
  "deliverySlotStart": "2030-01-01T10:00:00+05:30",
  "deliverySlotEnd": "2030-01-01T12:00:00+05:30",
  "items": [{ "name": "Rice 25kg", "quantity": 2, "price": 1250 }]
}
```

Wholesalers see only orders placed against their own warehouses; shopkeepers see only orders for their own shops; riders see only their assigned orders. `PATCH /orders/:id/status` lets shopkeepers or wholesalers cancel only a pending order; riders can transition assigned orders from `planned` to `picked` to `delivered`.

## Delivery planning and pooling

### `POST /plans/preview` — wholesaler only

```json
{
  "warehouseId": "<WAREHOUSE_ID>",
  "orderIds": ["<ORDER_ID_1>", "<ORDER_ID_2>"]
}
```

`orderIds` is optional. Without it, the backend previews all pending/unplanned supply orders from that warehouse. Optional `slotStart` and `slotEnd` filter the preview. If `orderIds` is provided, returns a preview for that one proposed plan. Without it, returns candidate groups already clustered by time/location compatibility. Each group includes a suggested stop order, estimated pooled and solo distances/costs/time, total and shop-wise savings, and slot feasibility. Preview never changes order statuses.

Compatibility aliases from the earlier API notes are also supported: `POST /plan` and `GET /plan/latest`. Use the plural `/plans` routes for the full current API.

### `POST /plans` — wholesaler only

```json
{
  "name": "Morning Jaipur Run",
  "warehouseId": "<WAREHOUSE_ID>",
  "orderIds": ["<ORDER_ID_1>", "<ORDER_ID_2>"]
}
```

Creates the plan and moves its pending orders to `planned`. Orders must belong to the selected warehouse, have overlapping delivery windows, fit the configured stop/spread limits, and fit the estimated delivery slot. Distinct warehouses are never pooled.

### `POST /plans/auto-pool` — wholesaler only

Optional body: `{ "warehouseId": "<WAREHOUSE_ID>" }`. Without `warehouseId`, scans all active warehouses owned by the wholesaler. Groups pending/unplanned orders by exact warehouse, overlapping time slots and delivery-location spread, then creates planned routes for compatible groups. Single eligible orders may also become one-stop plans so they can be assigned/delivered.

### `GET /plans`, `GET /plans/latest`, `GET /plans/:id`

Wholesalers can see plans for their warehouses. Riders can see plans assigned to their rider profile only.

### `PATCH /plans/:id/assign-rider` — wholesaler only

```json
{ "riderId": "<RIDER_PROFILE_ID>" }
```

`riderId` is the MongoDB `_id` from `GET /riders`, not the user ID. Rider must be available and not already assigned an active plan. Assignment links the rider to the plan and all orders in it.

### `POST /plans/:id/cancel` — wholesaler only

Cancels a planned delivery only if delivery has not begun; orders return to `pending` and rider assignment is cleared.

## Forecasting / Phase 7

### `POST /forecasts/run` — wholesaler only

```json
{ "horizonDays": 7, "groupBy": "both" }
```

`horizonDays`: 1–30, default 7. `groupBy`: `both`, `shop` or `area`. Produces shop-wise and/or area-wise forecasts for morning (08:00–12:00), afternoon (12:00–17:00) and evening (17:00–21:00) in `Asia/Kolkata`.

### `GET /forecasts`

Wholesalers see their forecasts; shopkeepers see forecasts associated with their own shop(s). Optional filters: `scope`, `shopId`, `area`, `from`, `to`.

### `GET /forecasts/summary` — wholesaler only

Aggregated predicted/recorded order counts by scope, area and time slot.

### `PATCH /forecasts/:id/actual` — wholesaler only

```json
{ "actualOrders": 8 }
```

Records the actual demand against one of the wholesaler's forecast rows for later evaluation.

## Demo data

Run from `backend/`:

```bash
npm run seed:demo
```

Demo accounts use the password `KiranaDemo@123`:

- `demo.wholesaler@kiranapool.test`
- `demo.shopkeeper1@kiranapool.test` through `demo.shopkeeper4@kiranapool.test`
- `demo.rider@kiranapool.test`

The seed script creates 2 warehouses, 4 kirana shops, one rider, 4 weeks of synthetic historical supply orders and future pending orders with compatible delivery slots. It refreshes only orders marked `demoSeed: true` and plans/forecasts for the demo wholesaler; do not use these credentials outside a local/demo environment.
