
from pathlib import Path
import math
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

# Illustrative demo assumptions, not real courier quotes.
FIXED_TRIP_COST = 50.0       # INR per trip
COST_PER_KM = 10.0           # INR per km
RIDER_CAPACITY = 10          # package-load units
MAX_GROUP_ORDERS = 5
MAX_READY_GAP_MIN = 60
MAX_CUSTOMER_GAP_KM = 2.0

orders = pd.read_csv(DATA_DIR / "orders.csv")
shops = pd.read_csv(DATA_DIR / "shops.csv")

orders = orders.merge(
    shops[["shop_id", "lat", "lng"]].rename(
        columns={"lat": "shop_lat", "lng": "shop_lng"}
    ),
    on="shop_id",
    how="left",
    validate="many_to_one",
)

assert orders["shop_lat"].notna().all()
assert orders["cust_lat"].notna().all()
assert orders["package_load"].between(1, RIDER_CAPACITY).all()


def haversine_km(lat1, lon1, lat2, lon2):
    """Distance between two latitude/longitude points in km."""
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(min(1.0, a)))


def route_distance(group):
    """Shop -> customers in nearest-neighbour order -> shop."""
    first = group.iloc[0]
    shop_lat, shop_lng = first["shop_lat"], first["shop_lng"]
    remaining = [
        (row["cust_lat"], row["cust_lng"])
        for _, row in group.iterrows()
    ]

    current = (shop_lat, shop_lng)
    total_km = 0.0

    while remaining:
        next_point = min(
            remaining,
            key=lambda p: haversine_km(
                current[0], current[1], p[0], p[1]
            ),
        )
        total_km += haversine_km(
            current[0], current[1],
            next_point[0], next_point[1]
        )
        remaining.remove(next_point)
        current = next_point

    # Return to the originating shop.
    total_km += haversine_km(
        current[0], current[1], shop_lat, shop_lng
    )
    return total_km


def solo_cost(group):
    """One round trip from shop for each order."""
    distance = sum(
        2 * haversine_km(
            row["shop_lat"], row["shop_lng"],
            row["cust_lat"], row["cust_lng"]
        )
        for _, row in group.iterrows()
    )
    trips = len(group)
    return distance, trips, trips * FIXED_TRIP_COST + distance * COST_PER_KM


def make_pooled_groups(day_orders):
    """Greedy grouping: same shop/day, nearby customers and ready times."""
    groups = []

    for _, shop_orders in day_orders.groupby("shop_id", sort=True):
        pending = shop_orders.sort_values(
            ["ready_min", "order_id"]
        ).copy()

        while not pending.empty:
            seed = pending.iloc[0]
            seed_lat, seed_lng = seed["cust_lat"], seed["cust_lng"]
            seed_ready = seed["ready_min"]

            # Candidate orders must be ready within one hour of the seed.
            candidates = pending[
                (pending["ready_min"] - seed_ready).abs()
                <= MAX_READY_GAP_MIN
            ].copy()

            candidates["gap_km"] = candidates.apply(
                lambda r: haversine_km(
                    seed_lat, seed_lng, r["cust_lat"], r["cust_lng"]
                ),
                axis=1,
            )
            candidates = candidates[
                candidates["gap_km"] <= MAX_CUSTOMER_GAP_KM
            ].sort_values(["gap_km", "ready_min"])

            chosen = []
            load = 0

            for idx, row in candidates.iterrows():
                next_load = int(row["package_load"])
                if len(chosen) >= MAX_GROUP_ORDERS:
                    break
                if load + next_load <= RIDER_CAPACITY:
                    chosen.append(idx)
                    load += next_load

            # Seed always fits because its load is <= capacity.
            group = pending.loc[chosen].copy()
            groups.append(group)
            pending = pending.drop(index=chosen)

    return groups


solo_km = 0.0
solo_trips = 0
solo_total_cost = 0.0

pooled_km = 0.0
pooled_trips = 0
pooled_total_cost = 0.0
pooled_groups = []

# Compare costs separately for each day.
for day, day_orders in orders.groupby("day", sort=True):
    _, trips, cost = solo_cost(day_orders)
    distance = sum(
        2 * haversine_km(
            r["shop_lat"], r["shop_lng"],
            r["cust_lat"], r["cust_lng"]
        )
        for _, r in day_orders.iterrows()
    )
    solo_km += distance
    solo_trips += trips
    solo_total_cost += cost

    for group in make_pooled_groups(day_orders):
        distance = route_distance(group)
        trips = 1
        cost = FIXED_TRIP_COST + distance * COST_PER_KM

        pooled_km += distance
        pooled_trips += trips
        pooled_total_cost += cost

        pooled_groups.append({
            "day": int(day),
            "shop_id": group.iloc[0]["shop_id"],
            "order_ids": "|".join(group["order_id"].astype(str)),
            "order_count": len(group),
            "total_package_load": int(group["package_load"].sum()),
            "estimated_route_km": round(distance, 3),
            "estimated_cost_inr": round(cost, 2),
        })

savings = solo_total_cost - pooled_total_cost
savings_pct = (
    100 * savings / solo_total_cost if solo_total_cost else 0
)
order_count = len(orders)
pooled_order_count = sum(g["order_count"] for g in pooled_groups)
multi_order_groups = sum(g["order_count"] > 1 for g in pooled_groups)

print("\n=== KIRANAPOOL ECONOMICS ESTIMATE ===")
print("Note: synthetic data and illustrative cost assumptions.")
print(f"Orders evaluated:             {order_count}")
print(f"Solo trips:                   {solo_trips}")
print(f"Greedy pooled trips:          {pooled_trips}")
print(f"Orders in multi-order groups: {sum(g['order_count'] for g in pooled_groups if g['order_count'] > 1)}")
print(f"Solo estimated distance:      {solo_km:.2f} km")
print(f"Pooled estimated distance:    {pooled_km:.2f} km")
print(f"Solo estimated cost:          Rs {solo_total_cost:.2f}")
print(f"Pooled estimated cost:        Rs {pooled_total_cost:.2f}")
print(f"Estimated cost difference:    Rs {savings:.2f}")
print(f"Estimated savings:            {savings_pct:.2f}%")
print("\nThese are heuristic estimates, not optimized or real-world results.")

output_path = DATA_DIR / "economics_pooled_groups.csv"
pd.DataFrame(pooled_groups).to_csv(output_path, index=False)
print("Pooled group details saved:", output_path)

assert pooled_order_count == order_count, (
    f"Order coverage mismatch: {pooled_order_count} vs {order_count}"
)
print("PASS: Every order assigned to exactly one pooled group.")
