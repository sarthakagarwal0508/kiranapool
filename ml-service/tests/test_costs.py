import unittest
from economics.costs import (
    calculate_delivery_cost,
    calculate_per_shop_savings,
    calculate_pooled_cost,
    calculate_savings_amount,
    calculate_savings_percentage,
    calculate_solo_cost,
)


class TestCostCalculations(unittest.TestCase):

    def test_normal_solo_and_pooled_costs(self):
        solo_cost = calculate_solo_cost(distances=10.0, base_cost=20.0, cost_per_km=10.0)
        self.assertEqual(solo_cost, 120.0)

        solo_costs_list = calculate_solo_cost(distances=[4.0, 6.0], base_cost=15.0, cost_per_km=8.0)
        self.assertEqual(solo_costs_list, 110.0)

        pooled_cost = calculate_pooled_cost(
            distance=7.0,
            num_orders=2,
            base_cost=20.0,
            cost_per_km=10.0,
            cost_per_drop=5.0,
        )
        self.assertEqual(pooled_cost, 95.0)

        delivery_cost = calculate_delivery_cost(
            distance=5.0,
            base_cost=10.0,
            cost_per_km=6.0,
            extra_stops=1,
            cost_per_stop=4.0,
        )
        self.assertEqual(delivery_cost, 44.0)

    def test_normal_savings(self):
        solo = 120.0
        pooled = 90.0
        savings = calculate_savings_amount(solo, pooled)
        self.assertEqual(savings, 30.0)

        pct = calculate_savings_percentage(solo, pooled)
        self.assertEqual(pct, 25.0)

    def test_zero_cost_cases(self):
        zero_solo = calculate_solo_cost(distances=0.0, base_cost=0.0, cost_per_km=0.0)
        self.assertEqual(zero_solo, 0.0)

        zero_pooled = calculate_pooled_cost(distance=0.0, num_orders=0, base_cost=0.0, cost_per_km=0.0)
        self.assertEqual(zero_pooled, 0.0)

        savings = calculate_savings_amount(0.0, 0.0)
        self.assertEqual(savings, 0.0)

        pct = calculate_savings_percentage(solo_cost=0.0, pooled_cost=0.0)
        self.assertIsNone(pct)

    def test_negative_savings(self):
        solo = 50.0
        pooled = 70.0
        savings = calculate_savings_amount(solo, pooled)
        self.assertEqual(savings, -20.0)

        pct = calculate_savings_percentage(solo, pooled)
        self.assertEqual(pct, -40.0)

    def test_per_shop_savings(self):
        shop_costs = {"shop_1": 60.0, "shop_2": 40.0}
        total_pooled = 70.0

        none_alloc = calculate_per_shop_savings(shop_costs, total_pooled, allocation_method=None)
        self.assertIsNone(none_alloc)

        prop_alloc = calculate_per_shop_savings(shop_costs, total_pooled, allocation_method="proportional_solo_cost")
        self.assertEqual(prop_alloc["shop_1"], 18.0)
        self.assertEqual(prop_alloc["shop_2"], 12.0)

        equal_alloc = calculate_per_shop_savings(shop_costs, total_pooled, allocation_method="equal_split")
        self.assertEqual(equal_alloc["shop_1"], 15.0)
        self.assertEqual(equal_alloc["shop_2"], 15.0)

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            calculate_solo_cost(distances=-5.0, base_cost=10.0, cost_per_km=5.0)

        with self.assertRaises(ValueError):
            calculate_solo_cost(distances=5.0, base_cost=-10.0, cost_per_km=5.0)

        with self.assertRaises(ValueError):
            calculate_solo_cost(distances=[5.0, -2.0], base_cost=10.0, cost_per_km=5.0)

        with self.assertRaises(ValueError):
            calculate_pooled_cost(distance=-1.0)

        with self.assertRaises(ValueError):
            calculate_pooled_cost(distance=5.0, num_orders=-1)

        with self.assertRaises(ValueError):
            calculate_savings_amount(-10.0, 20.0)

        with self.assertRaises(ValueError):
            calculate_savings_amount(10.0, -20.0)

        with self.assertRaises(ValueError):
            calculate_savings_percentage(-10.0, 20.0)

        with self.assertRaises(ValueError):
            calculate_per_shop_savings({"shop_1": -10.0}, total_pooled_cost=20.0, allocation_method="equal_split")

        with self.assertRaises(ValueError):
            calculate_per_shop_savings({"shop_1": 20.0}, total_pooled_cost=-5.0, allocation_method="equal_split")

        with self.assertRaises(ValueError):
            calculate_per_shop_savings({"shop_1": 20.0}, total_pooled_cost=10.0, allocation_method="unknown_method")


if __name__ == "__main__":
    unittest.main()
