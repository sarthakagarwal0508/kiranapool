# KiranaPool — ML-B Results Report

## 1. Scope

ML-B completed synthetic dataset validation, demand forecasting dataset preparation, baseline forecasting, Random Forest model evaluation, and pooled-delivery economics estimation.

Frontend/backend integration is not done yet.

## 2. Dataset Summary

- Shops: 20
- Riders: 10
- Orders: 1,420
- Demand-history rows: 1,059
- Forecast dataset rows: 3,360
- Travel-time matrix rows: 1,904,400
- Demo orders: 100

Dataset audit checks passed, including unique IDs, valid shop references, demand totals, and travel-matrix validation.

## 3. Forecasting Results

Training data: Days 1–5  
Validation data: Day 6  
Test data: Day 7

| Model | Validation MAE | Validation RMSE | Test MAE | Test RMSE |
|---|---:|---:|---:|---:|
| Baseline | 0.4708 | 0.6709 | 0.5167 | 0.7886 |
| Random Forest | 0.4710 | 0.6623 | 0.5189 | 0.7801 |

Random Forest had slightly lower RMSE but slightly higher MAE than the baseline. It did not clearly outperform the baseline.

Results are illustrative because the dataset contains only seven synthetic days.

## 4. Pooled-Delivery Economics

- Orders evaluated: 1,420
- Solo trips: 1,420
- Greedy pooled trips: 1,268
- Orders in multi-order groups: 283
- Multi-order groups: 131
- Solo estimated distance: 17,065.01 km
- Pooled estimated distance: 15,970.46 km
- Solo estimated cost: ₹241,650.13
- Pooled estimated cost: ₹223,104.59
- Estimated cost difference: ₹18,545.54
- Estimated savings: 7.67%

Validation passed: every order was assigned to exactly one pooled group, and maximum package load was 10.

## 5. Assumptions and Limitations

- Fixed trip cost: ₹50
- Distance cost: ₹10/km
- Maximum package load: 10 units
- Maximum orders per group: 5
- Maximum ready-time gap: 60 minutes
- Maximum customer gap from seed order: 2 km

Grouping uses a greedy heuristic. Distance estimation is simplified and does not use a real road-network routing engine. Traffic, rider shifts, and deadline feasibility are not fully modelled.

All cost and savings estimates are illustrative, not guaranteed real-world outcomes.

## 6. Main Output Files

- `data/orders.csv`
- `data/shops.csv`
- `data/riders.csv`
- `data/demand_history.csv`
- `data/travel_time_matrix.csv`
- `data/forecast_dataset.csv`
- `data/forecast_test_predictions.csv`
- `data/economics_pooled_groups.csv`
- `data/DATA_DICTIONARY.md`
- `data/scenario_manifest.json`

## 7. Integration Status

**ML-B standalone work: completed.**

**Frontend/backend integration: pending.**