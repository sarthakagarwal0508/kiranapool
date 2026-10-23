# KiranaPool API Reference — Auth + Shops

## Conventions
Base URL: `http://localhost:5000/api`
JSON requests use `Content-Type: application/json`.
Protected routes require `Authorization: Bearer <KIRANAPOOL_JWT>`.
The Google ID token is only sent to `/auth/google`; other protected APIs use the KiranaPool JWT.

## Authentication

### POST `/auth/signup`
No auth required.
Request:
```json
{
  "name": "Test Shopkeeper",
  "email": "shopkeeper1@example.com",
  "password": "TestPass123!",
  "role": "shopkeeper"
}
```
Fields: `name` string; `email` string; `password` minimum 8 characters; `role` is `shopkeeper` or `rider`.
Success: `201 Created`, returns `token` and `user`.
Errors: `400` invalid input; `409` duplicate email.

### POST `/auth/login`
No auth required.
Request:
```json
{
  "email": "shopkeeper1@example.com",
  "password": "TestPass123!"
}
```
Success: `200 OK`, returns `token` and `user`.
Errors: `400` missing credentials; `401` invalid credentials.

### POST `/auth/google`
No auth required.
Request:
```json
{
  "idToken": "<REAL_GOOGLE_ID_TOKEN>",
  "role": "shopkeeper"
}
```
The token must come from Google Sign-In and be verified by the backend. `role` is needed for a new account and must be `shopkeeper` or `rider`. Existing accounts retain their stored role. Requires `GOOGLE_CLIENT_ID` in backend `.env`.
Success: `200 OK`, returns a KiranaPool JWT and user. Errors can include `400`, `401`, `409`, or `500` for missing configuration. Real Google token flow is not confirmed tested yet.

### GET `/auth/me`
Requires Bearer JWT.
Returns current user:
```json
{
  "success": true,
  "user": {
    "id": "<USER_ID>",
    "name": "Test Shopkeeper",
    "email": "shopkeeper1@example.com",
    "role": "shopkeeper"
  }
}
```
Errors: `401` missing/invalid/expired token or account no longer exists.

## Shops

All shop endpoints require a valid KiranaPool JWT.

### GET `/shops`
Lists visible shops. Shopkeepers see their own shops; riders see active shops only.
Success: `200 OK`, `{ "success": true, "count": 0, "data": [] }`.

### POST `/shops`
Allowed role: `shopkeeper`. Backend sets `owner` from authenticated JWT; do not send owner from frontend.
Request:
```json
{
  "name": "Sharma Kirana",
  "ownerName": "Amit Sharma",
  "phone": "9876543210",
  "address": "Malviya Nagar, Jaipur",
  "location": { "lat": 26.854, "lng": 75.824 }
}
```
Success: `201 Created`, created shop in `data`.
Errors: `400` invalid name/address/location; `401` no/invalid token; `403` wrong role.

### GET `/shops/:id`
Shopkeepers can access their own shops; riders can access active shops.
Errors: `400` malformed ID; `401` auth failure; `404` missing/not visible.

### PATCH `/shops/:id`
Allowed role: `shopkeeper`; owner only.
Supported fields: `name`, `ownerName`, `phone`, `address`, `location`, `isActive`.
Example:
```json
{ "name": "Sharma Kirana Store", "isActive": true }
```
Errors: `400` invalid input/ID; `401` auth failure; `403` wrong role; `404` missing or not owned.

### DELETE `/shops/:id`
Allowed role: `shopkeeper`; owner only. This permanently deletes the shop document.
Errors: `400` malformed ID; `401` auth failure; `403` wrong role; `404` missing or not owned.

## Health
### GET `/health`
Full URL: `http://localhost:5000/api/health`. No auth required.

## Frontend usage
Suggested Vite env:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```
Fetch helper:
```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "API request failed");
  return data;
}
```
After successful auth: `localStorage.setItem("token", response.token)`.
Logout: `localStorage.removeItem("token")`.
Frontend role checks are only for UI; backend remains responsible for access control.
