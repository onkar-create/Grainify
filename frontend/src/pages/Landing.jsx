import { Link } from "react-router-dom";

const OBJECTIVES = [
  { icon: "\u{1F4C8}", title: "Forecast demand", text: "Predict regional food-grain demand and shortage risk using AI models trained on climate and consumption data." },
  { icon: "\u{1F5FA}", title: "Model the network", text: "Model the warehouse-to-ration-shop supply chain as a network flow problem to compute optimal allocation." },
  { icon: "\u{1F4B0}", title: "Minimize cost", text: "Minimize total transportation cost and delivery time while maximizing satisfied demand under supply constraints." },
  { icon: "⚖️", title: "Ensure equity", text: "Guarantee a minimum service level for every district so no region is disproportionately underserved during scarcity." },
];

const STEPS = [
  { title: "Forecast", text: "A CatBoost model predicts district-wise grain demand from rainfall anomaly, mandi arrivals, price, and population." },
  { title: "Optimize", text: "A Min-Cost Max-Flow network (NetworkX) allocates warehouse stock to districts, minimizing cost while guaranteeing equity." },
  { title: "Visualize", text: "Compare the optimized allocation against a conventional proportional baseline on cost and unmet demand." },
];

const TECH = ["Python", "CatBoost", "NetworkX", "FastAPI", "SQLite", "React", "Recharts"];

const TEAM = [
  { name: "Onkar Gajulwar", role: "Team Member" },
  { name: "Shravani Dhuri", role: "Team Member" },
  { name: "Arya Parmar", role: "Team Member" },
  { name: "Prof. Deepali Chavan", role: "Project Guide" },
];

export default function Landing() {
  return (
    <div>
      <section className="hero">
        <div className="badge">AI &middot; Operations Research &middot; Data Science</div>
        <h1 style={{ marginTop: 16 }}>Grainify</h1>
        <p className="tagline">
          An AI-assisted decision support system for optimizing food grain distribution through
          India's Public Distribution System (PDS) during El Ni&ntilde;o-induced scarcity.
        </p>
        <div className="hero-actions">
          <Link to="/dashboard" className="btn btn-primary">Try the Dashboard</Link>
          <Link to="/history" className="btn btn-ghost">View Past Runs</Link>
        </div>
      </section>

      <section className="section section-alt">
        <h2>The problem</h2>
        <p className="subtitle">
          El Ni&ntilde;o-driven droughts reduce crop yields, causing acute food grain scarcity
          that conventional PDS allocation methods fail to handle efficiently &mdash; leading to
          localized shortages, distribution delays, and unfair allocation across regions.
        </p>
      </section>

      <section className="section">
        <h2>Key objectives</h2>
        <p className="subtitle">A predictive, optimization-based system to allocate limited grain stocks intelligently.</p>
        <div className="grid grid-4">
          {OBJECTIVES.map((o) => (
            <div className="card feature-card" key={o.title}>
              <div className="icon">{o.icon}</div>
              <h3>{o.title}</h3>
              <p>{o.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <h2>How it works</h2>
        <p className="subtitle">From raw data to an actionable allocation plan in three steps.</p>
        <div className="grid grid-3">
          {STEPS.map((s, i) => (
            <div className="card step-card" key={s.title}>
              <div className="step-number">{i + 1}</div>
              <h3>{s.title}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Tech stack</h2>
        <div className="tech-badges">
          {TECH.map((t) => (
            <span className="badge" key={t}>{t}</span>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <h2>Team</h2>
        <p className="subtitle">Department of Artificial Intelligence and Data Science, K. J. Somaiya Institute of Technology</p>
        <div className="grid grid-4">
          {TEAM.map((m) => (
            <div className="card team-card" key={m.name}>
              <div className="team-avatar">{m.name.charAt(0)}</div>
              <h3>{m.name}</h3>
              <p>{m.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="cta-banner">
          <h2>See it in action</h2>
          <p style={{ marginBottom: 24, opacity: 0.9 }}>
            Run an El Ni&ntilde;o drought scenario and compare optimized vs. conventional grain allocation.
          </p>
          <Link to="/dashboard" className="btn btn-primary">Open Dashboard</Link>
        </div>
      </section>
    </div>
  );
}
