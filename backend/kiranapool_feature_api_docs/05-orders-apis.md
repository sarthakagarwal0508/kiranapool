# Orders APIs

**Feature:** Order creation, role-based listing, order details and status lifecycle  
**Base URL:** `http://localhost:5000/api`

All endpoints require JWT authentication.

## `POST /orders`
Creates an order for a shop owned by the authenticated user. **Shopkeeper only.**

### Request
```json
{
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
  "deliveryWindowMin": 60
}
```
The controller calculates `totalAmount = sum(quantity × price)`. Example total: `260`.

- Success: `201 Created`
- Invalid request: `400`
- Shop not found/not owned: `404`

## `GET /orders`
Lists orders visible to the authenticated user.
- Shopkeeper: orders belonging to their shops
- Rider: orders assigned to their Rider profile
- Optional filter: `GET /orders?status=pending`
- Supported statuses: `pending`, `planned`, `picked`, `delivered`, `cancelled`
- Success: `200 OK`

## `GET /orders/:id`
Gets one order only if visible to the current user.
- Shopkeeper: order belongs to their shop
- Rider: order is assigned to them
- Invalid ID: `400`
- Missing/not visible: `404`

## `PATCH /orders/:id/status`
Updates an order's status subject to role and transition rules.

### Request example — cancel pending order
```json
{
  "status": "cancelled"
}
```

Rules:
- Shopkeeper can cancel only a `pending` order from their own shop.
- Assigned rider can transition `planned` → `picked` → `delivered`.
- Rider must be assigned to that order.
- Invalid transition: `400`
- Access denied/unassigned rider: `403`

## Important implementation notes
- Rider status updates require an order assigned to that rider and currently in `planned` or `picked` status.
- Rider assignment and plan creation are part of the upcoming delivery-planning phase.
- Item prices are currently supplied in the request; production code should validate them against a trusted product catalogue.
