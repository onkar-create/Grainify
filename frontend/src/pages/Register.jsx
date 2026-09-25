import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, password, role);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Create your Grainify account</h1>
        <p className="subtitle-left">Choose the role that matches how you'll use the dashboard.</p>

        {error && <div className="error-banner">{error}</div>}

        <label className="field">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoFocus
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        <div className="role-select">
          <label className={`role-option${role === "officer" ? " selected" : ""}`}>
            <input
              type="radio"
              name="role"
              value="officer"
              checked={role === "officer"}
              onChange={() => setRole("officer")}
            />
            <div>
              <strong>Government Officer</strong>
              <p>Can run demand forecasts and optimize grain allocation.</p>
            </div>
          </label>
          <label className={`role-option${role === "viewer" ? " selected" : ""}`}>
            <input
              type="radio"
              name="role"
              value="viewer"
              checked={role === "viewer"}
              onChange={() => setRole("viewer")}
            />
            <div>
              <strong>General Viewer</strong>
              <p>Can view dashboards, district data and past runs (read-only).</p>
            </div>
          </label>
        </div>

        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
