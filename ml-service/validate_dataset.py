
import csv
from pathlib import Path
from collections import Counter

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DEMO_DIR = DATA_DIR / "demo"


def read_csv(path):
    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def check(condition, message):
    label = "PASS" if condition else "FAIL"
    print(f"[{label}] {message}")
    return condition


def audit_matrix(path):
    if not path.exists():
        check(False, f"Missing matrix: {path}")
        return

    row_count = 0
    nodes = set()
    bad_diagonal = 0
    bad_values = 0

    with open(path, "r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            row_count += 1
            origin = row["origin_id"]
            dest = row["dest_id"]
            nodes.add(origin)
            nodes.add(dest)

            try:
                value = float(row["travel_time_min"])
                if value < 0:
                    bad_values += 1
                if origin == dest and value != 0:
                    bad_diagonal += 1
            except (ValueError, TypeError):
                bad_values += 1

    expected = len(nodes) ** 2

    check(
        row_count == expected,
        f"{path.name}: {row_count:,} rows; "
        f"{len(nodes)} nodes; expected {expected:,} rows"
    )
    check(bad_diagonal == 0, f"{path.name}: diagonal travel times are zero")
    check(bad_values == 0, f"{path.name}: travel times are valid and non-negative")


def main():
    print("\n=== KIRANAPOOL DATASET AUDIT ===\n")

    required = [
        "shops.csv",
        "riders.csv",
        "orders.csv",
        "demand_history.csv",
        "scenario_manifest.json",
        "DATA_DICTIONARY.md",
    ]

    for filename in required:
        check((DATA_DIR / filename).exists(), f"File exists: {filename}")

    shops = read_csv(DATA_DIR / "shops.csv")
    riders = read_csv(DATA_DIR / "riders.csv")
    orders = read_csv(DATA_DIR / "orders.csv")
    demand = read_csv(DATA_DIR / "demand_history.csv")

    check(len(shops) == 20, f"Shop count = {len(shops)}")
    check(len(riders) == 10, f"Rider count = {len(riders)}")
    check(len(orders) == 1420, f"Order count = {len(orders)}")

    shop_ids = {s["shop_id"] for s in shops}
    order_ids = [o["order_id"] for o in orders]

    check(
        len(shop_ids) == len(shops),
        "Shop IDs are unique"
    )
    check(
        len(set(order_ids)) == len(order_ids),
        "Order IDs are unique"
    )
    check(
        all(o["shop_id"] in shop_ids for o in orders),
        "Every order references an existing shop"
    )

    expected_daily = {
        1: 200, 2: 260, 3: 200, 4: 200,
        5: 100, 6: 200, 7: 260
    }
    actual_daily = Counter(int(o["day"]) for o in orders)

    print("\nOrders by day:")
    for day, expected in expected_daily.items():
        actual = actual_daily.get(day, 0)
        print(f"  Day {day}: {actual} (expected {expected})")
        check(actual == expected, f"Day {day} order count")

    allowed_statuses = {"pending", "planned", "picked", "delivered"}
    bad_status = [
        o["order_id"] for o in orders
        if o["order_status"] not in allowed_statuses
    ]
    check(not bad_status, "All order statuses are valid")

    bad_times = [
        o["order_id"] for o in orders
        if not (
            int(o["created_min"]) <= int(o["ready_min"])
            <= int(o["deadline_min"])
        )
    ]
    check(not bad_times, "Order creation, ready and deadline times are ordered")

    bad_load = [
        o["order_id"] for o in orders
        if not 1 <= int(o["package_load"]) <= 5
    ]
    check(not bad_load, "Package loads are between 1 and 5")

    demand_total = sum(int(r["order_count"]) for r in demand)
    check(
        demand_total == len(orders),
        f"Main demand history totals {demand_total} orders"
    )

    print("\n=== DEMO DATA ===")
    demo_orders = read_csv(DEMO_DIR / "orders.csv")
    demo_demand = read_csv(DEMO_DIR / "demand_history.csv")

    check(
        len(demo_orders) == 100,
        f"Demo order count = {len(demo_orders)}"
    )

    demo_demand_total = sum(
        int(r["order_count"]) for r in demo_demand
    )
    print(f"Demo demand history total: {demo_demand_total}")
    if demo_demand_total != len(demo_orders):
        print(
            "[WARN] Demo demand history does not match the 100 demo orders. "
            "It may contain counts from the full day."
        )

    print("\n=== TRAVEL-TIME MATRICES ===")
    audit_matrix(DATA_DIR / "travel_time_matrix.csv")
    audit_matrix(DEMO_DIR / "travel_time_matrix.csv")

    print("\n=== AUDIT FINISHED ===")


if __name__ == "__main__":
    main()

