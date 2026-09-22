import { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Calendar,
  Camera,
  Download,
  Eye,
  AlertCircle,
} from "lucide-react";
import { voteComplaint, resolveImageUrl, getDownloadUrl } from "../api";

export default function ComplaintCard({
  complaint,
  onVoteSuccess,
  onAddEvidenceClick,
  onViewDetailsClick,
  isDuplicateMatch = false,
}) {
  const [c, setComplaint] = useState(complaint);
  const [voting, setVoting] = useState(false);

  const handleVote = async (voteType) => {
    if (voting) return;
    setVoting(true);
    try {
      const res = await voteComplaint(c.id, voteType);
      const updated = {
        ...c,
        upvotes: res.upvotes,
        downvotes: res.downvotes,
        priority_score: res.priority_score,
        priority_level: res.priority_level,
        user_vote: res.user_vote,
      };
      setComplaint(updated);
      if (onVoteSuccess) onVoteSuccess(updated);
    } catch (err) {
      console.error("Voting failed:", err);
    } finally {
      setVoting(false);
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

  const formatDate = (dt) => {
    if (!dt) return "";
    try {
      const d = new Date(dt);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(dt).substring(0, 10);
    }
  };

  const imageUrl = resolveImageUrl(c.annotated_image_url || c.image_url);

  return (
    <div className="complaint-card">
      <div className="complaint-card-media">
        <img
          src={
            imageUrl ||
            "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&q=80"
          }
          alt={c.damage_type}
          onError={(e) => {
            e.target.src =
              "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&q=80";
          }}
        />
        <div className="complaint-badge-overlay">
          <span
            className={`badge-priority ${getPriorityClass(c.priority_level)}`}
          >
            {c.priority_level}
          </span>
          <span className={`badge-status ${getStatusClass(c.status)}`}>
            {c.status}
          </span>
        </div>
        <div className="complaint-score-overlay">
          Score: {c.priority_score?.toFixed(1) || "0.0"}
        </div>
      </div>

      <div className="complaint-card-body">
        <div className="complaint-header-row">
          <span className="complaint-code">{c.complaint_code}</span>
          <div className="complaint-date">
            <Calendar size={13} style={{ display: "inline", marginRight: 4 }} />
            {formatDate(c.created_at)}
          </div>
        </div>

        <h3 className="complaint-damage-title">{c.damage_type}</h3>

        <div className="complaint-location-row">
          <MapPin size={15} style={{ flexShrink: 0 }} />
          <span>{c.location}</span>
        </div>

        {c.description && (
          <p className="complaint-desc-text">{c.description}</p>
        )}

        {isDuplicateMatch && (
          <div style={{ marginTop: 4 }}>
            <span className="similarity-pill">
              <AlertCircle size={13} />
              {c.similarity_score}% Similar Match
            </span>
            {c.match_reasons && (
              <div
                style={{ fontSize: "0.76rem", color: "#64748b", marginTop: 4 }}
              >
                {c.match_reasons.join(" • ")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="complaint-card-footer">
        <div className="vote-buttons-container">
          <button
            className={`vote-action-btn ${c.user_vote === "upvote" ? "active-up" : ""}`}
            onClick={() => handleVote("upvote")}
            disabled={voting}
            title="Upvote (increases urgency & priority)"
          >
            <ThumbsUp size={14} />
            <span>{c.upvotes || 0}</span>
          </button>
          <button
            className={`vote-action-btn ${c.user_vote === "downvote" ? "active-down" : ""}`}
            onClick={() => handleVote("downvote")}
            disabled={voting}
            title="Downvote"
          >
            <ThumbsDown size={14} />
            <span>{c.downvotes || 0}</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {onAddEvidenceClick && (
            <button
              className="card-action-btn"
              onClick={() => onAddEvidenceClick(c)}
              title="Upload supporting evidence"
            >
              <Camera size={14} />
              <span>Evidence ({c.evidence_count || 0})</span>
            </button>
          )}

          {onViewDetailsClick && (
            <button
              className="card-action-btn"
              onClick={() => onViewDetailsClick(c)}
              title="View full complaint details"
            >
              <Eye size={14} />
            </button>
          )}

          <a
            href={getDownloadUrl(c.id)}
            download
            className="card-action-btn"
            title="Download report"
          >
            <Download size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
