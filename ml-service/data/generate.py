import random

BASE_LAT = 12.9352
BASE_LNG = 77.6245
COORD_OFFSET = 0.015


def generate_shops(count=5, seed=42):
    rng = random.Random(seed)
    shops = []
    for i in range(1, count + 1):
        lat = round(BASE_LAT + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        lng = round(BASE_LNG + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        shops.append({
            "id": f"shop_{i}",
            "name": f"Shop {i}",
            "lat": lat,
            "lng": lng,
        })
    return shops


def generate_riders(count=3, seed=42):
    rng = random.Random(seed)
    riders = []
    for i in range(1, count + 1):
        lat = round(BASE_LAT + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        lng = round(BASE_LNG + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        capacity = rng.randint(3, 6)
        riders.append({
            "id": f"rider_{i}",
            "lat": lat,
            "lng": lng,
            "capacity": capacity,
        })
    return riders


def generate_orders(count=20, shops=None, seed=42):
    if not shops:
        raise ValueError("Shops list cannot be empty")
    rng = random.Random(seed)
    orders = []
    for i in range(1, count + 1):
        assigned_shop = rng.choice(shops)
        lat = round(BASE_LAT + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        lng = round(BASE_LNG + rng.uniform(-COORD_OFFSET, COORD_OFFSET), 6)
        weight = round(rng.uniform(0.5, 10.0), 2)
        orders.append({
            "id": f"order_{i}",
            "shop_id": assigned_shop["id"],
            "lat": lat,
            "lng": lng,
            "weight": weight,
        })
    return orders


def generate_synthetic_data(num_shops=5, num_riders=3, num_orders=20, seed=42):
    shops = generate_shops(count=num_shops, seed=seed)
    riders = generate_riders(count=num_riders, seed=seed + 1)
    orders = generate_orders(count=num_orders, shops=shops, seed=seed + 2)
    return {
        "shops": shops,
        "riders": riders,
        "orders": orders,
    }


def generate_dataset(num_shops=5, num_riders=3, num_orders=20, seed=42):
    return generate_synthetic_data(
        num_shops=num_shops,
        num_riders=num_riders,
        num_orders=num_orders,
        seed=seed,
    )
