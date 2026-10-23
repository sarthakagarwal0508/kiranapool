# KiranaPool API Documentation

**Version:** 0.2.0  
**Backend:** Node.js, Express.js, MongoDB Atlas  
**Authentication:** JWT Bearer Token

## Base URL

Local development:

`http://localhost:5000/api`

## Authentication

Protected endpoints ke liye request header:

`Authorization: Bearer <JWT_TOKEN>`

Supported roles:
- `shopkeeper`
- `rider`

Admin role supported nahi hai.

---

## 1. Health API

### `GET /health`

API aur MongoDB connection status check karta hai.

**Authentication:** Not required

**Success — `200 OK`**
```json
{
  "success": true,
  "message": "KiranaPool API is healthy",
  "services": {
    "api": "running",
    "database": "connected"
  }
}
```

Database disconnected hone par `503 Service Unavailable` return hota hai.

---

## 2. Authentication APIs

### 2.1 Signup

`POST /auth/signup`

Naya shopkeeper ya rider account create karta hai.

**Request body**
```json
{
  "name": "Aman Sharma",
  "email": "aman@example.com",
  "password": "example-password",
  "role": "shopkeeper"
}
```

Rules:
- Password minimum 8 characters.
- Email unique hona chahiye.
- Role `shopkeeper` ya `rider` hona chahiye.

**Success:** `201 Created`

**Possible errors:** `400` validation error, `409` duplicate email.

### 2.2 Login

`POST /auth/login`

**Request body**
```json
{
  "email": "aman@example.com",
  "password": "example-password"
}
```

**Success:** `200 OK`; JWT token aur user information return hoti hai.

Invalid credentials: `401 Unauthorized`.

### 2.3 Google Authentication

`POST /auth/google`

Google Sign-In ID token verify karke KiranaPool JWT issue karta hai.

Request body mein Google ID token aur, new account ke case mein, role bheja jata hai. Exact token field controller ke implementation ke saath match honi chahiye.

**Configuration:** `GOOGLE_CLIENT_ID`

**Note:** Real Google Sign-In token flow ki live testing abhi separately verify karni hai.

### 2.4 Current User

`GET /auth/me`

**Authentication:** Required

Logged-in user ki basic details return karta hai:
- `id`
- `name`
- `email`
- `role`

---

## 3. Shops APIs

Saare Shops endpoints par JWT required hai.

### 3.1 List Shops

`GET /shops`

- Shopkeeper: apni owned shops.
- Rider: active shops.

**Success:** `200 OK`

### 3.2 Get Shop by ID

`GET /shops/:id`

Specified shop ki details return karta hai, agar authenticated user us shop ko access kar sakta hai.

**Possible errors:** `400` invalid ID, `404` shop not found ya user ko access nahi hai.

### 3.3 Create Shop

`POST /shops`

**Access:** Shopkeeper only

**Request body**
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

Shop ka owner authenticated JWT se set hota hai, request body se nahi.

**Success:** `201 Created`

### 3.4 Update Shop

`PATCH /shops/:id`

**Access:** Owning shopkeeper only

Allowed fields:
- `name`
- `ownerName`
- `phone`
- `address`
- `location`
- `isActive`

**Success:** `200 OK`

### 3.5 Delete Shop

`DELETE /shops/:id`

**Access:** Owning shopkeeper only

Sirf authenticated shopkeeper ki apni shop delete ho sakti hai.

---

## 4. Rider APIs

Saare Rider endpoints par JWT required hai.

### 4.1 List Riders

`GET /riders`

Rider profiles ki list return karta hai.

**Access:** Authenticated users

### 4.2 Get Rider by ID

`GET /riders/:id`

Ek rider ki profile return karta hai.

**Possible errors:** `400` invalid ID, `404` rider not found.

### 4.3 Create Rider Profile

`POST /riders`

**Access:** Rider only

**Request body**
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

Allowed vehicle types:
- `bike`
- `scooter`
- `cycle`
- `other`

Rider profile authenticated user ke saath automatically link hoti hai. Ek user ki sirf ek Rider profile ho sakti hai.

**Success:** `201 Created`

Duplicate profile: `409 Conflict`.

### 4.4 Get My Rider Profile

`GET /riders/me`

**Access:** Rider only

Logged-in rider ki profile return karta hai.

Profile abhi create nahi hui ho toh `404 Not Found`.

### 4.5 Update My Rider Profile

`PATCH /riders/me`

**Access:** Rider only

**Request body example**
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

Allowed fields:
- `name`
- `phone`
- `vehicleType`
- `location`
- `isAvailable`

Rider apni user identity ya delivery assignment is endpoint se change nahi kar sakta.

---

## 5. Orders APIs

Saare Orders endpoints par JWT required hai.

### 5.1 Create Order

`POST /orders`

**Access:** Shopkeeper only

Shopkeeper sirf apni owned shop ke liye order create kar sakta hai.

**Request body**
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

`totalAmount` server calculate karta hai:

`sum(quantity × price)`

Is example mein total `260` hoga.

**Success:** `201 Created`

**Possible errors:** `400` invalid payload, `404` shop not found/not owned.

### 5.2 List Orders

`GET /orders`

Role-based filtering:
- Shopkeeper: apni shops ke orders.
- Rider: apne Rider profile ko assigned orders.

Optional status filter:

`GET /orders?status=pending`

Supported statuses:
- `pending`
- `planned`
- `picked`
- `delivered`
- `cancelled`

**Success:** `200 OK`

### 5.3 Get Order by ID

`GET /orders/:id`

- Shopkeeper sirf apni shop ka order dekh sakta hai.
- Rider sirf apne assigned orders dekh sakta hai.

**Possible errors:** `400` invalid ID, `404` order not found/not visible.

### 5.4 Update Order Status

`PATCH /orders/:id/status`

**Request body example**
```json
{
  "status": "cancelled"
}
```

Current implemented rules:

**Shopkeeper**
- Sirf apni shop ka `pending` order cancel kar sakta hai.

**Assigned rider**
- `planned` → `picked`
- `picked` → `delivered`

Rider ke paas us order ka assignment hona zaroori hai.

**Possible errors:**
- `400` invalid status ya transition.
- `403` unauthorized action/unassigned rider.
- `404` order not found/not visible.

Rider assignment delivery-planning module mein implement hoga; isliye rider status updates ke liye order pehle assigned aur `planned` hona chahiye.

---

## 6. Common HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Request successful |
| `201` | Resource created |
| `400` | Invalid request or ID |
| `401` | Missing/invalid JWT or credentials |
| `403` | Role or permission denied |
| `404` | Resource not found/not accessible |
| `409` | Duplicate account/profile |
| `500` | Unexpected server error |

## 7. Security and implementation notes

- `.env` ko GitHub par commit nahi karna.
- Request examples ke placeholder IDs ko real MongoDB ObjectIds se replace karna.
- Order creation mein item prices request se liye ja rahe hain; production mein trusted product catalogue se verify karna chahiye.
- Rider directory endpoints currently rider profile fields return karte hain. Production se pehle phone/location visibility restrict karni chahiye.
- Delivery planning, rider assignment, pooling economics, forecasting aur demo endpoints next phases mein implement/test honge.
