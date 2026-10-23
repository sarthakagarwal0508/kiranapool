# Shops APIs

**Feature:** Shop management and ownership protection  
**Base URL:** `http://localhost:5000/api`

All routes require JWT authentication.

## `GET /shops`
Lists shops visible to the authenticated user.
- Shopkeeper: own shops
- Rider: active shops
- Success: `200 OK`; returns `success`, `count`, `data`

## `GET /shops/:id`
Gets a single visible shop.
- Invalid ID: `400`
- Missing or not visible: `404`

## `POST /shops`
Creates a shop. **Shopkeeper only.**

### Request
```json
{
  "name": "Aman Kirana Store",
  "ownerName": "Aman Sharma",
  "phone": "9876543210",
  "address": "Mansarovar, Jaipur",
  "location": {
    "lat": 26.854,
    "lng": 75.764
  }
}
```
The owner is taken from the authenticated JWT, not from the request body.
- Success: `201 Created`

## `PATCH /shops/:id`
Updates a shop. **Owning shopkeeper only.**

Allowed fields:
- `name`
- `ownerName`
- `phone`
- `address`
- `location`
- `isActive`

- Success: `200 OK`
- Not owned/not found: `404`

## `DELETE /shops/:id`
Deletes a shop. **Owning shopkeeper only.**
- Only the authenticated owner can delete their shop.
- Success status/body depends on the implemented controller response.
