
from pathlib import Path
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "forecast_dataset.csv"

df = pd.read_csv(DATA_PATH)

# Train on Days 1–5, validate on Day 6, test on Day 7.
train = df[df["day"] <= 5].copy()
valid = df[df["day"] == 6].copy()
test = df[df["day"] == 7].copy()

# Baseline: predict each shop/time interval using its
# average demand across training days.
averages = (
    train.groupby(["shop_id", "interval_start"])["order_count"]
    .mean()
    .rename("prediction")
    .reset_index()
)

def evaluate(part, name):
    result = part.merge(
        averages,
        on=["shop_id", "interval_start"],
        how="left",
    )
    result["prediction"] = result["prediction"].fillna(0)

    mae = mean_absolute_error(
        result["order_count"], result["prediction"]
    )
    rmse = mean_squared_error(
        result["order_count"], result["prediction"]
    ) ** 0.5

    print(f"\n{name}")
    print(f"Rows: {len(result)}")
    print(f"MAE:  {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")

evaluate(valid, "VALIDATION — Day 6")
evaluate(test, "TEST — Day 7")

print("\nBaseline evaluation complete.")
