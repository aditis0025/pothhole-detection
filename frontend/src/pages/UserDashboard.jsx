import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  MapPin,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Flame,
  ArrowLeft,
} from "lucide-react";
import { searchComplaints } from "../api";
import ComplaintCard from "../components/ComplaintCard";
import EvidenceModal from "../components/EvidenceModal";
import ComplaintDetailsModal from "../components/ComplaintDetailsModal";

export default function UserDashboard({ onNavigateToAnalysis }) {
  const [locationQuery, setLocationQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modals
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [detailsTargetId, setDetailsTargetId] = useState(null);

  const fetchComplaints = async (loc = locationQuery) => {
    setLoading(true);
    setError("");
    try {
      const data = await searchComplaints({
        location: loc.trim(),
        status: statusFilter,
        priority: priorityFilter,
        sort: sortBy,
      });
      setComplaints(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    searchComplaints({
      location: locationQuery.trim(),
      status: statusFilter,
      priority: priorityFilter,
      sort: sortBy,
    })
      .then((data) => {
        if (active) setComplaints(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load complaints.");
      });
    return () => {
      active = false;
    };
  }, [locationQuery, statusFilter, priorityFilter, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchComplaints(locationQuery);
  };

  const handleQuickChip = (loc) => {
    const nextLoc = loc === "All Areas" ? "" : loc;
    setLocationQuery(nextLoc);
    fetchComplaints(nextLoc);
  };

  const handleVoteUpdate = (updatedComplaint) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updatedComplaint.id ? updatedComplaint : c)),
    );
  };

  return (
    <div
      className="dashboard-page"
      style={{ padding: "40px 24px", maxWidth: "1240px", margin: "0 auto" }}
    >
      {/* Top Breadcrumb & Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "28px",
        }}
      >
        <button
          className="card-action-btn"
          onClick={onNavigateToAnalysis}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <ArrowLeft size={16} />
          Back to AI Road Inspection
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="badge-status badge-progress">
            <span
              className="status-dot"
              style={{ display: "inline-block" }}
            ></span>
            Community Live Feed
          </span>
        </div>
      </div>

      {/* Location Search Card */}
      <div className="location-search-card">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="brand-logo" style={{ width: "38px", height: "38px" }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>
              Explore Road Complaints by Location
            </h2>
            <span style={{ fontSize: "0.86rem", color: "#64748b" }}>
              Search your neighborhood, upvote critical hazards, or attach
              photographic evidence.
            </span>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit}>
          <div className="location-search-input-group">
            <input
              type="text"
              placeholder="Enter location or area (e.g. Kanpur, Shyam Nagar, Civil Lines)..."
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
            <button
              type="submit"
              className="primary-button"
              style={{ minWidth: "130px" }}
            >
              <Search size={17} />
              Search
            </button>
          </div>
        </form>

        <div className="quick-search-chips">
          <span
            style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}
          >
            Quick Areas:
          </span>
          {[
            "All Areas",
            "Kanpur",
            "Shyam Nagar",
            "Civil Lines",
            "Kakadeo",
            "Mall Road",
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              className={`quick-chip ${
                (chip === "All Areas" && !locationQuery) ||
                locationQuery === chip
                  ? "active"
                  : ""
              }`}
              onClick={() => handleQuickChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "14px",
          marginBottom: "20px",
          padding: "14px 18px",
          background: "rgba(79, 109, 245, 0.04)",
          borderRadius: "14px",
          border: "1px solid rgba(79, 109, 245, 0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.86rem",
            }}
          >
            <Filter size={15} style={{ color: "#4f6df5" }} />
            <span>Status:</span>
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
            </select>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.86rem",
            }}
          >
            <Flame size={15} style={{ color: "#f97316" }} />
            <span>Priority:</span>
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

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.86rem",
            }}
          >
            <ArrowUpDown size={15} />
            <span>Sort by:</span>
            <select
              className="admin-status-dropdown"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority">Priority (High to Low)</option>
              <option value="votes">Most Community Upvotes</option>
              <option value="date">Most Recent First</option>
            </select>
          </div>

          <button
            className="card-action-btn"
            onClick={() => fetchComplaints()}
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? "spinner" : ""} />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            padding: "12px 18px",
            borderRadius: "12px",
            marginBottom: "20px",
          }}
        >
          {error}
        </div>
      )}

      {/* Complaints Grid */}
      {loading ? (
        <div
          style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}
        >
          <div
            className="spinner"
            style={{ margin: "0 auto 14px", width: "32px", height: "32px" }}
          ></div>
          Loading community complaints...
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty-complaints-card">
          <MapPin
            size={42}
            style={{ color: "#94a3b8", margin: "0 auto 12px" }}
          />
          <h3>No complaints found in this area</h3>
          <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.9rem" }}>
            {locationQuery
              ? `No road damage complaints matching "${locationQuery}". Be the first to register one!`
              : "No complaints found with the current filters."}
          </p>
          <button className="primary-button" onClick={onNavigateToAnalysis}>
            Inspect Road & Register Complaint
          </button>
        </div>
      ) : (
        <div className="complaints-grid">
          {complaints.map((c) => (
            <ComplaintCard
              key={c.id}
              complaint={c}
              onVoteSuccess={handleVoteUpdate}
              onAddEvidenceClick={(target) => setEvidenceTarget(target)}
              onViewDetailsClick={(target) => setDetailsTargetId(target.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {evidenceTarget && (
        <EvidenceModal
          complaint={evidenceTarget}
          onClose={() => setEvidenceTarget(null)}
          onSuccess={() => fetchComplaints()}
        />
      )}

      {detailsTargetId && (
        <ComplaintDetailsModal
          complaintId={detailsTargetId}
          onClose={() => setDetailsTargetId(null)}
          onAddEvidence={(c) => {
            setDetailsTargetId(null);
            setEvidenceTarget(c);
          }}
        />
      )}
    </div>
  );
}
