import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  ThumbsUp,
  Search,
  RefreshCw,
  Eye,
  Camera,
  Layers,
  LogOut,
  Flame,
  ArrowRight,
  Download,
  Activity,
  MapPin,
} from "lucide-react";
import {
  getAdminStatistics,
  getAdminComplaints,
  updateComplaintStatus,
  resolveImageUrl,
  getDownloadUrl,
  getStoredUser,
  getAuthToken,
  setAuthSession,
  clearAuthSession,
  apiLogin,
} from "../api";
import ComplaintDetailsModal from "../components/ComplaintDetailsModal";
import EvidenceModal from "../components/EvidenceModal";

export default function AdminDashboard({ onLogout }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getAuthToken());

  // Admin Login State for unauthenticated users
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Dashboard Data
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [inspectTargetId, setInspectTargetId] = useState(null);
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const isAdmin = Boolean(user && user.role === "admin" && token);

  const loadDashboardData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const [statsRes, complaintsRes] = await Promise.all([
        getAdminStatistics(),
        getAdminComplaints({
          status: statusFilter,
          priority: priorityFilter,
          search: searchQuery.trim(),
        }),
      ]);
      setStats(statsRes);
      setComplaints(complaintsRes);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Failed to load admin data. Please verify admin privileges.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.all([
      getAdminStatistics(),
      getAdminComplaints({
        status: statusFilter,
        priority: priorityFilter,
        search: searchQuery.trim(),
      }),
    ])
      .then(([statsRes, complaintsRes]) => {
        if (active) {
          setStats(statsRes);
          setComplaints(complaintsRes);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load admin data.");
        }
      });
    return () => {
      active = false;
    };
  }, [isAdmin, statusFilter, priorityFilter, searchQuery]);

  const handleAdminLogin = async (e) => {
    e?.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await apiLogin(loginEmail, loginPassword);
      if (res.user.role !== "admin") {
        throw new Error(
          "Access denied: This account does not possess municipal admin privileges.",
        );
      }
      setAuthSession(res.access_token, res.user);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err) {
      setLoginError(err.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setToken(null);
    setStats(null);
    setComplaints([]);
    if (onLogout) onLogout();
  };

  const handleStatusChange = async (complaintId, newStatus) => {
    setUpdatingId(complaintId);
    try {
      const updated = await updateComplaintStatus(
        complaintId,
        newStatus,
        `Status updated by administrator (${user?.full_name})`,
      );
      // Update in state
      setComplaints((prev) =>
        prev.map((c) => (c.id === complaintId ? updated : c)),
      );
      // Refresh stats
      const newStats = await getAdminStatistics();
      setStats(newStats);
    } catch (err) {
      alert(err.message || "Status update failed.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getPriorityClass = (level) => {
    switch ((level || "").toLowerCase()) {
      case "critical":
        return "badge-critical";
      case "high":
        return "badge-high";
      case "medium":
        return "badge-medium";
      default:
        return "badge-low";
    }
  };

  const getStatusClass = (status) => {
    switch ((status || "").toLowerCase()) {
      case "in progress":
        return "badge-progress";
      case "under review":
        return "badge-review";
      case "resolved":
        return "badge-resolved";
      case "rejected":
        return "badge-rejected";
      default:
        return "badge-pending";
    }
  };

  // If not logged in as admin, show clean Admin Login Prompt with prefilled Demo credentials
  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div className="auth-card" style={{ maxWidth: "480px" }}>
          <div
            className="auth-logo"
            style={{ background: "linear-gradient(135deg, #ef4444, #7c3aed)" }}
          >
            <ShieldAlert size={36} color="#fff" />
          </div>

          <div className="auth-heading">
            <h1>
              Municipal <span>Admin Portal</span>
            </h1>
            <p>
              Authorized access for road damage inspection and complaint
              prioritization.
            </p>
          </div>

          {loginError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#ef4444",
                padding: "12px",
                borderRadius: "10px",
                marginBottom: "18px",
                fontSize: "0.85rem",
              }}
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="auth-form">
            <div className="auth-field">
              <label>Administrator Email</label>
              <div className="auth-input-wrapper">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@civicaegis.com"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-input-wrapper">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loginLoading}
              style={{
                background: "linear-gradient(135deg, #4f6df5, #7c3aed)",
              }}
            >
              {loginLoading
                ? "Authenticating..."
                : "Sign In to Admin Dashboard"}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Priority queue: Top 4 Critical / High complaints needing immediate municipal response
  const priorityQueue = complaints
    .filter((c) => c.status !== "Resolved" && c.status !== "Rejected")
    .slice(0, 4);

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "40px 24px" }}>
      {/* Admin Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            className="brand-logo"
            style={{
              width: "44px",
              height: "44px",
              background: "linear-gradient(135deg, #ef4444, #7c3aed)",
            }}
          >
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1
              style={{ margin: 0, fontSize: "1.6rem", letterSpacing: "-0.5px" }}
            >
              Civic-Aegis <span>Admin Console</span>
            </h1>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Logged in as: <strong>{user.full_name}</strong> ({user.email})
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            className="card-action-btn"
            onClick={loadDashboardData}
            title="Refresh dashboard"
          >
            <RefreshCw size={16} className={loading ? "spinner" : ""} />
            Refresh
          </button>
          <button
            className="card-action-btn"
            onClick={handleLogout}
            style={{ color: "#ef4444" }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: "20px" }}>
          <span>{error}</span>
        </div>
      )}

      {/* KPI Overview Cards */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(79, 109, 245, 0.12)",
                color: "#4f6df5",
              }}
            >
              <Layers size={22} />
            </div>
            <div className="admin-stat-info">
              <span>Total Complaints</span>
              <strong>{stats.total_complaints}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
              }}
            >
              <Flame size={22} />
            </div>
            <div className="admin-stat-info">
              <span>Critical Priority</span>
              <strong>{stats.critical_priority_complaints}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(245, 158, 11, 0.12)",
                color: "#d97706",
              }}
            >
              <Clock size={22} />
            </div>
            <div className="admin-stat-info">
              <span>Pending Action</span>
              <strong>{stats.pending_complaints}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(59, 130, 246, 0.12)",
                color: "#3b82f6",
              }}
            >
              <Activity size={22} />
            </div>
            <div className="admin-stat-info">
              <span>In Progress</span>
              <strong>{stats.in_progress_complaints}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div className="admin-stat-info">
              <span>Resolved</span>
              <strong>{stats.resolved_complaints}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <div
              className="admin-stat-icon-circle"
              style={{
                background: "rgba(124, 58, 237, 0.12)",
                color: "#7c3aed",
              }}
            >
              <ThumbsUp size={22} />
            </div>
            <div className="admin-stat-info">
              <span>Citizen Votes</span>
              <strong>{stats.total_votes}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Priority Complaints Queue (Critical -> High -> Medium) */}
      <div className="priority-queue-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Flame size={20} style={{ color: "#ef4444" }} />
              Priority Complaints Queue (Requires Urgent Municipal Dispatch)
            </h2>
            <span style={{ fontSize: "0.84rem", color: "#64748b" }}>
              Arranged by dynamic priority score (Severity + Upvotes − Downvotes
              + Evidence + Age).
            </span>
          </div>
        </div>

        <div className="priority-queue-cards">
          {priorityQueue.map((item) => (
            <div
              key={item.id}
              className={`priority-mini-card ${item.priority_level?.toLowerCase()}`}
              onClick={() => setInspectTargetId(item.id)}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="complaint-code">{item.complaint_code}</span>
                <span
                  className={`badge-priority ${getPriorityClass(item.priority_level)}`}
                >
                  {item.priority_level} ({item.priority_score?.toFixed(1)})
                </span>
              </div>
              <strong
                style={{ fontSize: "1.05rem", textTransform: "capitalize" }}
              >
                {item.damage_type}
              </strong>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <MapPin size={13} />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.location}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "4px",
                  fontSize: "0.78rem",
                }}
              >
                <span className={`badge-status ${getStatusClass(item.status)}`}>
                  {item.status}
                </span>
                <span style={{ color: "#4f6df5", fontWeight: 600 }}>
                  Inspect Case →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complaint Management & Filters */}
      <div className="admin-table-container">
        <div className="admin-table-toolbar">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
              All Municipal Complaints
            </h2>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Showing {complaints.length} cases sorted primarily by Priority
              Score
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 12,
                  top: 11,
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                className="civic-input"
                placeholder="Search code, location, damage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadDashboardData()}
                style={{
                  height: "36px",
                  paddingLeft: "34px",
                  paddingRight: "12px",
                  borderRadius: "8px",
                  fontSize: "0.84rem",
                }}
              />
            </div>

            <select
              className="admin-status-dropdown"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select
              className="admin-status-dropdown"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Damage & Photo</th>
                <th>Location</th>
                <th>Date</th>
                <th>Priority</th>
                <th>Votes</th>
                <th>Evidence</th>
                <th>Status (Action)</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#64748b",
                    }}
                  >
                    No complaints match the selected filters.
                  </td>
                </tr>
              ) : (
                complaints.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong className="complaint-code">
                        {c.complaint_code}
                      </strong>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <img
                          src={resolveImageUrl(
                            c.annotated_image_url || c.image_url,
                          )}
                          alt=""
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "8px",
                            objectFit: "cover",
                            background: "#0f172a",
                          }}
                          onError={(e) => {
                            e.target.src =
                              "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=100&q=80";
                          }}
                        />
                        <div>
                          <strong
                            style={{
                              display: "block",
                              textTransform: "capitalize",
                              fontSize: "0.88rem",
                            }}
                          >
                            {c.damage_type}
                          </strong>
                          <span
                            style={{ fontSize: "0.76rem", color: "#64748b" }}
                          >
                            Sev: {c.severity} (
                            {Math.round((c.confidence || 0.8) * 100)}%)
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        maxWidth: "220px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span title={c.location}>{c.location}</span>
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                      {String(c.created_at).substring(0, 10)}
                    </td>
                    <td>
                      <span
                        className={`badge-priority ${getPriorityClass(c.priority_level)}`}
                      >
                        {c.priority_level}
                      </span>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          marginTop: 2,
                        }}
                      >
                        Score: <strong>{c.priority_score?.toFixed(1)}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>
                        +{c.upvotes}
                      </span>
                      <span style={{ color: "#94a3b8", margin: "0 3px" }}>
                        /
                      </span>
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>
                        -{c.downvotes}
                      </span>
                    </td>
                    <td>
                      <button
                        className="card-action-btn"
                        onClick={() => setEvidenceTarget(c)}
                        style={{ padding: "3px 8px", fontSize: "0.76rem" }}
                      >
                        <Camera size={13} />
                        {c.evidence_count || 0}
                      </button>
                    </td>
                    <td>
                      <select
                        className="admin-status-dropdown"
                        value={c.status}
                        disabled={updatingId === c.id}
                        onChange={(e) =>
                          handleStatusChange(c.id, e.target.value)
                        }
                        style={{
                          borderColor:
                            c.status === "Resolved"
                              ? "#10b981"
                              : c.status === "In Progress"
                                ? "#3b82f6"
                                : "#cbd5e1",
                        }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Under Review">Under Review</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="card-action-btn"
                          onClick={() => setInspectTargetId(c.id)}
                          title="Inspect complaint"
                        >
                          <Eye size={15} />
                        </button>
                        <a
                          href={getDownloadUrl(c.id)}
                          download
                          className="card-action-btn"
                          title="Download report"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {inspectTargetId && (
        <ComplaintDetailsModal
          complaintId={inspectTargetId}
          onClose={() => setInspectTargetId(null)}
          onAddEvidence={(c) => {
            setInspectTargetId(null);
            setEvidenceTarget(c);
          }}
        />
      )}

      {evidenceTarget && (
        <EvidenceModal
          complaint={evidenceTarget}
          onClose={() => setEvidenceTarget(null)}
          onSuccess={() => loadDashboardData()}
        />
      )}
    </div>
  );
}
