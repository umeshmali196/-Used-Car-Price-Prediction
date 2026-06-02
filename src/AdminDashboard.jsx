import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "./api";
import { useAuth } from "./auth";

const palette = ["#0f766e", "#d97706", "#059669", "#52525b", "#be123c", "#7c3aed"];

function AdminDashboard() {
  const { logout, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    const { data } = await api.get("/admin/summary");
    setSummary(data);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      try {
        const { data } = await api.get("/admin/summary");
        if (isMounted) setSummary(data);
      } catch (err) {
        if (isMounted) setError(err.response?.data?.message || "Unable to load admin data.");
      }
    }

    loadAdminData();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateUser = async (id, status) => {
    await api.patch(`/admin/users/${id}/status`, { status });
    await loadSummary();
  };

  const updateListing = async (id, status) => {
    await api.patch(`/admin/listings/${id}/status`, { status });
    await loadSummary();
  };

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700">Operations control room</p>
            <h1 className="text-2xl font-bold">Advanced Admin Dashboard</h1>
            <p className="text-sm text-zinc-500">Admin: {user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold hover:bg-zinc-100" onClick={() => (window.location.href = "/dashboard")} type="button">
              User app
            </button>
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800" onClick={() => window.print()} type="button">
              Export report
            </button>
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold hover:bg-zinc-100" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {summary && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <Metric label="Total users" value={summary.total_users} tone="teal" />
              <Metric label="Active users" value={summary.active_users} tone="emerald" />
              <Metric label="Predictions" value={summary.total_predictions} tone="amber" />
              <Metric label="Today" value={summary.predictions_today} tone="zinc" />
              <Metric label="Listings" value={summary.total_listings} tone="teal" />
              <Metric label="Pending" value={summary.pending_listings} tone="amber" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <ChartCard title="Average price by company">
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart data={summary.charts.company}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value) => Number(value).toLocaleString("en-IN")} />
                    <Bar dataKey="average_price" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Fuel mix">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie data={summary.charts.fuel} dataKey="count" nameKey="label" outerRadius={100}>
                      {summary.charts.fuel.map((entry, index) => <Cell fill={palette[index % palette.length]} key={entry.label} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="City-wise average price">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={summary.charts.city}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => Number(value).toLocaleString("en-IN")} />
                  <Bar dataKey="average_price" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="grid gap-5 xl:grid-cols-2">
              <TablePanel title="User management">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Predictions</th>
                      <th className="px-4 py-3">Avg price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.users.map((item) => (
                      <tr className="border-t border-zinc-100" key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold">{item.name}</p>
                          <p className="text-xs text-zinc-500">{item.email}</p>
                        </td>
                        <td className="px-4 py-3">{item.prediction_count}</td>
                        <td className="px-4 py-3">Rs. {Number(item.average_price).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3"><Status label={item.status || "active"} /></td>
                        <td className="px-4 py-3">
                          <button className="rounded-md border border-zinc-300 px-3 py-1 font-semibold hover:bg-zinc-100" onClick={() => updateUser(item.id, item.status === "blocked" ? "active" : "blocked")} type="button">
                            {item.status === "blocked" ? "Unblock" : "Block"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TablePanel>

              <TablePanel title="Listing approval workflow">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-600">
                    <tr>
                      <th className="px-4 py-3">Listing</th>
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.listings.map((item) => (
                      <tr className="border-t border-zinc-100" key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-bold">{item.title}</p>
                          <p className="text-xs text-zinc-500">{item.city} / {item.fuel} / score {item.inspection_score}</p>
                        </td>
                        <td className="px-4 py-3">{item.email}</td>
                        <td className="px-4 py-3 font-bold text-teal-700">Rs. {Number(item.price).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3"><Status label={item.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button className="rounded-md border border-teal-200 px-3 py-1 font-semibold text-teal-800 hover:bg-teal-50" onClick={() => updateListing(item.id, "approved")} type="button">Approve</button>
                            <button className="rounded-md border border-red-200 px-3 py-1 font-semibold text-red-700 hover:bg-red-50" onClick={() => updateListing(item.id, "blocked")} type="button">Block</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!summary.listings.length && <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan="5">No listings yet.</td></tr>}
                  </tbody>
                </table>
              </TablePanel>
            </div>

            <TablePanel title="Recent platform predictions">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-zinc-100 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Car</th>
                    <th className="px-4 py-3">KM</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_predictions.map((item) => (
                    <tr className="border-t border-zinc-100" key={item.id}>
                      <td className="px-4 py-3">{item.email || "legacy"}</td>
                      <td className="px-4 py-3">{item.year} {item.company || "-"}</td>
                      <td className="px-4 py-3">{Number(item.km).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-bold text-teal-700">Rs. {Number(item.predicted_price).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">{new Date(item.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablePanel>
          </div>
        )}
      </section>
    </main>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 font-bold">{title}</h2>
      <div className="h-80">{children}</div>
    </div>
  );
}

function TablePanel({ title, children }) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-4">
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const tones = {
    teal: "border-teal-200 bg-teal-50",
    emerald: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    zinc: "border-zinc-200 bg-white",
  };
  return (
    <div className={`rounded-md border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-semibold text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Status({ label }) {
  const styles = {
    active: "bg-teal-100 text-teal-800",
    approved: "bg-teal-100 text-teal-800",
    pending: "bg-amber-100 text-amber-800",
    blocked: "bg-red-100 text-red-800",
    sold: "bg-zinc-200 text-zinc-800",
  };
  return <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${styles[label] || styles.active}`}>{label}</span>;
}

export default AdminDashboard;
