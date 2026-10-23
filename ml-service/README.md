# KiranaPool — ML & Optimization Service

## Service Purpose

The **KiranaPool ML & Optimization Service** provides hyperlocal order pooling, dispatch routing, and demand forecasting for neighbourhood kirana store deliveries. It enables multiple kirana stores to collaboratively pool delivery orders and optimize rider routes under strict delivery time windows and capacity constraints.

## Offline-First Execution

> **Important**: This service must operate completely **offline**. All routing solvers, heuristic algorithms, forecasting models, and synthetic data generators must execute locally without outbound network calls or external cloud dependencies.

---

## Directory Structure & Responsibilities

```text
ml-service/
├── main.py                  # HTTP API service entry point (Shared)
├── config.py                # Service configuration & offline settings (Shared)
├── requirements.txt         # Minimal verified offline dependencies (Shared)
├── README.md                # Service overview, structure, and guidelines (Shared)
├── schemas/                 # Request & response data contracts (Shared)
│   ├── __init__.py
│   ├── request.py           # Inbound request validation models
│   └── response.py          # Outbound response schemas & dispatch plans
├── routing/                 # Order pooling & route optimization engine (ML Dev A)
│   ├── __init__.py
│   ├── distance.py          # Spatial distance & travel duration matrices
│   ├── batching.py          # Order pooling & spatio-temporal clustering
│   ├── heuristic.py         # Fast greedy & heuristic route generation
│   ├── solver.py            # Optimization solver core (CVRPTW)
│   ├── metrics.py           # Route quality & operational metrics
│   └── reasons.py           # Decision & fallback explanation reason codes
├── forecasting/             # Demand & transit time estimators (ML Dev B)
│   ├── __init__.py
│   ├── baseline.py          # Baseline demand prediction models
│   ├── travel_time.py       # Travel time and traffic delay estimation
│   └── evaluation.py        # Model validation and forecast error metrics
├── data/                    # Simulation & benchmark datasets (ML Dev B)
│   ├── __init__.py
│   ├── generate.py          # Synthetic order & merchant scenario generation
│   └── fixtures/            # Static scenario fixtures for offline testing
└── tests/                   # Automated test suite
    ├── __init__.py
    ├── test_distance.py     # Tests for distance & duration matrices (ML Dev A)
    ├── test_batching.py     # Tests for batching logic (ML Dev A)
    ├── test_routing.py      # Tests for heuristic & solver routing (ML Dev A)
    ├── test_metrics.py      # Tests for metrics & reason codes (ML Dev A)
    ├── test_forecasting.py  # Tests for forecasting models (ML Dev B)
    └── test_api.py          # Integration & API contract tests (Shared)
```

---

## Team Ownership & Coordination

| Component | Owner | Scope |
| :--- | :--- | :--- |
| **Routing & Optimization** | ML Developer A | `routing/distance.py`, `routing/batching.py`, `routing/heuristic.py`, `routing/solver.py`, `routing/metrics.py`, `routing/reasons.py`, `tests/test_distance.py`, `tests/test_batching.py`, `tests/test_routing.py`, `tests/test_metrics.py` |
| **Data & Forecasting** | ML Developer B | `data/`, `forecasting/`, `tests/test_forecasting.py` |
| **Shared Boundary** | Shared (Coordinate) | `main.py`, `config.py`, `requirements.txt`, `schemas/`, `README.md`, `tests/test_api.py` |

*Note*: Shared files must not be modified independently without coordination across both developers.

---

## Integration Boundary

The ML service is designed to expose a lightweight HTTP API consumed by the backend (e.g. Node.js/Express service). Inbound and outbound data contracts in `schemas/` will be populated once the official API contract is reviewed and verified.

---

## Running Tests

Once implementations are added, run the offline test suite using `pytest`:

```bash
# Run all tests
pytest tests/

# Run specific test modules
pytest tests/test_distance.py
pytest tests/test_batching.py
pytest tests/test_routing.py
pytest tests/test_forecasting.py
pytest tests/test_api.py
```
