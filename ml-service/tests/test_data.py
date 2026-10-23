import unittest
from data.generate import (
    BASE_LAT,
    BASE_LNG,
    COORD_OFFSET,
    generate_dataset,
    generate_orders,
    generate_riders,
    generate_shops,
    generate_synthetic_data,
)


class TestSyntheticDataGeneration(unittest.TestCase):

    def test_reproducibility(self):
        data1 = generate_synthetic_data(num_shops=4, num_riders=2, num_orders=10, seed=123)
        data2 = generate_synthetic_data(num_shops=4, num_riders=2, num_orders=10, seed=123)
        self.assertEqual(data1, data2)

        data_diff = generate_synthetic_data(num_shops=4, num_riders=2, num_orders=10, seed=456)
        self.assertNotEqual(data1, data_diff)

    def test_unique_ids(self):
        data = generate_synthetic_data(num_shops=6, num_riders=4, num_orders=30, seed=99)
        
        shop_ids = [s["id"] for s in data["shops"]]
        self.assertEqual(len(shop_ids), 6)
        self.assertEqual(len(shop_ids), len(set(shop_ids)))

        rider_ids = [r["id"] for r in data["riders"]]
        self.assertEqual(len(rider_ids), 4)
        self.assertEqual(len(rider_ids), len(set(rider_ids)))

        order_ids = [o["id"] for o in data["orders"]]
        self.assertEqual(len(order_ids), 30)
        self.assertEqual(len(order_ids), len(set(order_ids)))

    def test_valid_shop_references(self):
        data = generate_synthetic_data(num_shops=5, num_riders=3, num_orders=25, seed=77)
        shop_ids = {s["id"] for s in data["shops"]}

        for order in data["orders"]:
            self.assertIn("shop_id", order)
            self.assertIn(order["shop_id"], shop_ids)

    def test_valid_generated_values(self):
        data = generate_synthetic_data(num_shops=5, num_riders=3, num_orders=20, seed=42)

        for shop in data["shops"]:
            self.assertTrue(BASE_LAT - COORD_OFFSET <= shop["lat"] <= BASE_LAT + COORD_OFFSET)
            self.assertTrue(BASE_LNG - COORD_OFFSET <= shop["lng"] <= BASE_LNG + COORD_OFFSET)

        for rider in data["riders"]:
            self.assertTrue(BASE_LAT - COORD_OFFSET <= rider["lat"] <= BASE_LAT + COORD_OFFSET)
            self.assertTrue(BASE_LNG - COORD_OFFSET <= rider["lng"] <= BASE_LNG + COORD_OFFSET)
            self.assertGreaterEqual(rider["capacity"], 3)
            self.assertLessEqual(rider["capacity"], 6)

        for order in data["orders"]:
            self.assertTrue(BASE_LAT - COORD_OFFSET <= order["lat"] <= BASE_LAT + COORD_OFFSET)
            self.assertTrue(BASE_LNG - COORD_OFFSET <= order["lng"] <= BASE_LNG + COORD_OFFSET)
            self.assertGreaterEqual(order["weight"], 0.5)
            self.assertLessEqual(order["weight"], 10.0)

    def test_configurable_counts(self):
        data = generate_dataset(num_shops=2, num_riders=1, num_orders=5, seed=10)
        self.assertEqual(len(data["shops"]), 2)
        self.assertEqual(len(data["riders"]), 1)
        self.assertEqual(len(data["orders"]), 5)

    def test_empty_shops_raises_error(self):
        with self.assertRaises(ValueError):
            generate_orders(count=5, shops=[], seed=42)


if __name__ == "__main__":
    unittest.main()
