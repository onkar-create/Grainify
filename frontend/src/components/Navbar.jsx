import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  // No manual navigate() here: ProtectedRoute already redirects to /login the
  // moment isAuthenticated flips false, if the current page needs it. Adding a
  // second navigate() in the same tick raced with that and wasn't reliable.
  const handleLogout = () => {
    logout();
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <NavLink to="/" className="brand">
          <span className="brand-mark">G</span>
          Grainify
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Home
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            History
          </NavLink>
        </nav>
        <div className="nav-auth">
          {isAuthenticated ? (
            <>
              <span className="role-badge">
                {user.username} <span className="role-tag">{user.role}</span>
              </span>
              <button className="btn btn-ghost nav-auth-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn btn-primary nav-auth-btn">
              Sign in
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
