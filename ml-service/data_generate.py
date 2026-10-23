import os
import json
import random
import math
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd

# Configuration constants
RANDOM_SEED = 12345
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DEMO_DIR = DATA_DIR / "demo"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DEMO_DIR.mkdir(parents=True, exist_ok=True)

# Delivery region coordinates (fictional, approx Jaipur area)
LAT_MIN, LAT_MAX = 26.88, 26.98
LNG_MIN, LNG_MAX = 75.72, 75.82

SHOP_COUNT = 20
RIDER_COUNT = 10
DAYS = 7
ORDERS_PER_DAY = 200
DEMO_ORDERS_MAX = 100
DEMAND_INTERVAL_MIN = 30

SHOP_OPEN_MIN = 8 * 60
SHOP_CLOSE_MIN = 20 * 60

RIDERS_SHIFT_STARTS = [8*60, 10*60, 12*60, 14*60, 16*60]
RIDERS_SHIFT_LENGTH = 8 * 60
RIDER_CAPACITY = 10  # in parcel units

ORDER_STATUSES = ['pending', 'planned', 'picked', 'delivered']

DETOUR_FACTOR = 1.3
AVERAGE_SPEED_KMPH = 30  # assumed for travel time calculation

COST_FIXED_PER_TRIP = 50.0
COST_PER_KM = 10.0

SCENARIOS = ['normal', 'peak', 'clustered', 'dispersed', 'low_demand']

def clamp(value, minimum, maximum):
    return max(minimum, min(value, maximum))

def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0  # earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def travel_time_minutes(lat1, lng1, lat2, lng2):
    dist = haversine(lat1, lng1, lat2, lng2)
    base_time = dist * DETOUR_FACTOR / AVERAGE_SPEED_KMPH * 60
    noise = np.random.normal(0, 0.5)
    time = base_time + noise
    return round(max(0.5, time), 2)

# Generate shops in 5x4 grid with jitter
def generate_shops():
    shops = []
    lat_points = np.linspace(LAT_MIN, LAT_MAX, 5)
    lng_points = np.linspace(LNG_MIN, LNG_MAX, 4)
    shop_id = 1
    for lat in lat_points:
        for lng in lng_points:
            jitter_lat = lat + random.uniform(-0.002, 0.002)
            jitter_lng = lng + random.uniform(-0.002, 0.002)
            shops.append({
                "shop_id": f"S{shop_id:03d}",
                "lat": clamp(jitter_lat, LAT_MIN, LAT_MAX),
                "lng": clamp(jitter_lng, LNG_MIN, LNG_MAX),
                "open_time": SHOP_OPEN_MIN,
                "close_time": SHOP_CLOSE_MIN,
            })
            shop_id += 1
            if shop_id > SHOP_COUNT:
                break
    assert len(shops) == SHOP_COUNT
    return shops

# Generate riders with staggered shifts and capacity
def generate_riders():
    riders = []
    for i in range(RIDER_COUNT):
        shift_start = RIDERS_SHIFT_STARTS[i % len(RIDERS_SHIFT_STARTS)]
        shift_end = shift_start + RIDERS_SHIFT_LENGTH
        start_lat = random.uniform(LAT_MIN, LAT_MAX)
        start_lng = random.uniform(LNG_MIN, LNG_MAX)
        riders.append({
            "rider_id": f"R{i+1:02d}",
            "start_lat": clamp(start_lat, LAT_MIN, LAT_MAX),
            "start_lng": clamp(start_lng, LNG_MIN, LNG_MAX),
            "capacity": RIDER_CAPACITY,
            "available_from": shift_start,
            "available_to": shift_end,
        })
    assert len(riders) == RIDER_COUNT
    return riders

# Generate orders for a single day and scenario
def generate_orders(day_index, shops, scenario):
    scenario_factor = {
        'normal': 1.0,
        'peak': 1.3,
        'clustered': 1.0,
        'dispersed': 1.0,
        'low_demand': 0.5,
    }[scenario]

    n_orders = max(1, int(ORDERS_PER_DAY * scenario_factor))
    shop_ids = [s["shop_id"] for s in shops]

    # Clustered scenario: pick random hotspot shop
    if scenario == "clustered":
        hotspot = random.choice(shops)
        shop_weights = {s["shop_id"]: 0.5 for s in shops}
        shop_weights[hotspot["shop_id"]] = 5.0
    else:
        shop_weights = {s["shop_id"]: 1.0 for s in shops}

    total_weight = sum(shop_weights.values())
    shop_probs = [shop_weights[shop_id]/total_weight for shop_id in shop_ids]

    orders = []
    base_id = (day_index - 1) * 10000
    for i in range(n_orders):
        order_id = f"O{base_id + i + 1:05d}"

        shop_id = np.random.choice(shop_ids, p=shop_probs)
        shop = next(s for s in shops if s["shop_id"] == shop_id)

        created_min = random.randint(shop["open_time"], shop["close_time"] - 180)
        ready_min = created_min + random.randint(5, 30)
        deadline_min = min(shop["close_time"], ready_min + random.randint(30, 120))

        # Customer location
        if scenario == "clustered":
            if random.random() < 0.7:
                cust_lat = np.clip(np.random.normal(shop["lat"], 0.005), LAT_MIN, LAT_MAX)
                cust_lng = np.clip(np.random.normal(shop["lng"], 0.005), LNG_MIN, LNG_MAX)
            else:
                cust_lat = random.uniform(LAT_MIN, LAT_MAX)
                cust_lng = random.uniform(LNG_MIN, LNG_MAX)
        elif scenario == "dispersed":
            cust_lat = random.uniform(LAT_MIN, LAT_MAX)
            cust_lng = random.uniform(LNG_MIN, LNG_MAX)
        else:
            pick_shop = np.random.choice(shops, p=shop_probs)
            cust_lat = np.clip(np.random.normal(pick_shop["lat"], 0.01), LAT_MIN, LAT_MAX)
            cust_lng = np.clip(np.random.normal(pick_shop["lng"], 0.01), LNG_MIN, LNG_MAX)

        package_load = random.randint(1, 5)

        status_roll = random.random()
        if status_roll < 0.85:
            order_status = "pending"
        elif status_roll < 0.92:
            order_status = "planned"
        elif status_roll < 0.97:
            order_status = "picked"
        else:
            order_status = "delivered"

        orders.append({
            "order_id": order_id,
            "day": day_index,
            "shop_id": shop_id,
            "created_min": created_min,
            "ready_min": ready_min,
            "deadline_min": deadline_min,
            "cust_lat": cust_lat,
            "cust_lng": cust_lng,
            "package_load": package_load,
            "order_status": order_status,
        })
    return orders

# Generate demand history: aggregate orders per shop per day per 30-min interval
def generate_demand_history(orders, shops):
    shop_ids = {s["shop_id"] for s in shops}
    day_shop_interval_counts = []
    # Group orders by day & shop
    grouped = defaultdict(int)
    for o in orders:
        day = o['day']
        shop = o['shop_id']
        interval = o['created_min'] // DEMAND_INTERVAL_MIN * DEMAND_INTERVAL_MIN
        grouped[(day, shop, interval)] += 1

    for (day, shop, interval), count in grouped.items():
        day_shop_interval_counts.append({
            "day": day,
            "shop_id": shop,
            "interval_start": interval,
            "order_count": count,
        })
    return day_shop_interval_counts

# Generate travel time matrix for all shops + unique customer locations (rounded coords)
def generate_travel_time_matrix(shops, orders):
    nodes = []
    node_ids = []

    # Shops first
    for s in shops:
        nodes.append( (s['lat'], s['lng']) )
        node_ids.append(s['shop_id'])

    # Unique customer coords rounded to 6 decimals
    cust_coords_map = {}
    for o in orders:
        coord = (round(o['cust_lat'], 6), round(o['cust_lng'], 6))
        cust_coords_map[coord] = cust_coords_map.get(coord, None) or f"CUST{len(cust_coords_map) + 1:04d}"

    for coord, cid in cust_coords_map.items():
        nodes.append(coord)
        node_ids.append(cid)

    size = len(nodes)
    matrix = np.zeros((size, size), dtype=float)
    for i in range(size):
        for j in range(size):
            if i == j:
                matrix[i,j] = 0.0
            else:
                matrix[i,j] = travel_time_minutes(nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1])
    return matrix, node_ids

def save_csv(data, filepath):
    df = pd.DataFrame(data)
    df.to_csv(filepath, index=False)
    print(f"Saved {filepath} with {len(df)} rows.")

def save_json(data, filepath):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved {filepath}.")

def write_data_dictionary(filepath):
    text = """\
# KiranaPool Dataset Data Dictionary

## shops.csv
- shop_id: string ID, e.g. "S001"
- lat, lng: float, coordinates in approx Jaipur fictional region, degrees
- open_time, close_time: int, minutes from midnight (e.g. 480 = 8 AM)

## riders.csv
- rider_id: string ID, e.g. "R01"
- start_lat, start_lng: float, starting coords
- capacity: int, parcel units (default 10)
- available_from, available_to: int, minutes from midnight

## orders.csv
- order_id: string ID, e.g. "O00001"
- day: int, simulated day (1-7)
- shop_id: string foreign key to shops
- created_min, ready_min, deadline_min: int, minutes from midnight
- cust_lat, cust_lng: float, customer location coords
- package_load: int, parcels in order (1-5)
- order_status: string, one of ['pending','planned','picked','delivered']

## demand_history.csv
- day: int, simulated day
- shop_id: string foreign key to shops
- interval_start: int, minutes from midnight, start of 30-min interval
- order_count: int, count of orders created in that interval

## travel_time_matrix.csv
- origin_id: string node ID (shops or customers)
- dest_id: string node ID
- travel_time_min: float, minutes including detour factor and noise

## scenario_manifest.json
Contains generation parameters including seeds, day and scenario assignments, rider capacity, cost assumptions, and dataset sizes.

"""
    with open(filepath, "w") as f:
        f.write(text)
    print(f"Saved {filepath}")

def main():
    print("Starting KiranaPool data generation...")

    shops = generate_shops()
    save_csv(shops, DATA_DIR / "shops.csv")

    riders = generate_riders()
    save_csv(riders, DATA_DIR / "riders.csv")

    scenarios_cycle = ['normal', 'peak', 'clustered', 'dispersed', 'low_demand', 'normal', 'peak']

    all_orders = []
    day_to_orders = {}
    for day in range(1, DAYS + 1):
        scenario = scenarios_cycle[day - 1]
        orders = generate_orders(day, shops, scenario)
        all_orders.extend(orders)
        day_to_orders[day] = orders
    save_csv(all_orders, DATA_DIR / "orders.csv")

    demand_hist = generate_demand_history(all_orders, shops)
    save_csv(demand_hist, DATA_DIR / "demand_history.csv")

    matrix, node_ids = generate_travel_time_matrix(shops, all_orders)
    travel_time_rows = []
    for i, oid in enumerate(node_ids):
        for j, did in enumerate(node_ids):
            travel_time_rows.append({
                "origin_id": oid,
                "dest_id": did,
                "travel_time_min": float(matrix[i,j])
            })
    save_csv(travel_time_rows, DATA_DIR / "travel_time_matrix.csv")

    manifest = {
        "random_seed": RANDOM_SEED,
        "days": DAYS,
        "scenarios_cycle": scenarios_cycle,
        "shop_count": SHOP_COUNT,
        "rider_count": RIDER_COUNT,
        "orders_per_day": ORDERS_PER_DAY,
        "rider_capacity": RIDER_CAPACITY,
        "cost_config": {
            "fixed_cost_per_trip": COST_FIXED_PER_TRIP,
            "cost_per_km": COST_PER_KM,
        }
    }
    save_json(manifest, DATA_DIR / "scenario_manifest.json")

    write_data_dictionary(DATA_DIR / "DATA_DICTIONARY.md")

    # Create demo fixture (50-100 orders from day 1)
    demo_orders = random.sample(day_to_orders[1], min(DEMO_ORDERS_MAX, len(day_to_orders[1])))
    save_csv(demo_orders, DEMO_DIR / "orders.csv")

    demo_shop_ids = {d['shop_id'] for d in demo_orders}
    demo_shops = [s for s in shops if s['shop_id'] in demo_shop_ids]
    save_csv(demo_shops, DEMO_DIR / "shops.csv")
    save_csv(riders, DEMO_DIR / "riders.csv")

    demo_demand_hist = generate_demand_history(demo_orders, demo_shops)
    save_csv(demo_demand_hist, DEMO_DIR / "demand_history.csv")

    # Demo travel time matrix: shops + unique demo customers
    demo_nodes = []
    demo_node_ids = []
    for s in demo_shops:
        demo_nodes.append( (s['lat'], s['lng']) )
        demo_node_ids.append(s['shop_id'])
    unique_coords = {}
    cust_count = 0
    for o in demo_orders:
        coord = (round(o['cust_lat'],6), round(o['cust_lng'],6))
        if coord not in unique_coords:
            cust_count += 1
            unique_coords[coord] = f"CUST{cust_count:04d}"
            demo_nodes.append(coord)
            demo_node_ids.append(unique_coords[coord])

    n_demo_nodes = len(demo_nodes)
    demo_matrix = np.zeros((n_demo_nodes, n_demo_nodes), dtype=float)
    for i in range(n_demo_nodes):
        for j in range(n_demo_nodes):
            if i == j:
                demo_matrix[i,j] = 0.0
            else:
                demo_matrix[i,j] = travel_time_minutes(demo_nodes[i][0], demo_nodes[i][1], demo_nodes[j][0], demo_nodes[j][1])

    demo_ttm_rows = []
    for i, oid in enumerate(demo_node_ids):
        for j, did in enumerate(demo_node_ids):
            demo_ttm_rows.append({
                "origin_id": oid,
                "dest_id": did,
                "travel_time_min": float(demo_matrix[i,j]),
            })
    save_csv(demo_ttm_rows, DEMO_DIR / "travel_time_matrix.csv")

    print("\nGeneration complete.\n")
    print(f"Generated files:")
    for p in [DATA_DIR, DEMO_DIR]:
        for f in os.listdir(p):
            fpath = p / f
            try:
                with open(fpath, "r") as file:
                    if f.endswith(".csv"):
                        num_rows = sum(1 for _ in file) - 1
                        print(f"  {fpath}: {num_rows} data rows")
                    else:
                        print(f"  {fpath}")
            except Exception:
                print(f"  {fpath} (cannot determine rows)")

if __name__ == "__main__":
    main()
