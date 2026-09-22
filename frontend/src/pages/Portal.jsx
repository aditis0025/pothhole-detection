import { ShieldCheck, User, ArrowRight, ArrowLeft } from "lucide-react";

export default function Portal({ onSelectRole, onBack }) {
  return (
    <div className="portal-page">
      <div className="portal-container">
        {onBack && (
          <button
            className="card-action-btn"
            onClick={onBack}
            style={{
              marginBottom: "24px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ArrowLeft size={15} />
            Back to Home
          </button>
        )}

        {/* Logo */}
        <div className="portal-logo">
          <ShieldCheck size={38} strokeWidth={2} />
        </div>

        {/* Heading */}
        <div className="portal-heading">
          <h1>
            Civic<span>-Aegis</span>
          </h1>
          <p>Road Damage Intelligence & Complaint Platform</p>
        </div>

        {/* Role selection */}
        <div className="portal-cards">
          {/* User */}
          <div className="portal-card" onClick={() => onSelectRole("user")}>
            <div className="portal-icon">
              <User size={30} />
            </div>

            <div className="portal-card-content">
              <h2>Citizen User Portal</h2>
              <p>
                Analyze road images, discover existing complaints by location,
                vote on priority, and submit supporting evidence.
              </p>
            </div>

            <button
              className="portal-button"
              onClick={() => onSelectRole("user")}
            >
              Continue to User Portal
              <ArrowRight size={17} />
            </button>
          </div>

          {/* Admin */}
          <div className="portal-card" onClick={() => onSelectRole("admin")}>
            <div className="portal-icon admin-icon">
              <ShieldCheck size={30} />
            </div>

            <div className="portal-card-content">
              <h2>Municipal Admin Dashboard</h2>
              <p>
                Access real-time damage statistics, inspect prioritized
                complaint queue, update repair statuses, and verify photo
                evidence.
              </p>
            </div>

            <button
              className="portal-button"
              onClick={() => onSelectRole("admin")}
            >
              Continue to Admin Console
              <ArrowRight size={17} />
            </button>
          </div>
        </div>

        <div className="portal-security">
          <ShieldCheck size={15} />
          Secure Civic-Aegis infrastructure access
        </div>
      </div>
    </div>
  );
}
