import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";

function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { isAuthenticated, login, signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
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
        await signup(form);
      } else {
        await login({ email: form.email, password: form.password });
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
        <section>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Car price intelligence
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
            Predict car resale value and keep every estimate in your private dashboard.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-600">
            Your predictions are saved account-wise, so every user sees only their own history,
            trends, and summary metrics.
          </p>
          <Link
            className="mt-6 inline-flex rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-white"
            to="/admin-login"
          >
            Admin login
          </Link>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-950">
            {isSignup ? "Create account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isSignup ? "Start with a secure account." : "Login to access your dashboard."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  name="name"
                  onChange={handleChange}
                  placeholder="Your name"
                  type="text"
                  value={form.name}
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                name="email"
                onChange={handleChange}
                placeholder="you@example.com"
                type="email"
                value={form.email}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                name="password"
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                type="password"
                value={form.password}
              />
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              className="w-full rounded-md bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
              disabled={loading}
              type="submit"
            >
              {loading ? "Please wait..." : isSignup ? "Sign up" : "Login"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <Link
              className="font-semibold text-blue-700 hover:text-blue-900"
              to={isSignup ? "/login" : "/signup"}
            >
              {isSignup ? "Login" : "Create account"}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export default AuthPage;
