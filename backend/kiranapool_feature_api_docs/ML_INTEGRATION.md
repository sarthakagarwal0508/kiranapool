# FastAPI ML Integration Contract

The Express backend owns authentication, authorization, database writes and API response shaping. The teammate's Python/FastAPI service owns the predictive model logic. The Node backend calls `POST {ML_SERVICE_URL}/forecast` when `ML_SERVICE_URL` is configured; if the URL already ends in `/forecast`, it calls it as-is.

## Request payload sent by Node

```json
{
  "horizonDays": 7,
  "groupBy": "both",
  "timezone": "Asia/Kolkata",
  "slots": [
    { "key": "morning", "startHour": 8, "endHour": 12 },
    { "key": "afternoon", "startHour": 12, "endHour": 17 },
    { "key": "evening", "startHour": 17, "endHour": 21 }
  ],
  "history": [
    {
      "orderId": "<ORDER_ID>", "shopId": "<SHOP_ID>", "shopName": "Demo Kirana",
      "area": "Mansarovar", "orderDate": "2030-01-01T00:00:00.000Z",
      "deliverySlotStart": "2030-01-01T03:30:00.000Z",
      "deliverySlotEnd": "2030-01-01T05:30:00.000Z",
      "status": "delivered", "totalAmount": 2500,
      "warehouseId": "<WAREHOUSE_ID>", "itemsCount": 3
    }
  ],
  "shops": [
    { "shopId": "<SHOP_ID>", "name": "Demo Kirana", "area": "Mansarovar", "location": { "lat": 26.854, "lng": 75.764 } }
  ]
}
```

Actual request arrays can contain multiple historical order and shop rows; sample values above are illustrative.

## Response contract

Return either an array of rows or `{ "model": "your-model-version", "forecasts": [...] }`.

```json
{
  "model": "kirana-demand-v1",
  "forecasts": [
    {
      "forecastDate": "2030-01-02T00:00:00+05:30",
      "scope": "shop",
      "shopId": "<SHOP_ID>",
      "area": "Mansarovar",
      "timeSlot": "morning",
      "predictedOrders": 4.2,
      "confidence": 0.83,
      "meta": { "features": ["recent_frequency", "weekday", "time_slot"] }
    },
    {
      "forecastDate": "2030-01-02T00:00:00+05:30",
      "scope": "area",
      "area": "Mansarovar",
      "timeSlot": "morning",
      "predictedOrders": 18.6,
      "confidence": 0.79,
      "meta": { "features": ["area_history", "weekday", "time_slot"] }
    }
  ]
}
```

Required fields per row: `forecastDate`, `timeSlot` (`morning|afternoon|evening`), and a finite non-negative `predictedOrders`. `scope` must be `shop` or `area`; shop-scope rows need `shopId` (or `shop`). Optional values: `area`, `confidence` (0–1), `slotStart`, `slotEnd`, `meta`. Dates are normalized to an India-calendar day before being stored.

## Configuration and fallback

```env
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TOKEN=
ML_SERVICE_TIMEOUT_MS=5000
ML_FALLBACK_ENABLED=true
```

If the service is offline, times out or returns invalid data, `ML_FALLBACK_ENABLED=true` makes the backend use a local baseline: the average observed same-weekday / same-time-slot order count over the recent four-week history. The API includes a warning when it falls back. Set `ML_FALLBACK_ENABLED=false` to fail instead. The fallback is a demo baseline, not a substitute for the teammate's trained model.

Node forecast routes:
- `POST /api/forecasts/run`
- `GET /api/forecasts`
- `GET /api/forecasts/summary`
- `PATCH /api/forecasts/:id/actual`
