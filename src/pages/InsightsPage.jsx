import { useCallback, useEffect, useState } from "react";
import { forecastsApi, mlApi } from "../services/api";

const money = (v) => typeof v === "number" ? `₹${v.toFixed(2)}` : "—";
const listOf = (r) => Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];

export default function InsightsPage() {
  const [forecasts, setForecasts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [horizonDays, setHorizonDays] = useState(7);
  const [groupBy, setGroupBy] = useState("both");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mlHealth, setMlHealth] = useState(null);
const [mlHealthError, setMlHealthError] = useState("");

const checkMLHealth = useCallback(async () => {
    setMlHealthError("");

    try {
        const result = await mlApi.getHealth();
        setMlHealth(result);
    } catch (err) {
        setMlHealth(null);
        setMlHealthError(err.message || "ML health check failed.");
    }
}, []);

useEffect(() => {
    checkMLHealth();
}, [checkMLHealth]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [forecastResult, summaryResult] = await Promise.all([forecastsApi.getAll(), forecastsApi.getSummary()]);
      setForecasts(listOf(forecastResult)); setSummary(summaryResult?.data || summaryResult);
    } catch (err) { setError(err.message || "Could not load forecasting data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function runForecast() {
    setRunning(true); setError(""); setNotice("");
    try {
      const result = await forecastsApi.run({ horizonDays: Number(horizonDays), groupBy });
      setNotice(result.message || `Forecast generated. ${result.count || 0} rows saved.`);
      await load();
    } catch (err) { setError(err.message || "Forecast generation failed."); }
    finally { setRunning(false); }
  }
  async function recordActual(id, value) {
    const actualOrders = Number(value);
    if (!Number.isFinite(actualOrders) || actualOrders < 0) { setError("Actual orders must be zero or greater."); return; }
    try { await forecastsApi.recordActual(id, actualOrders); setNotice("Actual demand saved."); await load(); }
    catch (err) { setError(err.message || "Could not save actual demand."); }
  }

  return <div className="page-stack">
    <section className="page-title-row"><div><div className="eyebrow">ANALYTICS / PERFORMANCE</div><h1>Insights & demand forecasts</h1><p className="page-subtitle">Compare pooled delivery costs and forecast shop-wise and area-wise demand by time slot.</p></div><span className="soft-tag">Phase 7 · ML</span></section>
    {error && <div className="alert error-alert" role="alert">{error}</div>}{notice && <div className="alert success-alert" role="status">{notice}</div>}
    
<section className="panel">
  <div className="panel-heading">
    <div>
      <div className="eyebrow">ML SERVICE</div>
      <h2>Integration status</h2>
    </div>

    <button
      className="button"
      type="button"
      onClick={checkMLHealth}
    >
      Check again
    </button>
  </div>

  {mlHealthError ? (
    <p role="status">
      ML health check failed: {mlHealthError}
    </p>
  ) : mlHealth === null ? (
    <p>Checking ML service…</p>
  ) : (
    <p>
      Backend ML health endpoint responded.
      Check its response for the actual service status.
    </p>
  )}
</section>

    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">FORECAST CONFIGURATION</div><h2>Generate demand forecast</h2></div><span className="soft-tag">FastAPI optional</span></div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"end"}}><label>Forecast horizon (days)<select value={horizonDays} onChange={(e) => setHorizonDays(e.target.value)}>{[1,3,7,14,30].map((n) => <option key={n} value={n}>{n} days</option>)}</select></label><label>Forecast breakdown<select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="both">Shop + area</option><option value="shop">Shop-wise</option><option value="area">Area-wise</option></select></label><button className="button primary" type="button" onClick={runForecast} disabled={running || loading}>{running ? "Generating…" : "Generate forecast"}</button><button className="button" type="button" onClick={load}>Refresh</button></div>
      <p className="page-subtitle"></p>
    </section>
    <section className="stats-grid">
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Forecast rows</span><span className="stat-icon violet">▥</span></div><div className="stat-value">{summary?.count ?? forecasts.length}</div><div className="stat-note">Stored predictions</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Shop forecasts</span><span className="stat-icon blue">⌂</span></div><div className="stat-value">{summary?.shopCount ?? forecasts.filter((f) => f.scope === "shop").length}</div><div className="stat-note">By shop and time slot</div></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-label">Area forecasts</span><span className="stat-icon teal">⌖</span></div><div className="stat-value">{summary?.areaCount ?? forecasts.filter((f) => f.scope === "area").length}</div><div className="stat-note">By area and time slot</div></article>
    </section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">PREDICTION RESULTS</div><h2>Demand by shop, area and slot</h2></div></div>
      {loading ? <div className="loading-state">Loading forecasts…</div> : !forecasts.length ? <div className="empty-state">No forecasts yet. Record orders with delivery slots, then generate a forecast.</div> : <div className="table-wrap"><table className="orders-table"><thead><tr><th>DATE</th><th>SHOP / AREA</th><th>SCOPE</th><th>TIME SLOT</th><th>PREDICTED</th><th>ACTUAL</th><th>SOURCE</th></tr></thead><tbody>{forecasts.map((f) => <tr key={f._id || `${f.forecastDate}-${f.scope}-${f.area}-${f.timeSlot}`}><td>{f.forecastDate ? new Date(f.forecastDate).toLocaleDateString() : "—"}</td><td><strong>{f.shop?.name || f.area || "—"}</strong></td><td>{f.scope}</td><td>{f.timeSlot}</td><td>{Number(f.predictedOrders || 0).toFixed(1)}</td><td>{f.actualOrders ?? "—"}{f.actualOrders == null && <form onSubmit={(e) => { e.preventDefault(); recordActual(f._id, e.currentTarget.elements.actual.value); }} style={{display:"flex",gap:4,marginTop:5}}><input name="actual" type="number" min="0" step="1" placeholder="Actual" aria-label="Actual orders" style={{width:80}}/><button type="submit">Save</button></form>}</td><td>{f.modelSource || "—"}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="panel"><div className="panel-heading"><div><div className="eyebrow">COST EFFICIENCY</div><h2>Pooling impact</h2></div></div><p>Cost savings are reported per delivery plan on the Delivery planning screen. This page focuses on demand forecasting and observed-vs-predicted demand.</p></section>
  </div>;
}
