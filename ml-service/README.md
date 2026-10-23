# KiranaPool ML & Optimization Service

Neighbourhood kirana-store delivery pooling and route optimization microservice for KiranaPool.

## 1. Service Purpose

KiranaPool optimizes delivery logistics for neighbourhood grocery (kirana) stores by:
- Pooling multiple customer orders into efficient, multi-stop delivery batches.
- Calculating optimal delivery sequences to minimize travel distance and transit time.
- Forecasting demand baselines and transit durations.
- Computing pooling efficiency metrics and explaining unpoolable orders.

The service exposes an HTTP API consumed by the backend application (Node.js/Express).

## 2. Offline Operation Requirement

> **Important**: This service is developed for a 24-hour offline hackathon environment.
> - All algorithms, data generators, and dependencies must run completely offline without relying on external cloud APIs or internet connectivity.
> - Third-party packages must be verified against the local offline Python environment before being added to `requirements.txt`.

## 3. Repository & Folder Responsibilities

```text
ml-service/
├── main.py              # Application entry point and API route mounting (Shared)
├── config.py            # Runtime configuration and hyperparameter settings (Shared)
├── requirements.txt     # Service dependencies (Shared)
├── README.md            # Service documentation and team guidelines (Shared)
├── schemas/             # API data schemas and payload validation (Shared)
│   ├── __init__.py
│   ├── request.py       # Input schemas (orders, stores, constraints)
│   └── response.py      # Output schemas (batches, routes, metrics)
├── routing/             # Delivery batching, heuristics, and solvers (ML Dev A)
│   ├── __init__.py
│   ├── distance.py      # Distance matrix computations (Haversine/Manhattan)
│   ├── batching.py      # Order clustering and compatibility filtering
│   ├── heuristic.py     # Fast heuristic routing algorithms
│   ├── solver.py        # Constrained route optimization solvers
│   ├── metrics.py       # Efficiency, detour factor, and cost metrics
│   └── reasons.py       # Unpooling / rejection reason taxonomy
├── forecasting/         # Predictive models and evaluation (ML Dev B)
│   ├── __init__.py
│   ├── baseline.py      # Baseline demand and volume forecasting
│   ├── travel_time.py   # Transit time estimation models
│   └── evaluation.py    # Forecasting error and accuracy evaluation
├── data/                # Mock data generation and test fixtures (ML Dev B)
│   ├── __init__.py
│   ├── generate.py      # Synthetic kirana store & order generator
│   └── fixtures/        # Static test fixtures and benchmark datasets
└── tests/               # Test suites (A, B, and Shared)
    ├── test_distance.py
    ├── test_batching.py
    ├── test_routing.py
    ├── test_metrics.py
    ├── test_forecasting.py
    └── test_api.py
```

## 4. Team Ownership & Coordination

To avoid merge conflicts during concurrent development, ownership is divided as follows:

| Component / Files | Owner | Responsibilities |
|---|---|---|
| `routing/*`<br>`tests/test_distance.py`<br>`tests/test_batching.py`<br>`tests/test_routing.py`<br>`tests/test_metrics.py` | **ML Developer A** | Distance matrices, batching heuristics, route optimization solvers, routing KPIs, unpooling reasons, and unit tests. |
| `data/*`<br>`forecasting/*`<br>`tests/test_forecasting.py` | **ML Developer B** | Synthetic data generation, baseline volume models, travel time models, prediction metrics, and forecasting tests. |
| `main.py`<br>`config.py`<br>`requirements.txt`<br>`schemas/*`<br>`README.md`<br>`tests/test_api.py` | **Shared** *(Coordination Required)* | API contracts, shared configurations, dependency definitions, documentation, and end-to-end integration tests. |

> **Coordination Rule**: Shared files must never be edited without prior alignment between both developers.

## 5. How to Run Tests (Once Implemented)

Once testing packages and logic are implemented, run tests locally via either:

```bash
# Using standard library unittest runner (offline, zero-dependency)
python -m unittest discover -s tests -p "test_*.py"

# Or using pytest (if verified and installed in the offline environment)
pytest tests/
```
