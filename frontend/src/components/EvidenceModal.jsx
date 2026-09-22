import { useState } from "react";
import { X, CheckCircle2, AlertCircle, Camera } from "lucide-react";
import { uploadEvidence } from "../api";

export default function EvidenceModal({ complaint, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [description, setDescription] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!complaint) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WEBP).");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Image file size must be less than 10MB.");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a supporting photo to upload.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await uploadEvidence(
        complaint.id,
        file,
        description.trim(),
        userName.trim() || "Citizen Contributor",
      );
      setSuccessMsg(
        "Evidence attached successfully! Complaint priority updated (+10 pts).",
      );
      setTimeout(() => {
        if (onSuccess) onSuccess(res);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to upload supporting evidence.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h3>Add Supporting Evidence</h3>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Complaint:{" "}
              <strong style={{ color: "#4f6df5" }}>
                {complaint.complaint_code}
              </strong>{" "}
              ({complaint.damage_type})
            </span>
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body-area">
            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  padding: "10px 14px",
                  borderRadius: "10px",
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

            {successMsg && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#10b981",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                Supporting Photo (Required)
              </label>

              {preview ? (
                <div
                  style={{
                    position: "relative",
                    borderRadius: "12px",
                    overflow: "hidden",
                    height: "200px",
                  }}
                >
                  <img
                    src={preview}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                    }}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      padding: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="evidence-dropzone">
                  <Camera size={28} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                    Click to select photo or take picture
                  </span>
                  <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                    JPG, PNG or WEBP (Max 10MB)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Your Name / Organization (Optional)
              </label>
              <input
                type="text"
                className="civic-input"
                placeholder="Enter your name (optional)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "0 14px",
                  borderRadius: "10px",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Observations / Details
              </label>
              <textarea
                className="civic-input"
                placeholder="e.g. Additional photo showing pothole widening after rains, creating traffic bottleneck."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  height: "auto",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <div className="modal-footer-row">
            <button
              type="button"
              className="card-action-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={loading || !file}
              style={{ minHeight: "42px", padding: "0 18px" }}
            >
              {loading ? "Uploading Evidence..." : "Submit Evidence (+10 pts)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
