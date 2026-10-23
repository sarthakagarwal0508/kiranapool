import math
from forecasting.baseline import forecast_demand


def calculate_mae(actual, predicted):
    if not isinstance(actual, list) or not isinstance(predicted, list):
        raise TypeError("actual and predicted must be lists of numbers")

    if len(actual) == 0:
        raise ValueError("Cannot calculate MAE on empty lists")

    if len(actual) != len(predicted):
        raise ValueError("actual and predicted lists must have identical lengths")

    total_error = 0.0
    for a, p in zip(actual, predicted):
        if not isinstance(a, (int, float)) or not isinstance(p, (int, float)):
            raise TypeError("All actual and predicted values must be numbers")
        total_error += abs(a - p)

    return round(total_error / len(actual), 4)


def calculate_rmse(actual, predicted):
    if not isinstance(actual, list) or not isinstance(predicted, list):
        raise TypeError("actual and predicted must be lists of numbers")

    if len(actual) == 0:
        raise ValueError("Cannot calculate RMSE on empty lists")

    if len(actual) != len(predicted):
        raise ValueError("actual and predicted lists must have identical lengths")

    total_sq_error = 0.0
    for a, p in zip(actual, predicted):
        if not isinstance(a, (int, float)) or not isinstance(p, (int, float)):
            raise TypeError("All actual and predicted values must be numbers")
        total_sq_error += (a - p) ** 2

    return round(math.sqrt(total_sq_error / len(actual)), 4)


def evaluate_demand_forecast_time_holdout(
    historical_data,
    holdout_days=2,
    default_forecast=0.0,
):
    if not isinstance(historical_data, list):
        raise TypeError("historical_data must be a list of records")

    if not historical_data:
        raise ValueError("historical_data cannot be empty")

    if not isinstance(holdout_days, int) or holdout_days <= 0:
        raise ValueError("holdout_days must be a positive integer")

    days = set()
    for record in historical_data:
        if not isinstance(record, dict) or "day" not in record:
            raise ValueError("All records must be dictionaries with a 'day' field for time-based evaluation")
        days.add(record["day"])

    sorted_days = sorted(days)
    if len(sorted_days) <= holdout_days:
        raise ValueError("Insufficient historical days to create a time-based holdout")

    cutoff_day = sorted_days[-holdout_days]

    train_data = [r for r in historical_data if r["day"] < cutoff_day]
    test_data = [r for r in historical_data if r["day"] >= cutoff_day]

    if not train_data or not test_data:
        raise ValueError("Time-based holdout split resulted in empty train or test set")

    is_synthetic = any(r.get("is_synthetic", False) for r in historical_data)

    actual = []
    predicted = []

    for test_record in test_data:
        act_val = test_record.get("demand", test_record.get("order_count"))
        if act_val is None:
            raise ValueError("Record missing demand or order_count field")

        pred_val = forecast_demand(
            shop_id=test_record["shop_id"],
            time_interval=test_record["time_interval"],
            historical_data=train_data,
            default_forecast=default_forecast,
        )

        actual.append(act_val)
        predicted.append(pred_val)

    mae = calculate_mae(actual, predicted)
    rmse = calculate_rmse(actual, predicted)

    return {
        "mae": mae,
        "rmse": rmse,
        "sample_count": len(actual),
        "train_sample_count": len(train_data),
        "test_sample_count": len(test_data),
        "holdout_days": holdout_days,
        "evaluation_type": "synthetic" if is_synthetic else "real_world",
    }
