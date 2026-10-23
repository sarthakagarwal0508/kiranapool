
from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "forecast_dataset.csv"

df = pd.read_csv(DATA_PATH)

features = ["shop_id", "interval_start", "hour", "minute_of_hour"]
target = "order_count"

# Keep the time-based split: no future-day rows in training.
train = df[df["day"] <= 5]
valid = df[df["day"] == 6]
test = df[df["day"] == 7]

preprocessor = ColumnTransformer(
    transformers=[
        ("shop", OneHotEncoder(handle_unknown="ignore"), ["shop_id"]),
        ("time", "passthrough",
         ["interval_start", "hour", "minute_of_hour"]),
    ]
)

model = Pipeline([
    ("preprocessor", preprocessor),
    ("regressor", RandomForestRegressor(
        n_estimators=200,
        min_samples_leaf=3,
        random_state=12345,
        n_jobs=-1,
    )),
])

model.fit(train[features], train[target])

def evaluate(data, label):
    actual = data[target]
    predictions = model.predict(data[features]).clip(0)

    mae = mean_absolute_error(actual, predictions)
    rmse = mean_squared_error(actual, predictions) ** 0.5

    print(f"\n{label}")
    print(f"MAE:  {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")

    return predictions

print("Training rows:", len(train))
print("Validation rows:", len(valid))
print("Test rows:", len(test))

evaluate(valid, "RANDOM FOREST — VALIDATION (Day 6)")
test_predictions = evaluate(test, "RANDOM FOREST — TEST (Day 7)")

# Save test predictions for later analysis.
output = test[["day", "shop_id", "interval_start", "order_count"]].copy()
output["predicted_order_count"] = test_predictions

output_path = BASE_DIR / "data" / "forecast_test_predictions.csv"
output.to_csv(output_path, index=False)

print("\nPredictions saved to:", output_path)
print("Training and evaluation complete.")
