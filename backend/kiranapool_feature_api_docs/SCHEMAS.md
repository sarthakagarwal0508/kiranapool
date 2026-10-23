# KiranaPool MongoDB Schemas

**Version:** 0.2.0  
**Database:** MongoDB Atlas  
**ODM:** Mongoose

This document describes the User, Shop, Rider, Order, Plan and Forecast models.

---

## 1. User Schema

**Model:** `User`

| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, trimmed |
| `email` | String | Required, unique, lowercase, trimmed |
| `passwordHash` | String | Hidden by default from queries; used for local authentication |
| `googleId` | String | Optional, sparse unique |
| `role` | String | Required; `shopkeeper`, `wholesaler` or `rider` |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

### Example
```json
{
  "_id": "<USER_OBJECT_ID>",
  "name": "Aman Sharma",
  "email": "aman@example.com",
  "role": "shopkeeper"
}
```

Passwords must be stored as a secure hash, never as plaintext. `passwordHash` is not normally included in query results.

---

## 2. Shop Schema

**Model:** `Shop`

| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, trimmed |
| `owner` | ObjectId → User | Required, indexed |
| `ownerName` | String | Optional, default empty string |
| `phone` | String | Optional, default empty string |
| `address` | String | Required, trimmed |
| `location.lat` | Number | Required; -90 to 90 |
| `location.lng` | Number | Required; -180 to 180 |
| `area` | String | Optional; used for area-wise demand forecasting |
| `isActive` | Boolean | Default `true` |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

### Example
```json
{
  "_id": "<SHOP_OBJECT_ID>",
  "name": "Aman Kirana Store",
  "owner": "<USER_OBJECT_ID>",
  "ownerName": "Aman Sharma",
  "phone": "9876543210",
  "address": "Mansarovar, Jaipur",
  "location": {
    "lat": 26.854,
    "lng": 75.764
  },
  "isActive": true
}
```

One shopkeeper can own multiple shops.

---

## 3. Rider Schema

**Model:** `Rider`

| Field | Type | Rules |
|---|---|---|
| `user` | ObjectId → User | Required, unique, indexed |
| `name` | String | Required, trimmed |
| `phone` | String | Optional, default empty string |
| `vehicleType` | String | `bike`, `scooter`, `cycle`, `other`; default `bike` |
| `location.lat` | Number | Required; -90 to 90 |
| `location.lng` | Number | Required; -180 to 180 |
| `isAvailable` | Boolean | Default `true` |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

### Example
```json
{
  "_id": "<RIDER_OBJECT_ID>",
  "user": "<USER_OBJECT_ID>",
  "name": "Test Rider",
  "phone": "9876543210",
  "vehicleType": "bike",
  "location": {
    "lat": 26.9124,
    "lng": 75.7873
  },
  "isAvailable": true
}
```

Each rider account can have one Rider profile. Rider profile creation gets the `user` ID from the authenticated JWT, not from the request body.

---

## 4. Order Schema

**Model:** `Order`

| Field | Type | Rules |
|---|---|---|
| `shop` | ObjectId → Shop | Required |
| `warehouse` | ObjectId → Warehouse | Optional for legacy orders; required for Phase 6 pooling |
| `createdBy` | ObjectId → User | Account that entered the order |
| `orderSource` | String | `shopkeeper`, `wholesaler_manual` or `legacy` |
| `deliverySlotStart` / `deliverySlotEnd` | Date | Optional for legacy; required by controller for supply orders |
| `demoSeed` | Boolean | Default `false`; synthetic seed-data marker |
| `customerName` | String | Required |
| `customerPhone` | String | Optional in schema; controller requires it for legacy orders and defaults supply orders from the shop profile |
| `deliveryAddress` | String | Required |
| `location.lat` | Number | Delivery latitude |
| `location.lng` | Number | Delivery longitude |
| `items` | Array | At least one item required by controller |
| `items[].name` | String | Required by controller |
| `items[].quantity` | Number | Positive integer by controller |
| `items[].price` | Number | Non-negative by controller |
| `totalAmount` | Number | Required; calculated by controller |
| `status` | String | `pending`, `planned`, `picked`, `delivered`, `cancelled`; default `pending` |
| `deliveryWindowMin` | Number | Default `60` |
| `rider` | ObjectId → Rider | Optional, default `null` |
| `plan` | ObjectId → Plan | Optional, default `null` |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

### Example
```json
{
  "_id": "<ORDER_OBJECT_ID>",
  "shop": "<SHOP_OBJECT_ID>",
  "customerName": "Rahul Sharma",
  "customerPhone": "9876543210",
  "deliveryAddress": "Mansarovar, Jaipur",
  "location": {
    "lat": 26.854,
    "lng": 75.764
  },
  "items": [
    {
      "name": "Rice 1kg",
      "quantity": 2,
      "price": 60
    },
    {
      "name": "Cooking Oil 1L",
      "quantity": 1,
      "price": 140
    }
  ],
  "totalAmount": 260,
  "status": "pending",
  "deliveryWindowMin": 60,
  "rider": null,
  "plan": null
}
```

### Order total calculation

`totalAmount = Σ(quantity × price)`

In the example:

- Rice: 2 × 60 = 120
- Cooking Oil: 1 × 140 = 140
- Total: 260

**Implementation note:** Prices are currently accepted from the order request. A production implementation should validate them against trusted product records.

### Current status transitions

| Current status | Action | Next status |
|---|---|---|
| `pending` | Shopkeeper cancels own order | `cancelled` |
| `planned` | Assigned rider picks up | `picked` |
| `picked` | Assigned rider completes delivery | `delivered` |

The rider must be assigned to the order before updating delivery status.

---

## 5. Plan Schema

**Model:** `Plan`

The model backs Phase 6 route preview, plan creation, automatic pooling, rider assignment and delivery lifecycle APIs.

| Field | Type | Rules |
|---|---|---|
| `name` | String | Default `Delivery Plan` |
| `warehouse` | ObjectId → Warehouse | Warehouse that owns this route |
| `createdBy` | ObjectId → User | Wholesaler who generated the plan |
| `deliverySlotStart` / `deliverySlotEnd` | Date | Shared intersection of order delivery windows |
| `route` | Array<Mixed> | Ordered delivery stops |
| `orders` | Array<ObjectId → Order> | References orders in the plan |
| `rider` | ObjectId → Rider | Optional rider reference |
| `pooled` | Mixed/Object | Default empty object |
| `solo` | Mixed/Object | Default empty object |
| `savings` | Mixed/Object | Default empty object |
| `meta` | Mixed/Object | Default empty object |
| `status` | String | `draft`, `planned`, `completed`, `failed`, `cancelled`; default `draft` |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

`pooled` and `solo` store distance/cost/time estimates; `savings` stores total and per-shop savings; `meta` stores the estimates and algorithm assumptions.

---

## 6. Forecast Schema

**Model:** `Forecast`

The model backs Phase 7 shop/area and time-slot forecasts, actual-demand recording, and forecast summaries.

| Field | Type | Rules |
|---|---|---|
| `forecastDate` | Date | Required |
| `wholesaler` | ObjectId → User | Supplier who generated the forecast |
| `scope` | String | `shop` or `area` |
| `shop` | ObjectId → Shop | Optional, for shop-scope forecast |
| `area` | String | Area/locality grouping |
| `timeSlot` | String | `morning`, `afternoon`, `evening` |
| `slotStart` / `slotEnd` | Date | Forecast window boundaries |
| `confidence` | Number | Optional, 0–1 |
| `modelSource` | String | FastAPI model or local fallback |
| `predictedOrders` | Number | Required, minimum 0 |
| `actualOrders` | Number | Optional, default `null`, minimum 0 |
| `meta` | Mixed/Object | Default empty object |
| `createdAt` | Date | Automatic timestamp |
| `updatedAt` | Date | Automatic timestamp |

---

## 7. Warehouse Schema

**Model:** `Warehouse`

| Field | Type | Rules |
|---|---|---|
| `owner` | ObjectId → User | Required; role is `wholesaler` in API workflow |
| `name` | String | Required, trimmed |
| `supplierName` | String | Optional; defaults from the wholesaler account at create time |
| `address` | String | Required |
| `location.lat` / `location.lng` | Number | Required, geographic range checked |
| `serviceAreas` | Array<String> | Optional locality labels |
| `isActive` | Boolean | Default `true` |
| timestamps | Date | Automatic |

A wholesaler may own multiple warehouses. A pooled plan is always tied to exactly one warehouse; orders from different warehouses are never combined.

## 8. Entity Relationships

```text
User
 ├── Shopkeeper account → owns many Shops
 ├── Wholesaler account → owns many Warehouses
 └── Rider account → one Rider profile

Shop
 └── many Orders

Warehouse
 └── belongs to one Wholesaler and many Orders / Plans

Order
 ├── belongs to one Shop
 ├── optionally belongs to one Warehouse for B2B replenishment
 ├── optionally assigned to one Rider
 └── optionally linked to one Plan

Plan
 └── contains orders for one Warehouse and one shared time window
```

## 9. Current Module Status

| Module | Status |
|---|---|
| User model and authentication | Implemented |
| Shop model and CRUD APIs | Implemented and tested |
| Rider model and profile APIs | Implemented and tested |
| Order model and APIs | Implemented and tested |
| Plan model and APIs | Implemented; pooled route estimates and rider assignment |
| Forecast model and APIs | Implemented; FastAPI optional, baseline fallback available |

These schema descriptions reflect the model definitions and validation behavior documented during the current implementation. Future changes to model code should be reflected here as well.
