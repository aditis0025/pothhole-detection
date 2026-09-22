import { useEffect, useState } from "react";
import {
  X,
  MapPin,
  ThumbsUp,
  ThumbsDown,
  Camera,
  History,
  Download,
} from "lucide-react";
import { getComplaintDetails, resolveImageUrl, getDownloadUrl } from "../api";

export default function ComplaintDetailsModal({
  complaintId,
  onClose,
  onAddEvidence,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complaintId) return;
    let active = true;
    getComplaintDetails(complaintId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => console.error("Error loading details:", err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [complaintId]);

  if (!complaintId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-card"
        style={{ maxWidth: "760px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-row">
          <div>
            <h3>Complaint Details & Evidence</h3>
            {data && (
              <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Case Code:{" "}
                <strong style={{ color: "#4f6df5" }}>
                  {data.complaint_code}
                </strong>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body-area">
          {loading ? (
            <div
              style={{ padding: "40px", textAlign: "center", color: "#64748b" }}
            >
              <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
              Loading complaint history & evidence...
            </div>
          ) : !data ? (
            <div
              style={{ padding: "30px", textAlign: "center", color: "#ef4444" }}
            >
              Unable to load complaint details.
            </div>
          ) : (
            <>
              {/* Media Comparison */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Primary Image
                  </span>
                  <div
                    style={{
                      height: "180px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      marginTop: "6px",
                      background: "#0f172a",
                    }}
                  >
                    <img
                      src={resolveImageUrl(data.image_url)}
                      alt="Primary"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    AI Detection Overlay
                  </span>
                  <div
                    style={{
                      height: "180px",
                      borderRadius: "12px",
                      overflow: "hidden",
                      marginTop: "6px",
                      background: "#0f172a",
                    }}
                  >
                    <img
                      src={resolveImageUrl(
                        data.annotated_image_url || data.image_url,
                      )}
                      alt="AI Detection"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Status & Priority Overview */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "12px",
                  padding: "16px",
                  background: "rgba(79, 109, 245, 0.05)",
                  borderRadius: "14px",
                  border: "1px solid rgba(79, 109, 245, 0.15)",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Damage Type
                  </span>
                  <strong
                    style={{
                      display: "block",
                      textTransform: "capitalize",
                      fontSize: "0.95rem",
                    }}
                  >
                    {data.damage_type}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Priority Level
                  </span>
                  <strong
                    style={{
                      display: "block",
                      color: "#4f6df5",
                      fontSize: "0.95rem",
                    }}
                  >
                    {data.priority_level} ({data.priority_score?.toFixed(1)})
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </span>
                  <strong style={{ display: "block", fontSize: "0.95rem" }}>
                    {data.status}
                  </strong>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                    }}
                  >
                    Citizen Votes
                  </span>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "2px",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    <span
                      style={{
                        color: "#10b981",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <ThumbsUp size={13} /> {data.upvotes}
                    </span>
                    <span
                      style={{
                        color: "#ef4444",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <ThumbsDown size={13} /> {data.downvotes}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location & Description */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#64748b",
                    fontSize: "0.88rem",
                  }}
                >
                  <MapPin size={16} />
                  <strong>Location:</strong>
                  <span>{data.location}</span>
                </div>
                {data.description && (
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: "0.9rem",
                      color: "#475569",
                      lineHeight: 1.5,
                    }}
                  >
                    {data.description}
                  </p>
                )}
              </div>

              {/* Supporting Evidence Section */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Camera size={18} style={{ color: "#4f6df5" }} />
                    Supporting Citizen Evidence ({data.evidence?.length || 0})
                  </h4>
                  {onAddEvidence && (
                    <button
                      className="card-action-btn"
                      onClick={() => onAddEvidence(data)}
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                    >
                      + Add Photo
                    </button>
                  )}
                </div>

                {data.evidence?.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      background: "rgba(0,0,0,0.02)",
                      borderRadius: "12px",
                      color: "#94a3b8",
                      fontSize: "0.86rem",
                    }}
                  >
                    No secondary evidence submitted yet. Citizens can attach
                    photos to substantiate damage.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {data.evidence.map((ev) => (
                      <div key={ev.id} className="evidence-item-card">
                        <div style={{ height: "120px", background: "#0f172a" }}>
                          <img
                            src={resolveImageUrl(ev.image_url)}
                            alt="Evidence"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                        <div style={{ padding: "10px", fontSize: "0.8rem" }}>
                          <strong>{ev.user_name}</strong>
                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "#64748b",
                              fontSize: "0.76rem",
                            }}
                          >
                            {ev.description ||
                              "Corroborating road damage photo"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Trail / History */}
              <div>
                <h4
                  style={{
                    margin: "0 0 8px",
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <History size={18} style={{ color: "#4f6df5" }} />
                  Audit Trail & History
                </h4>
                <div className="audit-timeline">
                  {data.history?.map((h, i) => (
                    <div key={i} className="audit-item">
                      <div className="audit-bullet"></div>
                      <div className="audit-content">
                        <strong>
                          {h.action} — <span>{h.performed_by}</span>
                        </strong>
                        <span>{h.timestamp}</span>
                        <p>{h.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer-row">
          {data && (
            <a
              href={getDownloadUrl(data.id)}
              download
              className="card-action-btn"
              style={{ marginRight: "auto" }}
            >
              <Download size={15} />
              Download Official JSON Report
            </a>
          )}
          <button type="button" className="card-action-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
