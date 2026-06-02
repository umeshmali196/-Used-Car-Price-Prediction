import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "./api";
import { useAuth } from "./auth";

const brands = ["Maruti", "Hyundai", "Honda", "Tata", "Mahindra", "Toyota", "Kia"];
const cities = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Pune", "Ahmedabad"];
const fuels = ["Petrol", "Diesel", "CNG", "Electric"];
const bodyTypes = ["Hatchback", "Sedan", "SUV", "MUV", "Compact SUV"];

const initialForm = {
  year: "",
  km: "",
  brand: "Maruti",
  company: "Maruti",
  model_name: "Swift",
  variant: "VXI",
  fuel: "Petrol",
  transmission: "Manual",
  owner_type: "First",
  ownership_count: 1,
  city: "Delhi",
  location: "Delhi",
  accident_history: "None",
  service_history: "Complete",
  insurance_status: "Active",
  color: "White",
  body_type: "Hatchback",
  registration_state: "DL",
  mileage: "",
  engine: "",
  power: "",
  engine_condition: "Good",
  tyre_condition: "Good",
  documents_verified: "Yes",
  accident_signs: "No",
  service_records: "Available",
};

const ownerMap = { First: 1, Second: 2, Third: 3, "Fourth+": 4 };

function Dashboard() {
  const { logout, user } = useAuth();
  const [activeView, setActiveView] = useState("valuation");
  const [form, setForm] = useState(initialForm);
  const [history, setHistory] = useState([]);
  const [listings, setListings] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [filters, setFilters] = useState({ year: "", price: "", city: "", brand: "", fuel: "" });
  const [listingForm, setListingForm] = useState({
    title: "",
    price: "",
    description: "",
  });
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("favorites") || "[]"));
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    const { data } = await api.get("/history");
    setHistory(data);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [historyRes, listingsRes, modelRes] = await Promise.all([
          api.get("/history"),
          api.get("/listings"),
          api.get("/model-info"),
        ]);
        if (!isMounted) return;
        setHistory(historyRes.data);
        setListings(listingsRes.data);
        setModelInfo(modelRes.data);
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Unable to load dashboard data.");
        }
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadListings() {
      try {
        const { data } = await api.get("/listings", {
          params: {
            brand: filters.brand || undefined,
            city: filters.city || undefined,
            fuel: filters.fuel || undefined,
            max_price: filters.price || undefined,
          },
        });
        if (isMounted) setListings(data);
      } catch {
        if (isMounted) setListings([]);
      }
    }

    loadListings();
    return () => {
      isMounted = false;
    };
  }, [filters.brand, filters.city, filters.fuel, filters.price]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "brand" ? { company: value } : {}),
      ...(name === "city" ? { location: value } : {}),
      ...(name === "owner_type" ? { ownership_count: ownerMap[value] || 1 } : {}),
    }));
  };

  const handlePhotoChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 4);
    setPhotos(files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
  };

  const handlePredict = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/predict", form);
      setPrediction(data);
      setListingForm((current) => ({
        ...current,
        title: `${data.year} ${data.brand} ${data.model_name} ${data.variant}`,
        price: Math.round(data.predicted_price),
      }));
      await fetchHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const createListing = async () => {
    if (!prediction) {
      setError("Run a valuation before creating a listing.");
      return;
    }

    const payload = {
      ...prediction,
      title: listingForm.title,
      price: listingForm.price || prediction.predicted_price,
      description: listingForm.description,
    };
    const { data } = await api.post("/listings", payload);
    setListings((items) => [data, ...items]);
    setActiveView("marketplace");
  };

  const deletePrediction = async (id) => {
    await api.delete(`/history/${id}`);
    setHistory((items) => items.filter((item) => item.id !== id));
  };

  const exportCsv = async () => {
    const { data } = await api.get("/history/export", { responseType: "blob" });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "valuation_history.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleFavorite = (id) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("favorites", JSON.stringify(next));
  };

  const filteredHistory = useMemo(() => {
    return history
      .filter((item) => {
        const yearMatch = !filters.year || Number(item.year) === Number(filters.year);
        const priceMatch = !filters.price || Number(item.predicted_price) >= Number(filters.price);
        const cityMatch = !filters.city || (item.city || item.location) === filters.city;
        const brandMatch = !filters.brand || (item.brand || item.company) === filters.brand;
        const fuelMatch = !filters.fuel || item.fuel === filters.fuel;
        return yearMatch && priceMatch && cityMatch && brandMatch && fuelMatch;
      })
      .sort((a, b) => a.year - b.year);
  }, [filters, history]);

  const prices = filteredHistory.map((item) => Number(item.predicted_price));
  const averagePrice = prices.length
    ? Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length)
    : 0;
  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700">AutoValue industrial console</p>
            <h1 className="text-2xl font-bold">Used-car valuation and marketplace</h1>
            <p className="text-sm text-zinc-500">Logged in as {user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.is_admin ? <NavButton label="Admin" onClick={() => (window.location.href = "/admin")} /> : null}
            {["valuation", "marketplace", "reports", "inspection"].map((view) => (
              <NavButton
                active={activeView === view}
                key={view}
                label={view}
                onClick={() => setActiveView(view)}
              />
            ))}
            <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Valuations" value={history.length} sub="Saved to your account" tone="teal" />
        <Metric label="Average price" value={`Rs. ${averagePrice.toLocaleString("en-IN")}`} sub="Filtered history" tone="amber" />
        <Metric label="Listings" value={listings.length} sub={`${favorites.length} saved favorites`} tone="emerald" />
        <Metric
          label="Model MAE"
          value={modelInfo ? `Rs. ${Number(modelInfo.accuracy.mae).toLocaleString("en-IN")}` : "Loading"}
          sub="Retrain with final dataset"
          tone="zinc"
        />
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
        </div>
      )}

      {activeView === "valuation" && (
        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 xl:grid-cols-[430px_1fr]">
          <ValuationForm form={form} onChange={handleChange} onPhotoChange={handlePhotoChange} onSubmit={handlePredict} loading={loading} photos={photos} />
          <div className="space-y-5">
            <ValuationResult prediction={prediction} onList={createListing} listingForm={listingForm} setListingForm={setListingForm} />
            <MarketPanels prediction={prediction} history={history} />
            <HistoryTable data={filteredHistory.slice().reverse()} onDelete={deletePrediction} onExport={exportCsv} filters={filters} setFilters={setFilters} />
          </div>
        </section>
      )}

      {activeView === "marketplace" && (
        <section className="mx-auto max-w-7xl px-4 pb-8">
          <FilterBar filters={filters} setFilters={setFilters} onExport={exportCsv} />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard
                favorite={favorites.includes(listing.id)}
                key={listing.id}
                listing={listing}
                onFavorite={() => toggleFavorite(listing.id)}
              />
            ))}
            {!listings.length && <EmptyState text="No matching marketplace cars yet. Create a listing from your latest valuation." />}
          </div>
        </section>
      )}

      {activeView === "reports" && (
        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 xl:grid-cols-[1fr_380px]">
          <ReportPreview prediction={prediction} history={history} />
          <NotificationPanel />
        </section>
      )}

      {activeView === "inspection" && (
        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 lg:grid-cols-[1fr_380px]">
          <InspectionBoard form={form} onChange={handleChange} />
          <DocumentUpload />
        </section>
      )}
    </main>
  );
}

function ValuationForm({ form, onChange, onPhotoChange, onSubmit, loading, photos }) {
  return (
    <form className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm" onSubmit={onSubmit}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Valuation intake</p>
          <h2 className="text-xl font-bold">Advanced car prediction</h2>
        </div>
        <span className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-bold text-white">Live</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Brand" name="brand" value={form.brand} onChange={onChange} options={brands} />
        <Field label="Model" name="model_name" value={form.model_name} onChange={onChange} />
        <Field label="Variant" name="variant" value={form.variant} onChange={onChange} />
        <Field label="City" name="city" value={form.city} onChange={onChange} options={cities} />
        <Field label="Year" name="year" value={form.year} onChange={onChange} type="number" required />
        <Field label="KM driven" name="km" value={form.km} onChange={onChange} type="number" required />
        <Field label="Fuel" name="fuel" value={form.fuel} onChange={onChange} options={fuels} />
        <Field label="Transmission" name="transmission" value={form.transmission} onChange={onChange} options={["Manual", "Automatic"]} />
        <Field label="Owner type" name="owner_type" value={form.owner_type} onChange={onChange} options={["First", "Second", "Third", "Fourth+"]} />
        <Field label="Insurance" name="insurance_status" value={form.insurance_status} onChange={onChange} options={["Active", "Expired", "Zero Dep", "Third Party"]} />
        <Field label="Accident history" name="accident_history" value={form.accident_history} onChange={onChange} options={["None", "Minor", "Major"]} />
        <Field label="Service history" name="service_history" value={form.service_history} onChange={onChange} options={["Complete", "Partial", "Missing"]} />
        <Field label="Body type" name="body_type" value={form.body_type} onChange={onChange} options={bodyTypes} />
        <Field label="Color" name="color" value={form.color} onChange={onChange} />
        <Field label="Registration state" name="registration_state" value={form.registration_state} onChange={onChange} />
        <Field label="Mileage" name="mileage" value={form.mileage} onChange={onChange} type="number" />
        <Field label="Engine CC" name="engine" value={form.engine} onChange={onChange} type="number" />
        <Field label="Power BHP" name="power" value={form.power} onChange={onChange} type="number" />
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-zinc-700">Car photos</span>
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" multiple onChange={onPhotoChange} type="file" accept="image/*" />
      </label>
      {!!photos.length && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {photos.map((photo) => (
            <img alt={photo.name} className="h-16 w-full rounded-md object-cover" key={photo.url} src={photo.url} />
          ))}
        </div>
      )}

      <button className="mt-5 w-full rounded-md bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 disabled:bg-teal-300" disabled={loading} type="submit">
        {loading ? "Calculating valuation..." : "Calculate fair price"}
      </button>
    </form>
  );
}

function Field({ label, name, value, onChange, options, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
      {options ? (
        <select className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" name={name} onChange={onChange} value={value}>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" name={name} onChange={onChange} required={required} type={type} value={value} />
      )}
    </label>
  );
}

function ValuationResult({ prediction, onList, listingForm, setListingForm }) {
  if (!prediction) {
    return (
      <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-amber-700">Ready for valuation</p>
        <h2 className="mt-1 text-2xl font-bold">Run a prediction to unlock price range, market comparison, listing draft, and PDF report.</h2>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-700">Valuation certificate draft</p>
            <h2 className="text-2xl font-bold">{prediction.year} {prediction.brand} {prediction.model_name}</h2>
            <p className="text-sm text-zinc-500">{prediction.variant} / {prediction.city} / {prediction.fuel}</p>
          </div>
          <Status label={prediction.price_label} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Expected price" value={`Rs. ${Number(prediction.predicted_price).toLocaleString("en-IN")}`} sub="Inspection adjusted" tone="teal" />
          <Metric label="Market price" value={`Rs. ${Number(prediction.market_price).toLocaleString("en-IN")}`} sub="City comparison" tone="amber" />
          <Metric label="Inspection" value={`${prediction.inspection_score}/100`} sub="Checklist score" tone="emerald" />
        </div>
        <div className="mt-4 rounded-md bg-zinc-100 p-4">
          <p className="text-sm font-semibold text-zinc-700">Price range</p>
          <div className="mt-3 h-3 rounded-full bg-zinc-300">
            <div className="h-3 w-2/3 rounded-full bg-teal-700" />
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Rs. {Number(prediction.price_range.low).toLocaleString("en-IN")} to Rs. {Number(prediction.price_range.high).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold">Create sale listing</h3>
        <input className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2" onChange={(e) => setListingForm((c) => ({ ...c, title: e.target.value }))} value={listingForm.title} />
        <input className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2" onChange={(e) => setListingForm((c) => ({ ...c, price: e.target.value }))} type="number" value={listingForm.price} />
        <textarea className="mt-3 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2" onChange={(e) => setListingForm((c) => ({ ...c, description: e.target.value }))} placeholder="Seller notes, repairs, documents, highlights" value={listingForm.description} />
        <button className="mt-3 w-full rounded-md bg-zinc-900 px-4 py-2.5 font-bold text-white hover:bg-zinc-800" onClick={onList} type="button">Publish listing</button>
      </div>
    </div>
  );
}

function MarketPanels({ prediction, history }) {
  const recent = history.slice(0, 6).map((item) => ({
    name: `${item.brand || item.company || "Car"} ${item.year}`,
    price: Math.round(Number(item.predicted_price)),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold">Recent sold-like comparisons</h3>
        <div className="mt-3 h-56">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={recent}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip formatter={(value) => `Rs. ${Number(value).toLocaleString("en-IN")}`} />
              <Bar dataKey="price" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="font-bold">AI suggestions</h3>
        <div className="mt-3 space-y-3">
          {(prediction?.suggestions || [
            "Keep insurance active before listing to improve trust.",
            "Upload RC, PUC, service records, and clear car photos.",
            "Use fair price labels to detect overpricing or underpricing.",
          ]).map((tip) => (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700" key={tip}>{tip}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryTable({ data, onDelete, onExport, filters, setFilters }) {
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-bold">Valuation history</h2>
          <FilterBar filters={filters} setFilters={setFilters} onExport={onExport} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-600">
            <tr>
              <th className="px-4 py-3">Car</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3">KM</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr className="border-t border-zinc-100" key={item.id}>
                <td className="px-4 py-3 font-semibold">{item.year} {item.brand || item.company} {item.model_name || ""}</td>
                <td className="px-4 py-3">{item.city || item.location}</td>
                <td className="px-4 py-3">{item.fuel}</td>
                <td className="px-4 py-3">{Number(item.km).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">{item.inspection_score || "-"}</td>
                <td className="px-4 py-3"><Status label={item.price_label || "Fair"} /></td>
                <td className="px-4 py-3 font-bold text-teal-700">Rs. {Number(item.predicted_price).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3"><button className="rounded-md border border-red-200 px-3 py-1 font-semibold text-red-700 hover:bg-red-50" onClick={() => onDelete(item.id)} type="button">Delete</button></td>
              </tr>
            ))}
            {!data.length && <tr><td className="px-4 py-8 text-center text-zinc-500" colSpan="9">No valuations found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters, onExport }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:flex">
      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))} value={filters.brand}>
        <option value="">All brands</option>
        {brands.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} value={filters.city}>
        <option value="">All cities</option>
        {cities.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" onChange={(e) => setFilters((f) => ({ ...f, fuel: e.target.value }))} value={filters.fuel}>
        <option value="">All fuels</option>
        {fuels.map((item) => <option key={item}>{item}</option>)}
      </select>
      <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" onChange={(e) => setFilters((f) => ({ ...f, price: e.target.value }))} placeholder="Min/max price" type="number" value={filters.price} />
      <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-bold text-white" onClick={onExport} type="button">CSV</button>
    </div>
  );
}

function ListingCard({ listing, favorite, onFavorite }) {
  return (
    <article className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="flex h-36 items-end justify-between bg-[linear-gradient(135deg,#f4f4f5,#ccfbf1)] p-4">
        <div>
          <p className="text-xs font-bold uppercase text-teal-800">{listing.city} / {listing.fuel}</p>
          <h3 className="text-xl font-bold">{listing.title}</h3>
        </div>
        <button className="rounded-md bg-white px-3 py-2 text-sm font-bold shadow-sm" onClick={onFavorite} type="button">{favorite ? "Saved" : "Save"}</button>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-2xl font-bold">Rs. {Number(listing.price).toLocaleString("en-IN")}</p>
          <Status label={listing.price_label || "Fair"} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Mini label="Year" value={listing.year} />
          <Mini label="KM" value={Number(listing.km).toLocaleString("en-IN")} />
          <Mini label="Score" value={listing.inspection_score || 82} />
        </div>
        <p className="mt-4 text-sm text-zinc-600">{listing.description}</p>
        <button className="mt-4 w-full rounded-md border border-zinc-300 px-4 py-2 font-bold hover:bg-zinc-100" type="button">Contact seller</button>
      </div>
    </article>
  );
}

function ReportPreview({ prediction, history }) {
  const latest = prediction || history[0];
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">PDF valuation certificate</p>
          <h2 className="text-2xl font-bold">Premium report preview</h2>
        </div>
        <button className="rounded-md bg-zinc-900 px-4 py-2 font-bold text-white" onClick={() => window.print()} type="button">Download PDF</button>
      </div>
      {latest ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Metric label="Vehicle" value={`${latest.year} ${latest.brand || latest.company} ${latest.model_name || ""}`} sub={latest.variant || "Valuation record"} tone="teal" />
          <Metric label="Certificate value" value={`Rs. ${Number(latest.predicted_price).toLocaleString("en-IN")}`} sub={latest.price_label || "Fair"} tone="amber" />
          <Metric label="Market comparison" value={`Rs. ${Number(latest.market_price || latest.predicted_price).toLocaleString("en-IN")}`} sub={latest.city || latest.location} tone="emerald" />
          <Metric label="Depreciation after 1 year" value={`Rs. ${Math.round(Number(latest.predicted_price) * 0.12).toLocaleString("en-IN")}`} sub="Estimated 12%" tone="zinc" />
        </div>
      ) : (
        <EmptyState text="Run a prediction to generate a premium valuation report." />
      )}
    </div>
  );
}

function InspectionBoard({ form, onChange }) {
  const rows = [
    ["Engine condition", "engine_condition", ["Good", "Average", "Poor"]],
    ["Tyre condition", "tyre_condition", ["Good", "Average", "Poor"]],
    ["Documents verified", "documents_verified", ["Yes", "No"]],
    ["Accident signs", "accident_signs", ["No", "Minor", "Major"]],
    ["Service records", "service_records", ["Available", "Unavailable"]],
  ];
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-teal-700">Inspection checklist</p>
      <h2 className="text-2xl font-bold">Value adjustment controls</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map(([label, name, options]) => <Field key={name} label={label} name={name} value={form[name]} onChange={onChange} options={options} />)}
      </div>
    </div>
  );
}

function DocumentUpload() {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold">Document verification</h3>
      {["RC book", "Insurance", "PUC", "Service records"].map((doc) => (
        <label className="mt-4 block rounded-md border border-dashed border-zinc-300 p-4" key={doc}>
          <span className="text-sm font-bold">{doc}</span>
          <input className="mt-2 block w-full text-sm" type="file" />
        </label>
      ))}
    </div>
  );
}

function NotificationPanel() {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold">Notifications</h3>
      {["Email sent after valuation", "Alert when similar cars match", "Admin notified for new listing", "Buyer alert for fair-price cars"].map((item) => (
        <div className="mt-3 rounded-md bg-zinc-100 p-3 text-sm font-medium text-zinc-700" key={item}>{item}</div>
      ))}
    </div>
  );
}

function Metric({ label, value, sub, tone = "zinc" }) {
  const tones = {
    teal: "border-teal-200 bg-teal-50",
    amber: "border-amber-200 bg-amber-50",
    emerald: "border-emerald-200 bg-emerald-50",
    zinc: "border-zinc-200 bg-white",
  };
  return (
    <div className={`rounded-md border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-semibold text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-zinc-500">{sub}</p>
    </div>
  );
}

function Mini({ label, value }) {
  return <div className="rounded-md bg-zinc-100 p-2"><p className="text-xs text-zinc-500">{label}</p><p className="font-bold">{value}</p></div>;
}

function Status({ label }) {
  const styles = {
    Low: "bg-emerald-100 text-emerald-800",
    Fair: "bg-teal-100 text-teal-800",
    High: "bg-amber-100 text-amber-800",
    approved: "bg-teal-100 text-teal-800",
    pending: "bg-amber-100 text-amber-800",
    blocked: "bg-red-100 text-red-800",
  };
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${styles[label] || styles.Fair}`}>{label}</span>;
}

function NavButton({ label, active, onClick }) {
  return (
    <button className={`rounded-md px-4 py-2 text-sm font-bold capitalize ${active ? "bg-teal-700 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-md border border-dashed border-zinc-300 bg-white p-8 text-center font-medium text-zinc-500">{text}</div>;
}

export default Dashboard;
