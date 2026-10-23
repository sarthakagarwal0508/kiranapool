import math
import unittest
from forecasting.baseline import (
    calculate_historical_average,
    forecast_all_shops,
    forecast_demand,
    generate_synthetic_demand_history,
)
from forecasting.evaluation import (
    calculate_mae,
    calculate_rmse,
    evaluate_demand_forecast_time_holdout,
)
from forecasting.travel_time import (
    DEFAULT_SPEED_KMH,
    estimate_route_travel_time,
    estimate_travel_time,
)


class TestTravelTime(unittest.TestCase):

    def test_zero_distance(self):
        self.assertEqual(estimate_travel_time(0.0), 0.0)
        self.assertEqual(estimate_travel_time(0, unit="hours"), 0.0)
        self.assertEqual(estimate_travel_time(0.0, unit="seconds"), 0.0)
        self.assertEqual(estimate_route_travel_time([0.0, 0.0]), 0.0)

    def test_ordinary_trips(self):
        time_default = estimate_travel_time(10.0)
        self.assertEqual(time_default, 30.0)

        time_custom_speed = estimate_travel_time(5.0, speed_kmh=30.0)
        self.assertEqual(time_custom_speed, 10.0)

        route_time = estimate_route_travel_time([2.0, 3.0, 5.0], speed_kmh=20.0)
        self.assertEqual(route_time, 30.0)

        route_time_with_delays = estimate_route_travel_time(
            [2.0, 3.0, 5.0],
            speed_kmh=20.0,
            stop_delay_minutes=3.0,
        )
        self.assertEqual(route_time_with_delays, 36.0)

    def test_unit_consistency(self):
        distance = 12.0
        speed = 24.0

        hours = estimate_travel_time(distance, speed_kmh=speed, unit="hours")
        minutes = estimate_travel_time(distance, speed_kmh=speed, unit="minutes")
        seconds = estimate_travel_time(distance, speed_kmh=speed, unit="seconds")

        self.assertEqual(hours, 0.5)
        self.assertEqual(minutes, 30.0)
        self.assertEqual(seconds, 1800.0)
        self.assertAlmostEqual(hours * 60.0, minutes)
        self.assertAlmostEqual(minutes * 60.0, seconds)

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            estimate_travel_time(-5.0)

        with self.assertRaises(ValueError):
            estimate_travel_time(10.0, speed_kmh=0.0)

        with self.assertRaises(ValueError):
            estimate_travel_time(10.0, speed_kmh=-20.0)

        with self.assertRaises(ValueError):
            estimate_travel_time(10.0, unit="invalid_unit")

        with self.assertRaises(TypeError):
            estimate_travel_time("10.0")

        with self.assertRaises(TypeError):
            estimate_travel_time(10.0, speed_kmh="fast")

        with self.assertRaises(TypeError):
            estimate_route_travel_time("not a list")

        with self.assertRaises(ValueError):
            estimate_route_travel_time([5.0], stop_delay_minutes=-2.0)


class TestDemandForecastingBaseline(unittest.TestCase):

    def test_valid_history(self):
        history = [
            {"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 10},
            {"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 14},
            {"shop_id": "shop_2", "time_interval": "09:00-11:00", "demand": 6},
            {"shop_id": "shop_1", "time_interval": "11:00-13:00", "demand": 20},
        ]

        forecast_shop_1 = forecast_demand("shop_1", "09:00-11:00", history)
        self.assertEqual(forecast_shop_1, 12.0)

        forecast_shop_2 = forecast_demand("shop_2", "09:00-11:00", history)
        self.assertEqual(forecast_shop_2, 6.0)

        all_shops_morning = forecast_all_shops(history, time_interval="09:00-11:00")
        self.assertEqual(all_shops_morning["shop_1"], 12.0)
        self.assertEqual(all_shops_morning["shop_2"], 6.0)

        synthetic_hist = generate_synthetic_demand_history(["shop_1", "shop_2"], num_days=3, seed=10)
        self.assertGreater(len(synthetic_hist), 0)
        for record in synthetic_hist:
            self.assertTrue(record["is_synthetic"])

        synth_forecast = forecast_demand("shop_1", "09:00-11:00", synthetic_hist)
        self.assertIsInstance(synth_forecast, float)
        self.assertGreater(synth_forecast, 0)

    def test_empty_and_missing_history(self):
        self.assertEqual(calculate_historical_average([]), 0.0)

        self.assertEqual(forecast_demand("shop_1", "09:00-11:00", []), 0.0)
        self.assertEqual(forecast_demand("shop_1", "09:00-11:00", [], default_forecast=3.5), 3.5)

        history = [{"shop_id": "shop_1", "time_interval": "09:00-11:00", "demand": 8}]
        self.assertEqual(forecast_demand("shop_999", "09:00-11:00", history), 0.0)
        self.assertEqual(forecast_demand("shop_1", "17:00-19:00", history, default_forecast=2.0), 2.0)

        self.assertEqual(forecast_all_shops([]), {})

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            calculate_historical_average([5, -2, 10])

        with self.assertRaises(TypeError):
            calculate_historical_average("not a list")

        with self.assertRaises(TypeError):
            calculate_historical_average([5, "ten"])

        with self.assertRaises(TypeError):
            forecast_demand("", "09:00-11:00", [])

        with self.assertRaises(TypeError):
            forecast_demand("shop_1", "", [])

        with self.assertRaises(ValueError):
            forecast_demand("shop_1", "09:00-11:00", [], default_forecast=-1.0)

        with self.assertRaises(TypeError):
            forecast_demand("shop_1", "09:00-11:00", "invalid_history")

        with self.assertRaises(TypeError):
            forecast_demand("shop_1", "09:00-11:00", ["not a dict"])

        with self.assertRaises(ValueError):
            forecast_demand("shop_1", "09:00-11:00", [{"shop_id": "shop_1", "time_interval": "09:00-11:00"}])

        with self.assertRaises(ValueError):
            generate_synthetic_demand_history([])

        with self.assertRaises(ValueError):
            generate_synthetic_demand_history(["shop_1"], num_days=0)


class TestForecastingEvaluation(unittest.TestCase):

    def test_mae_and_rmse_known_values(self):
        actual = [10.0, 15.0, 20.0]
        predicted = [12.0, 15.0, 18.0]

        mae = calculate_mae(actual, predicted)
        self.assertEqual(mae, 1.3333)

        rmse = calculate_rmse(actual, predicted)
        expected_rmse = round(math.sqrt((4.0 + 0.0 + 4.0) / 3.0), 4)
        self.assertEqual(rmse, expected_rmse)

    def test_mae_rmse_validation(self):
        with self.assertRaises(ValueError):
            calculate_mae([1.0, 2.0], [1.0])

        with self.assertRaises(ValueError):
            calculate_rmse([1.0], [1.0, 2.0])

        with self.assertRaises(ValueError):
            calculate_mae([], [])

        with self.assertRaises(ValueError):
            calculate_rmse([], [])

        with self.assertRaises(TypeError):
            calculate_mae([1.0, "two"], [1.0, 2.0])

        with self.assertRaises(TypeError):
            calculate_rmse([1.0, 2.0], [1.0, None])

        with self.assertRaises(TypeError):
            calculate_mae("not a list", [1.0])

    def test_time_based_holdout_evaluation(self):
        history = generate_synthetic_demand_history(
            shop_ids=["shop_1", "shop_2"],
            num_days=7,
            seed=42,
        )

        result = evaluate_demand_forecast_time_holdout(history, holdout_days=2)

        self.assertEqual(result["evaluation_type"], "synthetic")
        self.assertEqual(result["holdout_days"], 2)
        self.assertGreater(result["train_sample_count"], 0)
        self.assertGreater(result["test_sample_count"], 0)
        self.assertEqual(result["sample_count"], result["test_sample_count"])
        self.assertGreaterEqual(result["mae"], 0.0)
        self.assertGreaterEqual(result["rmse"], result["mae"])

    def test_time_based_holdout_insufficient_data(self):
        history_short = generate_synthetic_demand_history(
            shop_ids=["shop_1"],
            num_days=2,
            seed=1,
        )

        with self.assertRaises(ValueError):
            evaluate_demand_forecast_time_holdout(history_short, holdout_days=2)

        with self.assertRaises(ValueError):
            evaluate_demand_forecast_time_holdout([], holdout_days=1)

        with self.assertRaises(ValueError):
            evaluate_demand_forecast_time_holdout(history_short, holdout_days=0)


if __name__ == "__main__":
    unittest.main()
