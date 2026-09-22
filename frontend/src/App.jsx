import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  CloudUpload,
  FileImage,
  Gauge,
  Image as ImageIcon,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Upload,
  AlertTriangle,
  X,
  Zap,
  CheckCircle2,
  Search,
  User,
  LogOut,
} from "lucide-react";

import "./App.css";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Portal from "./pages/Portal";
import Auth from "./pages/Auth";
import ComplaintCard from "./components/ComplaintCard";
import EvidenceModal from "./components/EvidenceModal";
import ComplaintDetailsModal from "./components/ComplaintDetailsModal";
import {
  checkDuplicateComplaints,
  createComplaint,
  searchComplaints,
  getStoredUser,
  clearAuthSession,
} from "./api";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  // For unauthenticated landing: "portal" (choose User vs Admin) or "auth" (Login / Register form)
  const [authStep, setAuthStep] = useState("portal");
  const [selectedRole, setSelectedRole] = useState("user");
  // For authenticated "user" role: "home" (Analyze + History) | "user" (Location Search Portal)
  const [view, setView] = useState("home");

  // Existing detection state
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashClosing, setSplashClosing] = useState(false);

  // Duplicate Check & Complaint Registration state
  const [complaintLocation, setComplaintLocation] = useState("");
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
  const [similarComplaints, setSimilarComplaints] = useState([]);
  const [registeringComplaint, setRegisteringComplaint] = useState(false);
  const [registeredComplaint, setRegisteredComplaint] = useState(null);

  // Immediate Detection & Complaint History state
  const [historyComplaints, setHistoryComplaints] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modals
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [detailsTargetId, setDetailsTargetId] = useState(null);

  // --------------------------------------------------
  // SPLASH SCREEN (PRESERVED)
  // --------------------------------------------------

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    document.body.classList.toggle("light", !darkMode);
  }, [darkMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashClosing(true);

      setTimeout(() => {
        setShowSplash(false);
      }, 500);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const list = await searchComplaints({ sort: "newest" });
      setHistoryComplaints(list || []);
    } catch {
      // ignore background history errors
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role === "admin") return;
    let active = true;
    searchComplaints({ sort: "newest" })
      .then((list) => {
        if (active) setHistoryComplaints(list || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentUser]);

  // --------------------------------------------------
  // FILE PROCESSING (PRESERVED)
  // --------------------------------------------------

  const processFile = (file) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, JPEG, PNG or WEBP image.");
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
    setDuplicateCheckDone(false);
    setSimilarComplaints([]);
    setRegisteredComplaint(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    processFile(file);
  };

  // --------------------------------------------------
  // DRAG & DROP (PRESERVED)
  // --------------------------------------------------

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    processFile(file);
  };

  // --------------------------------------------------
  // REMOVE / RESET (PRESERVED)
  // --------------------------------------------------

  const handleRemove = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setLoading(false);
    setDuplicateCheckDone(false);
    setSimilarComplaints([]);
    setRegisteredComplaint(null);
  };

  // --------------------------------------------------
  // DETECTION + IMMEDIATE COMPLAINT SYNC & HISTORY
  // --------------------------------------------------

  const handleDetect = async () => {
    if (!selectedFile) {
      setError("Please select a road image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setDuplicateCheckDone(false);
    setSimilarComplaints([]);
    setRegisteredComplaint(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Road damage detection failed.";

        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Ignore parsing error
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResult(data);

      // Immediately check duplicates and auto-register complaint so History & Admin Dashboard update right away
      const activeLocation =
        complaintLocation.trim() || "Kanpur Municipal Road Sector";
      if (!complaintLocation.trim()) {
        setComplaintLocation(activeLocation);
      }

      const primaryDamage =
        data?.detections?.length > 0
          ? data.detections[0].damage_type
          : "pothole";
      const primarySeverity =
        data?.detections?.length > 0 ? data.detections[0].severity : "Medium";
      const primaryConfidence =
        data?.detections?.length > 0 ? data.detections[0].confidence : 0.85;

      try {
        const dupRes = await checkDuplicateComplaints(
          activeLocation,
          primaryDamage,
          primarySeverity,
        );
        setSimilarComplaints(dupRes.similar_complaints || []);
        setDuplicateCheckDone(true);
      } catch {
        // non-blocking duplicate check
      }

      try {
        const payload = {
          damage_type: primaryDamage,
          severity: primarySeverity,
          confidence: primaryConfidence,
          location: activeLocation,
          description: `Verified ${primaryDamage} (${primarySeverity} severity) identified via Civic-Aegis AI inspection.`,
          image_url: data.annotated_image || "",
          annotated_image_url: data.annotated_image || "",
          user_name: currentUser?.full_name || "Citizen Reporter",
        };
        const created = await createComplaint(payload);
        setRegisteredComplaint(created);
      } catch (regErr) {
        console.error("Auto complaint registration error:", regErr);
      }

      await fetchHistory();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to connect to the Civic-Aegis AI backend.",
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // DUPLICATE COMPLAINT CHECK & REGISTRATION
  // --------------------------------------------------

  const handleCheckDuplicates = async () => {
    if (!complaintLocation.trim()) {
      setError("Please enter the road location or area.");
      return;
    }

    const primaryDamage =
      result?.detections?.length > 0
        ? result.detections[0].damage_type
        : "pothole";

    const primarySeverity =
      result?.detections?.length > 0 ? result.detections[0].severity : "Medium";

    setCheckingDuplicates(true);
    setError("");

    try {
      const res = await checkDuplicateComplaints(
        complaintLocation.trim(),
        primaryDamage,
        primarySeverity,
      );
      setSimilarComplaints(res.similar_complaints || []);
      setDuplicateCheckDone(true);
    } catch (err) {
      setError(err.message || "Failed to check for similar complaints.");
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleRegisterComplaint = async () => {
    if (!complaintLocation.trim()) {
      setError("Please specify the road location.");
      return;
    }

    const primaryDamage =
      result?.detections?.length > 0
        ? result.detections[0].damage_type
        : "pothole";

    const primarySeverity =
      result?.detections?.length > 0 ? result.detections[0].severity : "Medium";

    const primaryConfidence =
      result?.detections?.length > 0 ? result.detections[0].confidence : 0.85;

    setRegisteringComplaint(true);
    setError("");

    try {
      const payload = {
        damage_type: primaryDamage,
        severity: primarySeverity,
        confidence: primaryConfidence,
        location: complaintLocation.trim(),
        description: `Verified ${primaryDamage} (${primarySeverity} severity) identified via Civic-Aegis AI inspection.`,
        image_url: result.annotated_image || "",
        annotated_image_url: result.annotated_image || "",
        user_name: currentUser?.full_name || "Citizen Reporter",
      };

      const newComplaint = await createComplaint(payload);
      setRegisteredComplaint(newComplaint);
      await fetchHistory();
    } catch (err) {
      setError(err.message || "Failed to register complaint.");
    } finally {
      setRegisteringComplaint(false);
    }
  };

  // --------------------------------------------------
  // ANNOTATED IMAGE (PRESERVED)
  // --------------------------------------------------

  const getAnnotatedImageUrl = () => {
    if (!result?.annotated_image) {
      return null;
    }

    const path = result.annotated_image;
    const filename = path.split("\\").pop().split("/").pop();
    return `${API_URL}/outputs/${encodeURIComponent(filename)}`;
  };

  // --------------------------------------------------
  // CONFIDENCE (PRESERVED)
  // --------------------------------------------------

  const getConfidence = (detection) => {
    if (!detection) return 0;
    return Number(detection.confidence || 0) * 100;
  };

  const scrollToUpload = () => {
    if (view !== "home") {
      setView("home");
      setTimeout(() => {
        document
          .getElementById("analysis")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      document
        .getElementById("analysis")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setAuthStep("portal");
    setView("home");
    handleRemove();
  };

  // --------------------------------------------------
  // SPLASH SCREEN (PRESERVED)
  // --------------------------------------------------

  if (showSplash) {
    return (
      <div
        className={`splash-screen ${darkMode ? "dark" : ""} ${
          splashClosing ? "splash-closing" : ""
        }`}
      >
        <div className="splash-content">
          <div className="splash-logo">
            <div className="logo-shield">
              <ShieldCheck size={42} strokeWidth={2} />
            </div>
          </div>

          <h1 className="splash-title">
            Civic<span>-Aegis</span>
          </h1>

          <p className="splash-subtitle">AI-Powered Road Damage Intelligence</p>

          <div className="splash-loader">
            <div></div>
          </div>

          <div className="splash-status">
            <span className="status-pulse"></span>
            Initializing AI Detection System
          </div>
        </div>
      </div>
    );
  }

  const isAdminUser = currentUser?.role === "admin";

  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      {/* ================= NAVBAR ================= */}

      <header className="navbar">
        <div className="navbar-inner">
          <div
            className="brand"
            onClick={() => {
              if (!currentUser) {
                setAuthStep("portal");
              } else if (!isAdminUser) {
                setView("home");
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <div className="brand-logo">
              <ShieldCheck size={23} strokeWidth={2.2} />
            </div>

            <div className="brand-text">
              <h2>Civic-Aegis</h2>
              <span>AI Road Intelligence</span>
            </div>
          </div>

          {/* Strict Role-Based Navigation Links */}
          {currentUser && !isAdminUser && (
            <nav className="nav-links">
              <button
                className={view === "home" ? "nav-home active" : "nav-home"}
                onClick={() => {
                  setView("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Detect & History
              </button>

              <button
                className={view === "user" ? "active" : ""}
                onClick={() => setView("user")}
              >
                Area Complaints
              </button>
            </nav>
          )}

          {currentUser && isAdminUser && (
            <nav className="nav-links">
              <button className="active" style={{ cursor: "default" }}>
                Municipal Admin Dashboard
              </button>
            </nav>
          )}

          <div className="navbar-actions">
            {currentUser ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: isAdminUser
                      ? "rgba(239, 68, 68, 0.14)"
                      : "rgba(79, 109, 245, 0.14)",
                    color: isAdminUser ? "#ef4444" : "#4f6df5",
                  }}
                >
                  {isAdminUser ? "ADMIN" : "USER"}: {currentUser.full_name}
                </span>
                <button
                  className="card-action-btn"
                  onClick={handleLogout}
                  title="Logout"
                  style={{ padding: "6px 10px", color: "#ef4444" }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            ) : (
              <button
                className="card-action-btn"
                onClick={() =>
                  setAuthStep(authStep === "portal" ? "auth" : "portal")
                }
                style={{ padding: "6px 12px" }}
              >
                <User size={15} />
                {authStep === "portal" ? "Login / Register" : "Select Portal"}
              </button>
            )}

            <div className="system-status">
              <span className="status-dot"></span>
              <span>AI Online</span>
            </div>

            <button
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ================= 1. UNAUTHENTICATED LANDING: USER & ADMIN LOGIN / REGISTER ================= */}
      {!currentUser && (
        <>
          {authStep === "portal" ? (
            <Portal
              onSelectRole={(role) => {
                setSelectedRole(role);
                setAuthStep("auth");
              }}
            />
          ) : (
            <Auth
              selectedRole={selectedRole}
              onChangeRole={(role) => setSelectedRole(role)}
              onBackToPortal={() => setAuthStep("portal")}
              onAuthSuccess={(u) => {
                setCurrentUser(u);
                setView("home");
              }}
            />
          )}
        </>
      )}

      {/* ================= 2. ADMIN ROLE: STRICTLY LOCKED TO ADMIN DASHBOARD ================= */}
      {currentUser && isAdminUser && <AdminDashboard onLogout={handleLogout} />}

      {/* ================= 3. USER ROLE: STRICTLY LOCKED TO USER DASHBOARD & DETECTION ================= */}
      {currentUser && !isAdminUser && view === "user" && (
        <UserDashboard onNavigateToAnalysis={() => setView("home")} />
      )}

      {currentUser && !isAdminUser && view === "home" && (
        <main>
          {/* ================= HERO (PRESERVED) ================= */}

          {!result && (
            <section className="hero">
              <div className="hero-overlay"></div>

              <div className="hero-content">
                <div className="hero-badge">
                  <span></span>
                  INTELLIGENT ROAD INSPECTION
                </div>

                <h1>
                  See the road.
                  <br />
                  <span>Understand the damage.</span>
                </h1>

                <p>
                  Civic-Aegis uses computer vision and AI to automatically
                  detect road damage, prevent duplicate complaints, and
                  prioritize municipal repairs.
                </p>

                <div className="hero-actions">
                  <button className="primary-button" onClick={scrollToUpload}>
                    Start Road Analysis
                    <ArrowRight size={19} />
                  </button>

                  <button
                    className="secondary-hero-button"
                    onClick={() => setView("user")}
                  >
                    Explore Complaints
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="hero-stats">
                  <div>
                    <strong>YOLO</strong>
                    <span>AI Detection</span>
                  </div>

                  <div>
                    <strong>PRIORITY</strong>
                    <span>Smart Ranking</span>
                  </div>

                  <div>
                    <strong>24/7</strong>
                    <span>Citizen Access</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ================= ANALYSIS SECTION (PRESERVED) ================= */}

          <section id="analysis" className="analysis-section">
            <div className="section-heading">
              <div className="section-eyebrow">
                <Activity size={16} />
                ROAD ANALYSIS DASHBOARD
              </div>

              <h2>
                Analyze road conditions
                <span> in seconds.</span>
              </h2>

              <p>
                Upload a road image and let Civic-Aegis identify visible road
                damage using AI-powered computer vision.
              </p>
            </div>

            {/* ================= UPLOAD (PRESERVED) ================= */}

            {!preview && !result && (
              <div
                className={`upload-dashboard ${dragActive ? "drag-active" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="upload-main">
                  <div className="upload-icon-large">
                    <CloudUpload size={38} />
                  </div>

                  <h3>Upload a road image</h3>

                  <p>
                    Drag and drop your image here or browse files from your
                    computer.
                  </p>

                  <label className="browse-button">
                    <Upload size={18} />
                    Browse Road Image
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileChange}
                      hidden
                    />
                  </label>

                  <div className="supported-files">
                    <span>JPG</span>
                    <span>JPEG</span>
                    <span>PNG</span>
                    <span>WEBP</span>
                    <span>MAX 10MB</span>
                  </div>
                </div>

                <div className="upload-side">
                  <div className="side-icon">
                    <Zap size={21} />
                  </div>

                  <h4>Fast AI Inspection</h4>

                  <p>
                    Our YOLO-based computer vision model analyzes your image and
                    identifies road damage automatically.
                  </p>

                  <div className="side-feature">
                    <Check size={16} />
                    Automatic detection
                  </div>

                  <div className="side-feature">
                    <Check size={16} />
                    Severity classification
                  </div>

                  <div className="side-feature">
                    <Check size={16} />
                    Duplicate complaint check
                  </div>
                </div>
              </div>
            )}

            {/* ================= SELECTED IMAGE (PRESERVED) ================= */}

            {preview && !result && (
              <div className="selected-dashboard">
                <div className="selected-header">
                  <div>
                    <div className="section-eyebrow">
                      <FileImage size={15} />
                      IMAGE READY
                    </div>

                    <h3>Road image selected</h3>
                    <p>{selectedFile?.name}</p>
                  </div>

                  <button
                    className="icon-button"
                    onClick={handleRemove}
                    disabled={loading}
                    title="Remove image"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="selected-content">
                  <div className="selected-image-container">
                    <img src={preview} alt="Selected road" />

                    <div className="image-status">
                      <Check size={15} />
                      Image loaded successfully
                    </div>
                  </div>

                  <div className="analysis-panel">
                    <div className="analysis-panel-icon">
                      <Gauge size={26} />
                    </div>

                    <h3>Ready for AI analysis</h3>

                    <p>
                      Civic-Aegis will scan this image for visible road damage
                      and return detailed detection results.
                    </p>

                    <div className="analysis-checks">
                      <div>
                        <Check size={16} />
                        Damage detection
                      </div>

                      <div>
                        <Check size={16} />
                        Severity analysis
                      </div>

                      <div>
                        <Check size={16} />
                        Instant complaint & history sync
                      </div>
                    </div>

                    <div style={{ marginBottom: "16px", textAlign: "left" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          marginBottom: "6px",
                          color: "#64748b",
                        }}
                      >
                        Road Location / Sector (for Complaint & Admin Sync):
                      </label>
                      <input
                        type="text"
                        className="civic-input"
                        placeholder="e.g. Kanpur, Shyam Nagar, GT Road"
                        value={complaintLocation}
                        onChange={(e) => setComplaintLocation(e.target.value)}
                      />
                    </div>

                    <button
                      className="analyze-button"
                      onClick={handleDetect}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner"></span>
                          Analyzing Road...
                        </>
                      ) : (
                        <>
                          Detect Road Damage
                          <ArrowRight size={19} />
                        </>
                      )}
                    </button>

                    <button
                      className="change-image-button"
                      onClick={handleRemove}
                      disabled={loading}
                    >
                      Choose another image
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ERROR ================= */}

            {error && (
              <div className="error-box">
                <AlertTriangle size={19} />
                <span>{error}</span>

                <button onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
          </section>

          {/* ================= LOADING ================= */}

          {loading && (
            <section className="ai-loading-section">
              <div className="ai-loading-card">
                <div className="ai-loading-icon">
                  <Activity size={32} />
                </div>

                <div className="loading-pulse"></div>

                <div className="section-eyebrow">AI PROCESSING</div>

                <h2>Analyzing your road image</h2>

                <p>
                  Civic-Aegis is detecting road damage, calculating confidence
                  and evaluating severity.
                </p>

                <div className="loading-steps">
                  <div className="active">
                    <span>01</span>
                    Processing image
                  </div>

                  <div className="active">
                    <span>02</span>
                    Detecting damage
                  </div>

                  <div>
                    <span>03</span>
                    Calculating severity
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ================= RESULTS & EXTENDED COMPLAINT REGISTRATION ================= */}

          {result && !loading && (
            <section className="results-section">
              <div className="results-top">
                <div>
                  <div className="success-badge">
                    <Check size={15} />
                    AI ANALYSIS COMPLETE
                  </div>

                  <h2>Road inspection results</h2>

                  <p>
                    Analysis completed for <strong>{result.filename}</strong>
                  </p>
                </div>

                <button className="new-analysis-top" onClick={handleRemove}>
                  <RefreshCw size={17} />
                  New Analysis
                </button>
              </div>

              {/* ================= IMAGE ================= */}

              {getAnnotatedImageUrl() && (
                <div className="result-image-card">
                  <div className="result-card-header">
                    <div>
                      <span>AI VISUALIZATION</span>
                      <h3>Detected road damage</h3>
                    </div>

                    <div className="detection-count">
                      {result.count}{" "}
                      {result.count === 1 ? "Detection" : "Detections"}
                    </div>
                  </div>

                  <div className="annotated-image-container">
                    <img src={getAnnotatedImageUrl()} alt="AI annotated road" />
                  </div>
                </div>
              )}

              {/* ================= STATISTICS ================= */}

              <div className="results-stats">
                <div className="result-stat">
                  <div className="result-stat-icon blue">
                    <Activity size={21} />
                  </div>

                  <div>
                    <span>Total Detections</span>
                    <strong>{result.count}</strong>
                  </div>
                </div>

                <div className="result-stat">
                  <div className="result-stat-icon purple">
                    <ImageIcon size={21} />
                  </div>

                  <div>
                    <span>Damage Type</span>
                    <strong>
                      {result.detections?.length
                        ? result.detections[0].damage_type
                        : "No Damage"}
                    </strong>
                  </div>
                </div>

                <div className="result-stat">
                  <div className="result-stat-icon orange">
                    <AlertTriangle size={21} />
                  </div>

                  <div>
                    <span>Severity</span>
                    <strong
                      className={
                        result.detections?.[0]?.severity?.toLowerCase() ===
                        "high"
                          ? "high-text"
                          : ""
                      }
                    >
                      {result.detections?.length
                        ? result.detections[0].severity
                        : "None"}
                    </strong>
                  </div>
                </div>

                <div className="result-stat">
                  <div className="result-stat-icon green">
                    <Gauge size={21} />
                  </div>

                  <div>
                    <span>Confidence</span>
                    <strong>
                      {result.detections?.length
                        ? `${getConfidence(result.detections[0]).toFixed(2)}%`
                        : "0%"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ================= DETECTION DETAILS ================= */}

              {result.detections?.length > 0 && (
                <div className="details-card">
                  <div className="result-card-header">
                    <div>
                      <span>DETAILED ANALYSIS</span>
                      <h3>Detected damage</h3>
                    </div>

                    <span className="details-count">
                      {result.detections.length} items
                    </span>
                  </div>

                  <div className="detection-list">
                    {result.detections.map((detection, index) => {
                      const confidence = getConfidence(detection);
                      const isHigh =
                        detection.severity?.toLowerCase() === "high";

                      return (
                        <div className="detection-item" key={index}>
                          <div className="detection-number">
                            {String(index + 1).padStart(2, "0")}
                          </div>

                          <div className="detection-info">
                            <strong>{detection.damage_type}</strong>
                            <span>Detection #{index + 1}</span>
                          </div>

                          <div
                            className={`severity-badge ${
                              isHigh ? "high" : "normal"
                            }`}
                          >
                            {detection.severity}
                          </div>

                          <div className="confidence-area">
                            <div className="confidence-heading">
                              <span>Confidence</span>
                              <strong>{confidence.toFixed(2)}%</strong>
                            </div>

                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{
                                  width: `${Math.min(confidence, 100)}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ================= EXTENSION: DUPLICATE CHECK & COMPLAINT REGISTRATION ================= */}

              <div className="civic-complaint-register-card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    className="brand-logo"
                    style={{ width: "36px", height: "36px" }}
                  >
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.3rem" }}>
                      Register as Civic Complaint
                    </h3>
                    <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Check for existing similar complaints in this area to
                      avoid duplicates, or file an official report.
                    </span>
                  </div>
                </div>

                {!registeredComplaint ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        marginBottom: "8px",
                      }}
                    >
                      Road Location / Area:
                    </label>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        marginBottom: "14px",
                      }}
                    >
                      <input
                        type="text"
                        className="civic-input"
                        placeholder="e.g. Kanpur, Shyam Nagar, GT Road Crossing"
                        value={complaintLocation}
                        onChange={(e) => {
                          setComplaintLocation(e.target.value);
                          setDuplicateCheckDone(false);
                        }}
                        style={{ flex: 1 }}
                      />

                      <button
                        className="primary-button"
                        onClick={handleCheckDuplicates}
                        disabled={
                          checkingDuplicates || !complaintLocation.trim()
                        }
                        style={{ minWidth: "210px" }}
                      >
                        {checkingDuplicates ? (
                          "Checking Area..."
                        ) : (
                          <>
                            <Search size={16} />
                            Check for Duplicates
                          </>
                        )}
                      </button>
                    </div>

                    {/* Quick Location presets */}
                    <div
                      className="quick-search-chips"
                      style={{ marginBottom: "20px" }}
                    >
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "#64748b",
                          fontWeight: 600,
                        }}
                      >
                        Presets:
                      </span>
                      {[
                        "Kanpur, Shyam Nagar",
                        "Kanpur, Civil Lines",
                        "Kanpur, Kakadeo",
                        "Kanpur, Mall Road",
                      ].map((p) => (
                        <button
                          key={p}
                          type="button"
                          className="quick-chip"
                          onClick={() => {
                            setComplaintLocation(p);
                            setDuplicateCheckDone(false);
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {/* Duplicate Check Results */}
                    {duplicateCheckDone && (
                      <div style={{ marginTop: "20px" }}>
                        {similarComplaints.length > 0 ? (
                          <div>
                            <div className="duplicate-alert-banner">
                              <div className="duplicate-icon-wrapper">
                                <AlertTriangle size={24} />
                              </div>
                              <div className="duplicate-alert-content">
                                <h4>
                                  Similar complaints already exist in this area!
                                </h4>
                                <p>
                                  We found{" "}
                                  <strong>
                                    {similarComplaints.length} existing
                                    complaint(s)
                                  </strong>{" "}
                                  matching this damage type and neighborhood.
                                  Instead of registering a duplicate, you can
                                  upvote an existing complaint to elevate its
                                  municipal priority, or attach this photo as
                                  supporting evidence.
                                </p>
                              </div>
                            </div>

                            <div className="complaints-grid">
                              {similarComplaints.map((c) => (
                                <ComplaintCard
                                  key={c.id}
                                  complaint={c}
                                  isDuplicateMatch={true}
                                  onAddEvidenceClick={(target) =>
                                    setEvidenceTarget(target)
                                  }
                                  onViewDetailsClick={(target) =>
                                    setDetailsTargetId(target.id)
                                  }
                                />
                              ))}
                            </div>

                            <div
                              style={{
                                textAlign: "center",
                                padding: "20px",
                                background: "rgba(79, 109, 245, 0.04)",
                                borderRadius: "14px",
                                marginTop: "20px",
                              }}
                            >
                              <p
                                style={{
                                  margin: "0 0 12px",
                                  fontSize: "0.9rem",
                                  color: "#64748b",
                                }}
                              >
                                Is this a completely separate hazard not
                                represented above?
                              </p>
                              <button
                                className="card-action-btn"
                                onClick={handleRegisterComplaint}
                                disabled={registeringComplaint}
                                style={{ padding: "10px 18px" }}
                              >
                                {registeringComplaint
                                  ? "Registering..."
                                  : "Register New Complaint Anyway"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="no-duplicate-banner">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <CheckCircle2
                                size={28}
                                style={{ color: "#10b981" }}
                              />
                              <div>
                                <strong>
                                  No duplicate complaints found in this area
                                </strong>
                                <span>
                                  You are the first to report this damage.
                                  Proceed to register it officially.
                                </span>
                              </div>
                            </div>

                            <button
                              className="primary-button"
                              onClick={handleRegisterComplaint}
                              disabled={registeringComplaint}
                              style={{ minHeight: "44px" }}
                            >
                              {registeringComplaint ? (
                                "Registering..."
                              ) : (
                                <>
                                  <ShieldCheck size={18} />
                                  Register New Complaint
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Confirmation Card */
                  <div
                    style={{
                      padding: "28px",
                      borderRadius: "18px",
                      background: "rgba(16, 185, 129, 0.06)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "16px",
                      }}
                    >
                      <CheckCircle2 size={24} style={{ color: "#10b981" }} />
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "1.2rem",
                          color: "#10b981",
                        }}
                      >
                        Complaint Successfully Registered!
                      </h4>
                    </div>

                    <div className="confirmation-summary-grid">
                      <div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          Complaint ID
                        </span>
                        <strong
                          style={{
                            display: "block",
                            fontSize: "1.15rem",
                            color: "#4f6df5",
                          }}
                        >
                          {registeredComplaint.complaint_code}
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          Status
                        </span>
                        <span
                          className="badge-status badge-pending"
                          style={{ display: "inline-block", marginTop: 4 }}
                        >
                          {registeredComplaint.status}
                        </span>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          Detected Damage
                        </span>
                        <strong
                          style={{
                            display: "block",
                            textTransform: "capitalize",
                          }}
                        >
                          {registeredComplaint.damage_type} (
                          {registeredComplaint.severity})
                        </strong>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            textTransform: "uppercase",
                          }}
                        >
                          Initial Priority
                        </span>
                        <strong style={{ display: "block", color: "#f97316" }}>
                          {registeredComplaint.priority_level} (
                          {registeredComplaint.priority_score?.toFixed(1)})
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="primary-button"
                        onClick={() => setView("user")}
                        style={{ minHeight: "42px" }}
                      >
                        Track in User Portal
                        <ArrowRight size={16} />
                      </button>

                      <button
                        className="card-action-btn"
                        onClick={handleRemove}
                      >
                        Inspect Another Image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= NEW ANALYSIS (PRESERVED) ================= */}

              <div className="new-analysis-card" style={{ marginTop: "30px" }}>
                <div className="new-analysis-icon">
                  <ShieldCheck size={25} />
                </div>

                <div>
                  <span>CONTINUE INSPECTION</span>
                  <h3>Inspect another road image</h3>
                  <p>Run another AI-powered road inspection.</p>
                </div>

                <button onClick={handleRemove}>
                  New Analysis
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* ================= IMMEDIATE DETECTION & COMPLAINT HISTORY ================= */}
          <section
            id="detection-history"
            style={{
              maxWidth: "1220px",
              margin: "0 auto",
              padding: "36px 24px 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <div>
                <div className="section-eyebrow">
                  <Activity size={16} />
                  LIVE MUNICIPAL SYNC
                </div>
                <h2 style={{ margin: "6px 0 4px", fontSize: "1.8rem" }}>
                  Detection & Complaint <span>History</span>
                </h2>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
                  Every road damage detection is automatically logged here and
                  forwarded to the Municipal Admin Dashboard in real time.
                </p>
              </div>

              <button
                className="card-action-btn"
                onClick={fetchHistory}
                disabled={loadingHistory}
              >
                <RefreshCw
                  size={15}
                  className={loadingHistory ? "spinner" : ""}
                />
                Refresh History ({historyComplaints.length})
              </button>
            </div>

            {historyComplaints.length === 0 ? (
              <div className="empty-complaints-card">
                <ShieldCheck
                  size={36}
                  style={{ color: "#4f6df5", marginBottom: "10px" }}
                />
                <h3 style={{ margin: "0 0 6px" }}>
                  No detections recorded yet
                </h3>
                <p style={{ margin: 0, color: "#64748b" }}>
                  Upload a road image above and run AI detection. Your detection
                  history and registered complaint will appear here immediately.
                </p>
              </div>
            ) : (
              <div className="complaints-grid">
                {historyComplaints.map((item) => (
                  <ComplaintCard
                    key={item.id}
                    complaint={item}
                    onVoteUpdated={(updated) =>
                      setHistoryComplaints((prev) =>
                        prev.map((c) => (c.id === updated.id ? updated : c)),
                      )
                    }
                    onAddEvidenceClick={(target) => setEvidenceTarget(target)}
                    onViewDetailsClick={(target) =>
                      setDetailsTargetId(target.id)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* ================= FEATURES (PRESERVED) ================= */}

          {!result && (
            <section id="features" className="features-section">
              <div className="section-heading">
                <div className="section-eyebrow">
                  <ShieldCheck size={16} />
                  WHY CIVIC-AEGIS
                </div>

                <h2>
                  Built for smarter
                  <span> road inspection.</span>
                </h2>

                <p>
                  Turn ordinary road images into actionable infrastructure
                  insights.
                </p>
              </div>

              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">
                    <Zap size={23} />
                  </div>

                  <h3>AI-Powered Detection</h3>
                  <p>
                    YOLO-based computer vision identifies road damage
                    automatically from uploaded images.
                  </p>

                  <span className="feature-link">
                    Computer Vision
                    <ArrowRight size={15} />
                  </span>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    <AlertTriangle size={23} />
                  </div>

                  <h3>Duplicate Prevention</h3>
                  <p>
                    Intelligently associates reports from the same location to
                    prevent redundant administrative cases.
                  </p>

                  <span className="feature-link">
                    Smart Aggregation
                    <ArrowRight size={15} />
                  </span>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    <Gauge size={23} />
                  </div>

                  <h3>Citizen Priority Ranking</h3>
                  <p>
                    Community upvotes and corroborating evidence dynamically
                    elevate critical road hazards.
                  </p>

                  <span className="feature-link">
                    Transparent Priority
                    <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* ================= FOOTER (PRESERVED) ================= */}

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">CA</div>

            <div>
              <strong>Civic-Aegis</strong>
              <span>AI Road Intelligence</span>
            </div>
          </div>

          <div className="footer-status">
            <span className="status-dot"></span>
            Detection system operational
          </div>

          <p>
            © 2026 Civic-Aegis. Intelligent infrastructure inspection powered by
            AI.
          </p>
        </div>
      </footer>

      {/* Modals */}
      {evidenceTarget && (
        <EvidenceModal
          complaint={evidenceTarget}
          onClose={() => setEvidenceTarget(null)}
          onSuccess={() => {}}
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

export default App;
