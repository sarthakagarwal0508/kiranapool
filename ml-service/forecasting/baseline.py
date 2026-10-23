import random

DEFAULT_TIME_INTERVALS = [
    "09:00-11:00",
    "11:00-13:00",
    "13:00-15:00",
    "15:00-17:00",
    "17:00-19:00",
    "19:00-21:00",
]


def generate_synthetic_demand_history(
    shop_ids,
    time_intervals=None,
    num_days=7,
    seed=42,
):
    if not shop_ids:
        raise ValueError("shop_ids list cannot be empty")
    if num_days <= 0:
        raise ValueError("num_days must be positive")

    intervals = time_intervals if time_intervals is not None else DEFAULT_TIME_INTERVALS
    rng = random.Random(seed)
    history = []

    for day in range(1, num_days + 1):
        for shop_id in shop_ids:
            for interval in intervals:
                demand = rng.randint(1, 15)
                history.append({
                    "day": day,
                    "shop_id": shop_id,
                    "time_interval": interval,
                    "demand": demand,
                    "is_synthetic": True,
                })

    return history


def calculate_historical_average(observations):
    if not isinstance(observations, list):
        raise TypeError("observations must be a list of numbers")

    if not observations:
        return 0.0

    for val in observations:
        if not isinstance(val, (int, float)):
            raise TypeError("All demand observations must be numbers")
        if val < 0:
            raise ValueError("All demand observations must be non-negative numbers")

    return round(sum(observations) / len(observations), 2)


def forecast_demand(
    shop_id,
    time_interval,
    historical_data,
    default_forecast=0.0,
):
    if not isinstance(shop_id, str) or not shop_id:
        raise TypeError("shop_id must be a non-empty string")

    if not isinstance(time_interval, str) or not time_interval:
        raise TypeError("time_interval must be a non-empty string")

    if not isinstance(default_forecast, (int, float)) or default_forecast < 0:
        raise ValueError("default_forecast must be a non-negative number")

    if not historical_data:
        return float(default_forecast)

    if not isinstance(historical_data, list):
        raise TypeError("historical_data must be a list of records")

    matching_demands = []
    for record in historical_data:
        if not isinstance(record, dict):
            raise TypeError("Each historical record must be a dictionary")

        rec_shop = record.get("shop_id")
        rec_interval = record.get("time_interval")

        if rec_shop == shop_id and rec_interval == time_interval:
            demand = record.get("demand", record.get("order_count"))
            if demand is None:
                raise ValueError("Record missing demand or order_count field")
            matching_demands.append(demand)

    if not matching_demands:
        return float(default_forecast)

    return calculate_historical_average(matching_demands)


def forecast_all_shops(
    historical_data,
    time_interval=None,
    default_forecast=0.0,
):
    if not isinstance(default_forecast, (int, float)) or default_forecast < 0:
        raise ValueError("default_forecast must be a non-negative number")

    if not historical_data:
        return {}

    if not isinstance(historical_data, list):
        raise TypeError("historical_data must be a list of records")

    shop_observations = {}
    for record in historical_data:
        if not isinstance(record, dict):
            raise TypeError("Each historical record must be a dictionary")

        shop_id = record.get("shop_id")
        if not shop_id:
            continue

        if time_interval is not None and record.get("time_interval") != time_interval:
            continue

        demand = record.get("demand", record.get("order_count"))
        if demand is None:
            raise ValueError("Record missing demand or order_count field")

        if shop_id not in shop_observations:
            shop_observations[shop_id] = []
        shop_observations[shop_id].append(demand)

    forecasts = {}
    for shop_id, obs in shop_observations.items():
        forecasts[shop_id] = calculate_historical_average(obs)

    return forecasts
