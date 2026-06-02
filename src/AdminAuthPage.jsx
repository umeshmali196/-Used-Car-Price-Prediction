import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";

function AdminAuthPage({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { adminLogin, adminSignup, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        await adminSignup(form);
      } else {
        await adminLogin({ email: form.email, password: form.password });
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Admin authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-10 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_0.9fr]">
        <section>
          <p className="mb-3 text-sm font-semibold uppercase text-teal-700">
            Separate admin access
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">
            Manage users, listings, reports, and platform analytics from a dedicated admin login.
          </h1>
          <p className="mt-5 max-w-xl text-base text-zinc-600">
            Admin accounts use a separate login screen and are marked as admin in the database.
          </p>
          <Link className="mt-6 inline-flex rounded-md border border-zinc-300 px-4 py-2 font-bold hover:bg-white" to="/login">
            User login
          </Link>
        </section>

        <section className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">
            {isSignup ? "Create admin account" : "Admin login"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isSignup ? "Create a separate admin email and password." : "Use your admin email and password."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="block">
                <span className="text-sm font-semibold text-zinc-700">Admin name</span>
                <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" name="name" onChange={handleChange} placeholder="Admin name" type="text" value={form.name} />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-zinc-700">Admin email</span>
              <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" name="email" onChange={handleChange} placeholder="admin@example.com" type="email" value={form.email} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-zinc-700">Admin password</span>
              <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" name="password" onChange={handleChange} placeholder="Minimum 6 characters" type="password" value={form.password} />
            </label>

            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-bold text-white hover:bg-teal-800 disabled:bg-teal-300" disabled={loading} type="submit">
              {loading ? "Please wait..." : isSignup ? "Create admin" : "Login as admin"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-600">
            {isSignup ? "Already created admin?" : "Need a separate admin account?"}{" "}
            <Link className="font-bold text-teal-700 hover:text-teal-900" to={isSignup ? "/admin-login" : "/admin-signup"}>
              {isSignup ? "Admin login" : "Create admin"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default AdminAuthPage;
