# KiranaPool Backend API Inventory — Phases 1–7

Base URL: `http://localhost:5000/api`. Protected endpoints use `Authorization: Bearer <JWT>`.

| # | Feature | Method | Endpoint | Access |
|---:|---|---|---|---|
| 1 | Health | GET | `/health` | Public |
| 2 | Auth | POST | `/auth/signup` | Public; role `shopkeeper`, `wholesaler` or `rider` |
| 3 | Auth | POST | `/auth/login` | Public |
| 4 | Auth | POST | `/auth/google` | Public |
| 5 | Auth | GET | `/auth/me` | JWT |
| 6 | Shops | GET | `/shops` | JWT; role-filtered |
| 7 | Shops | GET | `/shops/:id` | JWT; role/ownership scoped |
| 8 | Shops | POST | `/shops` | Shopkeeper |
| 9 | Shops | PATCH | `/shops/:id` | Owning shopkeeper |
| 10 | Shops | DELETE | `/shops/:id` | Owning shopkeeper |
| 11 | Riders | GET | `/riders` | Wholesaler JWT; rider assignment directory |
| 12 | Riders | GET | `/riders/:id` | Wholesaler JWT; rider assignment directory |
| 13 | Riders | POST | `/riders` | Rider |
| 14 | Riders | GET | `/riders/me` | Rider |
| 15 | Riders | PATCH | `/riders/me` | Rider |
| 16 | Orders | POST | `/orders` | Shopkeeper |
| 17 | Orders | POST | `/orders/manual` | Wholesaler; records an offline/manual kirana order |
| 18 | Orders | GET | `/orders` | Shopkeeper/rider/wholesaler; role-filtered |
| 19 | Orders | GET | `/orders/:id` | Shopkeeper/rider/wholesaler; scoped |
| 20 | Orders | PATCH | `/orders/:id/status` | Shopkeeper/rider/wholesaler with transition checks |
| 21 | Warehouses | GET | `/warehouses` | JWT; wholesaler sees own, others active |
| 22 | Warehouses | GET | `/warehouses/:id` | JWT; scoped |
| 23 | Warehouses | POST | `/warehouses` | Wholesaler |
| 24 | Warehouses | PATCH | `/warehouses/:id` | Owning wholesaler |
| 25 | Plans | GET | `/plans` | Wholesaler/rider; scoped |
| 26 | Plans | POST | `/plans/preview` | Wholesaler |
| 27 | Plans | POST | `/plans/auto-pool` | Wholesaler |
| 28 | Plans | GET | `/plans/latest` | Wholesaler/rider; scoped |
| 29 | Plans | POST | `/plans` | Wholesaler |
| 30 | Plans | PATCH | `/plans/:id/assign-rider` | Wholesaler owning plan |
| 31 | Plans | POST | `/plans/:id/cancel` | Wholesaler owning plan |
| 32 | Plans | GET | `/plans/:id` | Wholesaler/assigned rider |
| 33 | Forecasts | GET | `/forecasts` | Wholesaler/shopkeeper; scoped |
| 34 | Forecasts | POST | `/forecasts/run` | Wholesaler |
| 35 | Forecasts | GET | `/forecasts/summary` | Wholesaler |
| 36 | Forecasts | PATCH | `/forecasts/:id/actual` | Wholesaler who generated forecast |
| 37 | Legacy Plan alias | POST | `/plan` | Wholesaler; same create handler as `/plans` |
| 38 | Legacy Plan alias | GET | `/plan/latest` | Wholesaler/assigned rider; same handler as `/plans/latest` |

**Total: 38 endpoint paths** (36 feature routes plus 2 backward-compatible singular plan paths). Static plan routes (`/preview`, `/auto-pool`, `/latest`) are registered before `/:id`.

Notes:
- New B2B replenishment orders include a `warehouse` plus future `deliverySlotStart`/`deliverySlotEnd`; legacy orders without a warehouse remain supported but do not participate in pooling or wholesaler dashboards.
- Pools never combine different warehouses, require overlapping delivery windows, enforce configurable destination spread and stop count, and report an estimated route plus total and shop-wise cost savings.
- Distances are approximate (great-circle distance multiplied by a road-factor assumption); they are not live map-provider road routes.
