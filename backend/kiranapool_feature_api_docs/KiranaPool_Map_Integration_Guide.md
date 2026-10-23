# KiranaPool Map Integration Guide

## What changed in the backend

The backend now exposes a role-aware map payload and records when a rider last submitted GPS coordinates. Existing shop, warehouse, order, rider and plan location fields are reused; no external map-provider API key is required for this backend work.

## Authentication

All endpoints below require the existing JWT:

`Authorization: Bearer <accessToken>`

## 1. Get map data for the signed-in dashboard

**GET** `/api/map/overview`

The response is scoped by role:

- **Wholesaler:** own active warehouses, service-area shops, plans/orders from those warehouses, and riders associated with those plans/orders.
- **Rider:** their own rider location, assigned plans, active delivery orders, and relevant warehouses/shops.
- **Shopkeeper:** their own shops, active orders, and the relevant warehouse/rider details for those orders.

Example response shape:

```json
{
  "success": true,
  "generatedAt": "2026-10-23T10:00:00.000Z",
  "data": {
    "role": "rider",
    "rider": {
      "_id": "...",
      "name": "Rider Name",
      "location": { "lat": 26.9, "lng": 75.79 },
      "locationUpdatedAt": "2026-10-23T10:00:00.000Z"
    },
    "warehouses": [],
    "shops": [],
    "riders": [],
    "plans": [],
    "orders": []
  }
}
```

Arrays contain MongoDB documents with their normal `_id` values. Frontend markers should only be created when `location.lat` and `location.lng` are valid numbers. Plan `route` values are the backend's calculated route/stop sequence; render its coordinate-bearing entries only after checking their actual shape in the returned data.

## 2. Submit rider GPS coordinates

**PATCH** `/api/riders/me`

Rider role only. The rider browser/app must request location permission and send coordinates from the Geolocation API. Example body:

```json
{
  "location": {
    "lat": 26.9124,
    "lng": 75.7873
  }
}
```

Successful response returns the updated rider profile. `locationUpdatedAt` is set by the server whenever the location is updated. Do not let the frontend send `locationUpdatedAt` itself.

A simple demo can send a location update every 10–20 seconds while the rider is on an active delivery, and stop updates when the delivery ends or the user signs out. Ask permission, handle permission denial, and avoid tracking in the background without clear user consent. This API stores the latest location only; it is not a historical GPS trail and does not use WebSockets.

## 3. Refreshing live locations

For the hackathon demo, the dashboard can poll `GET /api/map/overview` every 5–10 seconds while its map screen is visible. A later iteration can use Socket.IO or server-sent events if continuous updates are needed. Polling should stop when the map view is closed/unmounted.

## 4. Map provider / API key

- React Leaflet is a frontend dependency, not a backend dependency.
- OpenStreetMap-based tiles generally do not require a secret key for a basic demo. Internet access is required and visible map attribution must remain displayed.
- The public OpenStreetMap tile service is best-effort and has usage rules/no uptime guarantee. For production or heavy traffic, choose a tile provider and follow its terms.
- Road-following navigation is not provided by Leaflet itself. The current backend route planner returns a route/stop sequence and estimated metrics; it should not be described as turn-by-turn road routing unless a routing provider is integrated.

## 5. Test checklist

1. Start the backend with its existing environment variables configured.
2. Sign in separately as a wholesaler, rider, and shopkeeper; use each JWT to call `GET /api/map/overview`.
3. Confirm each role receives only the data described above.
4. With a rider JWT, call `PATCH /api/riders/me` with valid numeric latitude/longitude.
5. Call `GET /api/map/overview` again and verify the rider location and `locationUpdatedAt` changed.
6. Try invalid coordinates (latitude outside -90..90 or longitude outside -180..180); the update should return HTTP 400.
7. Confirm the frontend displays OpenStreetMap attribution and gracefully handles empty coordinate arrays / denied GPS permission.

## Notes / limitations

- Coordinates must already exist in the database for shops, warehouses and orders. This change does not geocode text addresses into coordinates.
- The rider's latest location is shared only through role-scoped map data: wholesalers see riders tied to their own plans/orders; riders see their own profile; shopkeepers see rider information associated with their active orders.
- Run the existing test suite with `npm test` after installing dependencies. This environment's package source was not connected to a live MongoDB instance, so database-backed end-to-end behavior still needs to be verified in your environment.
