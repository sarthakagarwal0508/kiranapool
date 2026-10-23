# MongoDB & Request Schemas — Auth + Shops

## User model (`User.js`) — collection `users`

| Field | Type | Required/default | Notes |
|---|---|---|---|
| `_id` | ObjectId | generated | MongoDB ID |
| `name` | String | required | trimmed |
| `email` | String | required | lowercase, trimmed, unique |
| `passwordHash` | String | optional | bcrypt hash; excluded from queries by default |
| `googleId` | String | optional | Google subject ID; sparse unique index |
| `role` | String | required | `shopkeeper` or `rider` |
| `createdAt` | Date | generated | timestamps enabled |
| `updatedAt` | Date | generated | timestamps enabled |

Passwords are bcrypt hashes, never plaintext. Do not send `passwordHash` or `googleId` to frontend.

### Public user object
```json
{
  "id": "<USER_ID>",
  "name": "Test Shopkeeper",
  "email": "shopkeeper1@example.com",
  "role": "shopkeeper"
}
```

## Shop model (`Shop.js`) — collection `shops`

| Field | Type | Required/default | Notes |
|---|---|---|---|
| `_id` | ObjectId | generated | MongoDB ID |
| `name` | String | required | trimmed |
| `owner` | ObjectId ref `User` | required | set from authenticated JWT |
| `ownerName` | String | default `""` | trimmed |
| `phone` | String | default `""` | trimmed |
| `address` | String | required | trimmed |
| `location.lat` | Number | required | -90 to 90 |
| `location.lng` | Number | required | -180 to 180 |
| `isActive` | Boolean | default `true` | availability |
| `createdAt` | Date | generated | timestamps enabled |
| `updatedAt` | Date | generated | timestamps enabled |

### Shop object
```json
{
  "_id": "<SHOP_ID>",
  "name": "Sharma Kirana",
  "owner": "<USER_ID>",
  "ownerName": "Amit Sharma",
  "phone": "9876543210",
  "address": "Malviya Nagar, Jaipur",
  "location": { "lat": 26.854, "lng": 75.824 },
  "isActive": true,
  "createdAt": "2026-10-23T00:00:00.000Z",
  "updatedAt": "2026-10-23T00:00:00.000Z"
}
```

## JWT payload
```json
{
  "role": "shopkeeper",
  "sub": "<USER_ID>",
  "iat": 0,
  "exp": 0
}
```
`iat` and `exp` are generated timestamps. Frontend should treat the JWT as an opaque token.

## Request schema summary
Signup:
```json
{ "name": "string", "email": "string", "password": "string (min 8)", "role": "shopkeeper | rider" }
```
Login:
```json
{ "email": "string", "password": "string" }
```
Google:
```json
{ "idToken": "real Google ID token", "role": "shopkeeper | rider (required for new account)" }
```
Create shop:
```json
{
  "name": "string",
  "ownerName": "string (optional)",
  "phone": "string (optional)",
  "address": "string",
  "location": { "lat": "number (-90..90)", "lng": "number (-180..180)" }
}
```
Update shop: partial fields from `name`, `ownerName`, `phone`, `address`, `location`, `isActive`. `name`/`address` cannot be empty.
