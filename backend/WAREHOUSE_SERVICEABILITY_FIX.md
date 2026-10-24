# Warehouse-to-shop serviceability fix

## What changed

Order creation now keeps existing exact service-area matching, but also accepts an order when the shop's saved coordinates and selected warehouse's saved coordinates are within a configurable nearby radius—even if the textual area names differ.

The same check is used for both:
- `POST /api/orders` (shopkeeper order placement)
- `POST /api/orders/manual` (wholesaler records an order)

## Distance rule

- Default radius: **25 km straight-line distance** (Haversine calculation).
- Override in Render backend environment with `WAREHOUSE_MAX_DELIVERY_DISTANCE_KM`, for example `25`.
- If the warehouse's `serviceAreas` is empty, prior behavior is preserved: it has no area restriction.
- If names match, the order is accepted as before.
- If names mismatch, both stored coordinates must be valid and within the radius.
- If they are farther apart, the API returns `400` with `code: "WAREHOUSE_OUT_OF_SERVICE_AREA"` plus the measured `distanceKm` and `maxDistanceKm`.

The distance calculation uses saved shop and warehouse locations, not client-submitted order coordinates, to avoid users bypassing the check by changing the request body.

## Deployment

Keep the existing `.env` and Render secrets unchanged. `WAREHOUSE_MAX_DELIVERY_DISTANCE_KM` is optional because the backend defaults to 25 km. Set it in Render only if you want another radius, then redeploy.

After deploying, retry order creation. If it still returns a 400, read the response JSON's `message`, `distanceKm`, and `maxDistanceKm`; other validations such as delivery slots, item shape, or location can still return 400 for separate reasons.

## Validation

Added unit tests cover exact area matches, nearby-coordinate acceptance, rejection beyond the radius, unrestricted warehouses, and distance calculations. Full backend test suite: 22 tests passed in local execution. Live production database/API behavior has not been tested from this package build.
