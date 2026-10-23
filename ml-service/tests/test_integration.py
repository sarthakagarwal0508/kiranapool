import math
import unittest
from data.generate import generate_synthetic_data
from economics.costs import (
    calculate_per_shop_savings,
    calculate_pooled_cost,
    calculate_savings_amount,
    calculate_savings_percentage,
    calculate_solo_cost,
)
from forecasting.travel_time import (
    estimate_route_travel_time,
    estimate_travel_time,
)


def compute_euclidean_distance(lat1, lng1, lat2, lng2):
    deg_to_km = 111.0
    d_lat = (lat2 - lat1) * deg_to_km
    d_lng = (lng2 - lng1) * deg_to_km * math.cos(math.radians((lat1 + lat2) / 2.0))
    return round(math.sqrt(d_lat**2 + d_lng**2), 3)


class TestIntegrationScenario(unittest.TestCase):

    def test_sample_integration_flow(self):
        dataset = generate_synthetic_data(num_shops=2, num_riders=1, num_orders=3, seed=42)
        shops = {s["id"]: s for s in dataset["shops"]}
        rider = dataset["riders"][0]
        orders = dataset["orders"]

        self.assertEqual(len(dataset["shops"]), 2)
        self.assertEqual(len(dataset["riders"]), 1)
        self.assertEqual(len(dataset["orders"]), 3)

        solo_distances = []
        shop_solo_distances = {}
        for order in orders:
            shop = shops[order["shop_id"]]
            dist = compute_euclidean_distance(shop["lat"], shop["lng"], order["lat"], order["lng"])
            solo_trip = round(dist * 2.0, 3)
            solo_distances.append(solo_trip)

            if order["shop_id"] not in shop_solo_distances:
                shop_solo_distances[order["shop_id"]] = []
            shop_solo_distances[order["shop_id"]].append(solo_trip)

        cost_params = {"base_cost": 20.0, "cost_per_km": 10.0, "cost_per_drop": 5.0}

        shop_solo_costs = {
            s_id: calculate_solo_cost(distances=dists, cost_params=cost_params)
            for s_id, dists in shop_solo_distances.items()
        }
        total_solo_cost = calculate_solo_cost(distances=solo_distances, cost_params=cost_params)
        self.assertEqual(total_solo_cost, sum(shop_solo_costs.values()))

        route_coords = [(rider["lat"], rider["lng"])]
        for order in orders:
            shop = shops[order["shop_id"]]
            if (shop["lat"], shop["lng"]) not in route_coords:
                route_coords.append((shop["lat"], shop["lng"]))
            route_coords.append((order["lat"], order["lng"]))

        leg_distances = []
        for i in range(len(route_coords) - 1):
            leg_d = compute_euclidean_distance(
                route_coords[i][0],
                route_coords[i][1],
                route_coords[i + 1][0],
                route_coords[i + 1][1],
            )
            leg_distances.append(leg_d)

        total_pooled_distance = round(sum(leg_distances), 3)

        estimated_duration = estimate_route_travel_time(
            leg_distances_km=leg_distances,
            speed_kmh=20.0,
            stop_delay_minutes=2.0,
        )
        self.assertGreater(estimated_duration, 0.0)

        total_pooled_cost = calculate_pooled_cost(
            distance=total_pooled_distance,
            num_orders=len(orders),
            cost_params=cost_params,
        )
        self.assertGreater(total_pooled_cost, 0.0)

        savings_amt = calculate_savings_amount(total_solo_cost, total_pooled_cost)
        savings_pct = calculate_savings_percentage(total_solo_cost, total_pooled_cost)

        self.assertIsInstance(savings_amt, float)
        self.assertIsInstance(savings_pct, float)

        per_shop = calculate_per_shop_savings(
            shop_solo_costs=shop_solo_costs,
            total_pooled_cost=total_pooled_cost,
            allocation_method="proportional_solo_cost",
        )
        self.assertEqual(len(per_shop), len(shop_solo_costs))
        self.assertAlmostEqual(sum(per_shop.values()), savings_amt, places=1)


if __name__ == "__main__":
    unittest.main()
