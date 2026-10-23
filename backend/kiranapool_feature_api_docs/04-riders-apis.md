# Rider APIs

**Feature:** Rider profile, directory and availability  
**Base URL:** `http://localhost:5000/api`

All endpoints require JWT authentication.

## `GET /riders`
Lists rider profiles.
- Access: Authenticated users
- Success: `200 OK`

## `GET /riders/:id`
Gets one rider profile.
- Invalid ID: `400`
- Missing rider: `404`

## `POST /riders`
Creates a profile for the authenticated rider. **Rider only.**

### Request
```json
{
  "name": "Test Rider",
  "phone": "9876543210",
  "vehicleType": "bike",
  "location": {
    "lat": 26.9124,
    "lng": 75.7873
  }
}
```
- `vehicleType`: `bike`, `scooter`, `cycle`, `other`
- `user` reference is taken from JWT
- One profile per rider account
- Success: `201 Created`
- Duplicate profile: `409 Conflict`

## `GET /riders/me`
Returns the logged-in rider's profile. **Rider only.**
- Profile not created: `404`
- Success: `200 OK`

## `PATCH /riders/me`
Updates the logged-in rider's profile. **Rider only.**

Allowed fields:
- `name`
- `phone`
- `vehicleType`
- `location`
- `isAvailable`

### Request example
```json
{
  "vehicleType": "scooter",
  "isAvailable": false,
  "location": {
    "lat": 26.915,
    "lng": 75.79
  }
}
```
The rider cannot update their linked `user` identity or delivery assignment through this endpoint.

## Security note
Current list/detail responses include rider profile fields such as phone and location. Consider restricting these fields before production.
