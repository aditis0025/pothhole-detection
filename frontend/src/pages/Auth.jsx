import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { apiLogin, apiRegister, setAuthSession } from "../api";

export default function Auth({
  selectedRole = "user",
  onChangeRole,
  onAuthSuccess,
  onBackToPortal,
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeRole = selectedRole === "admin" ? "admin" : "user";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await apiRegister(email, fullName, password, activeRole);
      } else {
        res = await apiLogin(email, password, activeRole);
      }
      setAuthSession(res.access_token, res.user);
      if (onAuthSuccess) onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Back link to Portal selection */}
        {onBackToPortal && (
          <button
            type="button"
            className="card-action-btn"
            onClick={onBackToPortal}
            style={{
              marginBottom: "18px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ArrowLeft size={15} />
            Back to Portal Selection
          </button>
        )}

        {/* Role Selector Tabs (User vs Admin) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "22px",
            padding: "4px",
            borderRadius: "12px",
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setError("");
              if (onChangeRole) onChangeRole("user");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 12px",
              borderRadius: "9px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem",
              background:
                activeRole === "user"
                  ? "linear-gradient(135deg, #4f6df5, #7c3aed)"
                  : "transparent",
              color: activeRole === "user" ? "#ffffff" : "inherit",
            }}
          >
            <User size={16} />
            User Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              if (onChangeRole) onChangeRole("admin");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 12px",
              borderRadius: "9px",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem",
              background:
                activeRole === "admin"
                  ? "linear-gradient(135deg, #ef4444, #7c3aed)"
                  : "transparent",
              color: activeRole === "admin" ? "#ffffff" : "inherit",
            }}
          >
            <ShieldAlert size={16} />
            Admin Portal
          </button>
        </div>

        {/* Logo */}
        <div
          className="auth-logo"
          style={
            activeRole === "admin"
              ? { background: "linear-gradient(135deg, #ef4444, #7c3aed)" }
              : undefined
          }
        >
          {activeRole === "admin" ? (
            <ShieldAlert size={34} strokeWidth={2} />
          ) : (
            <ShieldCheck size={34} strokeWidth={2} />
          )}
        </div>

        {/* Heading */}
        <div className="auth-heading">
          <h1>
            {activeRole === "admin" ? (
              <>
                Admin <span>{isRegister ? "Registration" : "Login"}</span>
              </>
            ) : (
              <>
                Citizen <span>{isRegister ? "Registration" : "Login"}</span>
              </>
            )}
          </h1>
          <p>
            {activeRole === "admin"
              ? isRegister
                ? "Register an authorized Municipal Administrator account."
                : "Sign in to the Municipal Admin Dashboard to manage complaints."
              : isRegister
                ? "Register a Citizen User account to detect road damage and file complaints."
                : "Sign in to the Citizen User Dashboard to detect road damage and track history."}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#ef4444",
              padding: "10px 14px",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="auth-field">
              <label>Full Name</label>
              <div className="auth-input-wrapper">
                <User size={18} />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isRegister}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="auth-field">
            <label>Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={18} />
              <input
                type="email"
                placeholder="name@civicaegis.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="auth-field">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          {isRegister && (
            <div className="auth-field">
              <label>Confirm Password</label>
              <div className="auth-input-wrapper">
                <Lock size={18} />
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isRegister}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              "Authenticating..."
            ) : (
              <>
                {isRegister ? "Create Account" : "Sign In"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Switch Login / Register */}
        <div className="auth-switch">
          {isRegister ? (
            <>
              Already have an account?
              <button type="button" onClick={() => setIsRegister(false)}>
                Sign In
              </button>
            </>
          ) : (
            <>
              Don't have an account?
              <button type="button" onClick={() => setIsRegister(true)}>
                Register Here
              </button>
            </>
          )}
        </div>

        <div className="auth-security">
          <ShieldCheck size={15} />
          Secure Civic-Aegis access
        </div>
      </div>
    </div>
  );
}
