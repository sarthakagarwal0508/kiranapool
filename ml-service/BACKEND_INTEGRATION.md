# KiranaPool ML Service — Backend Integration Documentation

This document provides the integration specification requested by the backend team to connect Node.js/Express to the Python FastAPI ML microservice.

---

## 1. Service URL Configuration (`ML_SERVICE_URL`)

Set the following environment variable in the backend environment file (`backend/.env`):

```env
# Local Development
ML_SERVICE_URL=http://localhost:8000

# Production / Cloud Deployment (Render / Railway / Cloud Run)
# Replace with the deployed ML service URL
ML_SERVICE_URL=https://<your-ml-service>.onrender.com
```

### Health Check Endpoint
- **URL:** `GET ${ML_SERVICE_URL}/health`
- **Response (200 OK):**
```json
{
  "status": "healthy",
  "service": "KiranaPool ML Service",
  "version": "1.0.0"
}
```

---

## 2. Actual `/forecast` Endpoint Specification

- **HTTP Method:** `POST`
- **Endpoint Path:** `/forecast`
- **URL:** `${ML_SERVICE_URL}/forecast`
- **Headers:**
  ```http
  Content-Type: application/json
  Accept: application/json
  ```

### Request Payload Schema

The endpoint natively handles the Node.js backend forecasting contract:

```json
{
  "horizonDays": 7,
  "groupBy": "both",
  "shops": [
    {
      "shopId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Sharma Kirana Store",
      "area": "Mansarovar"
    }
  ],
  "history": [
    {
      "shopId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "area": "Mansarovar",
      "deliverySlotStart": "2026-10-23T09:00:00.000Z"
    }
  ],
  "slots": [
    { "key": "morning", "startHour": 8, "endHour": 12 },
    { "key": "afternoon", "startHour": 12, "endHour": 17 },
    { "key": "evening", "startHour": 17, "endHour": 21 }
  ]
}
```

#### Request Parameters Reference:
| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `horizonDays` | `integer` | No | `7` | Forecast projection range in days (`1` to `30`). |
| `groupBy` | `string` | No | `"both"` | Aggregation scope: `"shop"`, `"area"`, or `"both"`. |
| `shops` | `array[object]` | Yes | `[]` | List of registered shops (`shopId`/`_id`, `name`, `area`). |
| `history` | `array[object]` | No | `[]` | Historical delivered orders with timestamps and shop/area IDs. |
| `slots` | `array[object]` | No | standard 3 slots | Time window bins with `key`, `startHour` (0-23), `endHour` (1-24). |

---

## 3. Response Contract Compliance

The response strictly adheres to the schema required for MongoDB persistence and frontend display.

### Response JSON Structure:
```json
{
  "forecasts": [
    {
      "forecastDate": "2026-10-24T00:00:00+05:30",
      "scope": "shop",
      "shop": "65f1a2b3c4d5e6f7a8b9c0d1",
      "area": "Mansarovar",
      "timeSlot": "morning",
      "slotStart": "2026-10-24T08:00:00+05:30",
      "slotEnd": "2026-10-24T12:00:00+05:30",
      "predictedOrders": 1.0,
      "confidence": 0.82,
      "modelSource": "fastapi-ml",
      "meta": {
        "algorithm": "historical-average",
        "shopId": "65f1a2b3c4d5e6f7a8b9c0d1"
      }
    },
    {
      "forecastDate": "2026-10-24T00:00:00+05:30",
      "scope": "area",
      "shop": null,
      "area": "Mansarovar",
      "timeSlot": "morning",
      "slotStart": "2026-10-24T08:00:00+05:30",
      "slotEnd": "2026-10-24T12:00:00+05:30",
      "predictedOrders": 2.0,
      "confidence": 0.85,
      "modelSource": "fastapi-ml",
      "meta": {
        "algorithm": "historical-average-area",
        "area": "Mansarovar"
      }
    }
  ],
  "modelSource": "fastapi-ml",
  "meta": {
    "total_rows": 2,
    "horizonDays": 1
  }
}
```

### Field Specifications:
| Field Name | Type | Nullable | Description / Validation |
| :--- | :--- | :--- | :--- |
| `forecastDate` | `string (ISO 8601)` | No | Date of predicted demand (`YYYY-MM-DDT00:00:00+05:30`). |
| `scope` | `string` | No | Target entity: `"shop"` or `"area"`. |
| `shop` | `string` | Yes | Target shop ID when `scope === "shop"`; `null` when `scope === "area"`. |
| `area` | `string` | No | Operational locality/cluster name (e.g. `"Mansarovar"`). |
| `timeSlot` | `string` | No | Delivery window key (e.g. `"morning"`, `"afternoon"`, `"evening"`). |
| `slotStart` | `string (ISO 8601)` | No | Start timestamp of the delivery slot window. |
| `slotEnd` | `string (ISO 8601)` | No | End timestamp of the delivery slot window. |
| `predictedOrders`| `number (float)` | No | Volume forecast (floored to positive integer/float, $\ge 1.0$). |
| `confidence` | `number (float)` | No | Statistical score between `0.0` and `1.0` (`0.82` - `0.85`). |
| `modelSource` | `string` | No | Constant identifier `"fastapi-ml"`. |
| `meta` | `object` | No | Metadata containing model algorithm and shop/area references. |

---

## 4. Authentication Details

- **Auth Requirement:** **None** (Open internal microservice).
- **Tokens / API Keys:** No Bearer tokens, headers, or API keys are required.
- **CORS Configuration:** Enabled for all origins (`*`), supporting cross-origin requests from frontend and backend services.

---

## 5. Test Request & Verified Response

### cURL Verification Command

Run this command directly in your terminal to test communication with the ML service:

```bash
curl -X POST "http://localhost:8000/forecast" \
  -H "Content-Type: application/json" \
  -d '{
    "horizonDays": 1,
    "groupBy": "both",
    "shops": [
      {
        "shopId": "shop_101",
        "name": "Sharma Kirana",
        "area": "Mansarovar"
      }
    ],
    "history": [
      {
        "shopId": "shop_101",
        "area": "Mansarovar",
        "deliverySlotStart": "2026-10-23T09:00:00Z"
      }
    ],
    "slots": [
      {
        "key": "morning",
        "startHour": 8,
        "endHour": 12
      }
    ]
  }'
```

### Actual Verified HTTP Response (Status: `200 OK`)

```json
{
  "forecasts": [
    {
      "forecastDate": "2026-10-24T00:00:00+05:30",
      "scope": "shop",
      "shop": "shop_101",
      "area": "Mansarovar",
      "timeSlot": "morning",
      "slotStart": "2026-10-24T08:00:00+05:30",
      "slotEnd": "2026-10-24T12:00:00+05:30",
      "predictedOrders": 1.0,
      "confidence": 0.82,
      "modelSource": "fastapi-ml",
      "meta": {
        "algorithm": "historical-average",
        "shopId": "shop_101"
      }
    },
    {
      "forecastDate": "2026-10-24T00:00:00+05:30",
      "scope": "area",
      "shop": null,
      "area": "Mansarovar",
      "timeSlot": "morning",
      "slotStart": "2026-10-24T08:00:00+05:30",
      "slotEnd": "2026-10-24T12:00:00+05:30",
      "predictedOrders": 2.0,
      "confidence": 0.85,
      "modelSource": "fastapi-ml",
      "meta": {
        "algorithm": "historical-average-area",
        "area": "Mansarovar"
      }
    }
  ],
  "modelSource": "fastapi-ml",
  "meta": {
    "total_rows": 2,
    "horizonDays": 1
  }
}
```

---

## 6. Other Available ML Endpoints (For Reference)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status. |
| `POST` | `/routes/plan` | End-to-end order batching, TSP route solving, travel time estimation, and cost savings calculation. |
| `POST` | `/routes/solve` | Sequenced route optimization for a list of drop stops. |
| `POST` | `/batch` | Order grouping based on geographic radius, time window, and load capacity. |
| `POST` | `/travel-time` | Travel duration calculation from distance and speed. |
| `POST` | `/economics/costs` | Solo cost vs pooled delivery cost and percentage savings calculation. |
