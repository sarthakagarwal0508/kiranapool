# KiranaPool — ML & Optimization Service

Neighbourhood kirana-store delivery pooling, route optimization, and demand forecasting microservice for KiranaPool.

## 1. Service Purpose

The **KiranaPool ML & Optimization Service** provides hyperlocal order pooling, dispatch routing, demand forecasting, and delivery economics for neighbourhood kirana stores:
- Pooling multiple customer orders into efficient, multi-stop delivery batches.
- Calculating optimal delivery sequences to minimize travel distance and transit time.
- Forecasting demand baselines and transit durations.
- Computing pooling efficiency metrics and delivery cost savings.
- Explaining unpooling fallback reasons.

The service exposes an HTTP API (FastAPI) consumed by the backend application (Node.js/Express).

## 2. Offline Operation Requirement

> **Important**: This service is developed for a 24-hour offline hackathon environment.
> - All routing solvers, heuristic algorithms, forecasting models, and synthetic data generators must execute locally without outbound network calls or external cloud dependencies.
> - Third-party packages must be verified against the local offline Python environment before being added to `requirements.txt`.

## 3. Directory Structure & Responsibilities

```text
ml-service/
├── main.py                  # HTTP API service entry point (FastAPI)
├── config.py                # Runtime configuration and hyperparameter settings
├── requirements.txt         # Minimal verified offline dependencies
├── README.md                # Service overview, structure, and guidelines
├── schemas/                 # API data schemas and payload validation
│   ├── __init__.py
│   ├── request.py           # Inbound request validation models
│   └── response.py          # Outbound response schemas & dispatch plans
├── routing/                 # Order pooling & route optimization engine (ML Dev A)
│   ├── __init__.py
│   ├── distance.py          # Spatial distance (Haversine) & travel duration matrices
│   ├── batching.py          # Order pooling & spatio-temporal clustering
│   ├── heuristic.py         # Fast greedy & heuristic route generation
│   ├── solver.py            # Optimization solver core (CVRPTW)
│   ├── metrics.py           # Route quality & operational efficiency metrics
│   └── reasons.py           # Decision & fallback explanation reason codes
├── forecasting/             # Predictive models and evaluation (ML Dev B)
│   ├── __init__.py
│   ├── baseline.py          # Baseline demand and volume forecasting
│   ├── travel_time.py       # Transit time estimation models
│   └── evaluation.py        # Forecasting error and accuracy evaluation (MAE, RMSE)
├── economics/               # Delivery pooling cost and savings models (ML Dev B)
│   ├── __init__.py
│   └── costs.py             # Solo vs pooled delivery cost calculations
├── data/                    # Simulation datasets, fixtures, and generators (ML Dev B)
│   ├── __init__.py
│   ├── generate.py          # Synthetic kirana store & order generator
│   └── fixtures/            # Static test fixtures and benchmark datasets
└── tests/                   # Automated test suite
    ├── __init__.py
    ├── test_distance.py     # Tests for distance matrices (ML Dev A)
    ├── test_batching.py     # Tests for batching logic (ML Dev A)
    ├── test_routing.py      # Tests for heuristic & solver routing (ML Dev A)
    ├── test_metrics.py      # Tests for metrics & reason codes (ML Dev A)
    ├── test_edge_cases.py   # Tests for edge cases and API error propagation (ML Dev A)
    ├── test_data.py         # Tests for synthetic data generation (ML Dev B)
    ├── test_forecasting.py  # Tests for forecasting models (ML Dev B)
    ├── test_costs.py        # Tests for delivery economics & savings (ML Dev B)
    ├── test_integration.py  # End-to-end integration scenario (ML Dev B)
    └── test_api.py          # API contract tests (Shared)
```

## 4. Team Ownership & Coordination

| Component / Files | Owner | Responsibilities |
|---|---|---|
| `routing/*`<br>`tests/test_distance.py`<br>`tests/test_batching.py`<br>`tests/test_routing.py`<br>`tests/test_metrics.py`<br>`tests/test_edge_cases.py` | **ML Developer A** | Distance matrices, batching heuristics, route optimization solvers, routing KPIs, unpooling reasons, and unit tests. |
| `data/*`<br>`forecasting/*`<br>`economics/*`<br>`tests/test_data.py`<br>`tests/test_forecasting.py`<br>`tests/test_costs.py`<br>`tests/test_integration.py` | **ML Developer B** | Synthetic data generation, baseline volume models, travel time models, prediction metrics, economics, and forecasting tests. |
| `main.py`<br>`config.py`<br>`requirements.txt`<br>`schemas/*`<br>`README.md`<br>`tests/test_api.py` | **Shared** | API contracts, shared configurations, dependency definitions, documentation, and end-to-end integration tests. |

## 5. Running Tests

Run the complete test suite locally from the workspace root:

```bash
# Run all tests
pytest -v

# Run ML-A Routing & Optimization tests
pytest ml-service/tests/test_batching.py
pytest ml-service/tests/test_distance.py
pytest ml-service/tests/test_routing.py
pytest ml-service/tests/test_metrics.py
pytest ml-service/tests/test_edge_cases.py

# Run ML-B Forecasting, Economics & Data tests
pytest ml-service/tests/test_data.py
pytest ml-service/tests/test_forecasting.py
pytest ml-service/tests/test_costs.py
pytest ml-service/tests/test_integration.py
```
