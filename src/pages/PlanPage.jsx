import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { plansApi, warehousesApi, ridersApi } from "../services/api";

const idOf = (v) =>
  typeof v === "string" ? v : v?._id || v?.id || "";

const listOf = (r) =>
  Array.isArray(r?.data)
    ? r.data
    : Array.isArray(r)
      ? r
      : [];

const money = (v) => {
  if (v === null || v === undefined || v === "") return "—";

  const amount = Number(v);
  return Number.isFinite(amount) ? `₹${amount.toFixed(2)}` : "—";
};

const getPooledCost = (plan) =>
  plan?.pooled?.totalCost ??
  plan?.pooled?.cost ??
  plan?.meta?.pooled?.totalCost ??
  plan?.meta?.pooled?.cost ??
  plan?.pooledCost ??
  plan?.totalPooledCost ??
  null;

const getSoloCost = (plan) =>
  plan?.solo?.totalCost ??
  plan?.solo?.cost ??
  plan?.meta?.solo?.totalCost ??
  plan?.meta?.solo?.cost ??
  plan?.totalSoloCost ??
  null;

const getSavings = (plan) =>
  plan?.savings?.amount ??
  plan?.meta?.savings?.amount ??
  plan?.meta?.savings?.savings_amount ??
  plan?.savingsAmount ??
  null;

export default function PlanPage() {
  const { user } = useAuth();
  const isWholesaler = user?.role === "wholesaler";

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [riders, setRiders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [warehouseResult, planResult, riderResult] =
        await Promise.all([
          isWholesaler
            ? warehousesApi.getAll()
            : Promise.resolve({ data: [] }),
          plansApi.getAll(),
          isWholesaler
            ? ridersApi.getAll()
            : Promise.resolve({ data: [] }),
        ]);

      const warehouseList = listOf(warehouseResult);
      const planList = listOf(planResult);

      setWarehouses(warehouseList);
      setWarehouseId((old) => old || idOf(warehouseList[0]));
      setPlans(planList);
      setRiders(listOf(riderResult));

      // Temporary diagnostics: check the actual cost fields from the API.
      console.table(
        planList.map((plan) => ({
          plan: plan.name,
          status: plan.status,
          pooledCost: getPooledCost(plan),
          soloCost: getSoloCost(plan),
          savings: getSavings(plan),
        }))
      );
    } catch (err) {
      setError(err.message || "Could not load delivery plans.");
    } finally {
      setLoading(false);
    }
  }, [isWholesaler]);

  useEffect(() => {
    load();
  }, [load]);

  async function autoPool() {
    setWorking(true);
    setError("");
    setNotice("");

    try {
      const result = await plansApi.autoPool(
        warehouseId ? { warehouseId } : {}
      );

      setNotice(
        result.message ||
          `Pooling finished. ${result.plansCreated || 0} plans created.`
      );
      await load();
    } catch (err) {
      setError(err.message || "Could not pool orders.");
    } finally {
      setWorking(false);
    }
  }

  async function assign(planId, riderId) {
    if (!riderId) return;

    setWorking(true);
    setError("");
    setNotice("");

    try {
      await plansApi.assignRider(planId, riderId);
      setNotice("Rider assigned successfully.");
      await load();
    } catch (err) {
      setError(err.message || "Could not assign rider.");
    } finally {
      setWorking(false);
    }
  }

  async function cancel(planId) {
    if (
      !window.confirm(
        "Cancel this plan and return its unstarted orders to pending?"
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setNotice("");

    try {
      await plansApi.cancel(planId);
      setNotice("Plan cancelled.");
      await load();
    } catch (err) {
      setError(err.message || "Could not cancel plan.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-title-row">
        <div>
          <div className="eyebrow">OPERATIONS / PLANNING</div>
          <h1>Delivery planning</h1>
          <p className="page-subtitle">
            {isWholesaler
              ? "Pool compatible orders from the same warehouse, location cluster and overlapping delivery slots."
              : "View the route assigned to your rider account."}
          </p>
        </div>
        <span className="soft-tag">Phase 6 · Pooling</span>
      </section>

      {error && (
        <div className="alert error-alert" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="alert success-alert" role="status">
          {notice}
        </div>
      )}

      {isWholesaler && (
        <section className="panel plan-controls">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">POOLING CONTROLS</div>
              <h2>Build delivery plans</h2>
            </div>
            <span className="step-number">01</span>
          </div>

          <label>
            Warehouse
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">All my warehouses</option>
              {warehouses.map((w) => (
                <option key={idOf(w)} value={idOf(w)}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <p className="page-subtitle">
            Auto-pooling only groups pending orders with the same warehouse,
            compatible locations and overlapping delivery slots. Incompatible
            orders remain pending.
          </p>

          <button
            className="button primary"
            type="button"
            onClick={autoPool}
            disabled={working || loading || !warehouses.length}
          >
            {working ? "Processing…" : "✧ Auto-pool compatible orders"}
          </button>

          {!warehouses.length && !loading && (
            <p>Create a warehouse first, then record orders with delivery slots.</p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">ROUTE OUTPUT</div>
            <h2>{isWholesaler ? "Delivery plans" : "My assigned route"}</h2>
          </div>
          <button className="button" type="button" onClick={load}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading plans…</div>
        ) : !plans.length ? (
          <div className="empty-state">
            No delivery plans yet. Compatible pending orders will appear here
            after pooling.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {plans.map((plan, index) => {
              const planId = idOf(plan);
              const orders = Array.isArray(plan.orders) ? plan.orders : [];
              const route = plan.route || {};

              const stops = Array.isArray(route.stops)
                ? route.stops
                : Array.isArray(route)
                  ? route
                  : [];

              const riderId = idOf(plan.rider);
              const pooledCost = getPooledCost(plan);
              const soloCost = getSoloCost(plan);
              const savings = getSavings(plan);

              return (
                <article
                  key={planId || index}
                  style={{
                    border: "1px solid #e5e0ec",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3>{plan.name || `Delivery plan ${index + 1}`}</h3>
                      <p>
                        {plan.warehouse?.name || "Warehouse"} ·{" "}
                        {plan.status || "planned"}
                      </p>
                    </div>
                    <strong>{money(savings)} estimated savings</strong>
                  </div>

                  <div className="plan-metrics">
                    <div>
                      <span>Orders</span>
                      <strong>{orders.length}</strong>
                    </div>

                    <div>
                      <span>Solo cost</span>
                      <strong>{money(soloCost)}</strong>
                    </div>

                    <div>
                      <span>Pooled cost</span>
                      <strong>{money(pooledCost)}</strong>
                      <small
                        style={{
                          display: "block",
                          marginTop: 4,
                          opacity: 0.65,
                          fontSize: 11,
                        }}
                      >
                        Debug:{" "}
                        {pooledCost === null || pooledCost === undefined
                          ? "cost missing in loaded plan"
                          : String(pooledCost)}
                      </small>
                    </div>
                  </div>

                  <p>
                    <strong>Delivery slot:</strong>{" "}
                    {plan.deliverySlotStart
                      ? new Date(plan.deliverySlotStart).toLocaleString()
                      : "—"}{" "}
                    –{" "}
                    {plan.deliverySlotEnd
                      ? new Date(plan.deliverySlotEnd).toLocaleString()
                      : "—"}
                  </p>

                  <p>
                    <strong>Stops:</strong>{" "}
                    {stops
                      .map(
                        (stop) =>
                          stop.label ||
                          stop.address ||
                          stop.type ||
                          "Stop"
                      )
                      .join(" → ") || "Route details unavailable"}
                  </p>

                  <p>
                    <strong>Rider:</strong>{" "}
                    {plan.rider?.name || "Not assigned"}
                  </p>

                  {isWholesaler && plan.status === "planned" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <label>
                        Assign available rider
                        <select
                          value={riderId}
                          onChange={(e) => assign(planId, e.target.value)}
                          disabled={working}
                        >
                          <option value="">Choose rider</option>
                          {riders
                            .filter(
                              (r) => r.isAvailable || idOf(r) === riderId
                            )
                            .map((r) => (
                              <option key={idOf(r)} value={idOf(r)}>
                                {r.name}{" "}
                                {r.isAvailable ? "(available)" : ""}
                              </option>
                            ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => cancel(planId)}
                        disabled={working}
                      >
                        Cancel plan
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}