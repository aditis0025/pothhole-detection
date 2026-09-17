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
} from "lucide-react";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashClosing, setSplashClosing] = useState(false);

  // --------------------------------------------------
  // SPLASH SCREEN
  // --------------------------------------------------

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashClosing(true);

      setTimeout(() => {
        setShowSplash(false);
      }, 500);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  // --------------------------------------------------
  // FILE PROCESSING
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
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    processFile(file);
  };

  // --------------------------------------------------
  // DRAG & DROP
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
  // REMOVE / RESET
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
  };

  // --------------------------------------------------
  // DETECTION
  // --------------------------------------------------

  const handleDetect = async () => {
    if (!selectedFile) {
      setError("Please select a road image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

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

      console.log("Backend response:", data);

      setResult(data);
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
  // ANNOTATED IMAGE
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
  // CONFIDENCE
  // --------------------------------------------------

  const getConfidence = (detection) => {
    if (!detection) return 0;

    return Number(detection.confidence || 0) * 100;
  };

  // --------------------------------------------------
  // SCROLL
  // --------------------------------------------------

  const scrollToUpload = () => {
    document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" });
  };

  // --------------------------------------------------
  // SPLASH SCREEN
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

  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      {/* ================= NAVBAR ================= */}

      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand">
            <div className="brand-logo">
              <ShieldCheck size={23} strokeWidth={2.2} />
            </div>

            <div className="brand-text">
              <h2>Civic-Aegis</h2>
              <span>AI Road Intelligence</span>
            </div>
          </div>

          <nav className="nav-links">
            <button
              className="nav-home"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Home
            </button>

            <button onClick={scrollToUpload}>Analyze</button>

            <button
              onClick={() =>
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Technology
            </button>
          </nav>

          <div className="navbar-actions">
            <div className="system-status">
              <span className="status-dot"></span>
              <span>AI System Online</span>
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

      {/* ================= MAIN ================= */}

      <main>
        {/* ================= HERO ================= */}

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
                Civic-Aegis uses computer vision and AI to automatically detect
                and analyze road damage from a single image.
              </p>

              <div className="hero-actions">
                <button className="primary-button" onClick={scrollToUpload}>
                  Start Road Analysis
                  <ArrowRight size={19} />
                </button>

                <button
                  className="secondary-hero-button"
                  onClick={() =>
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Explore Technology
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="hero-stats">
                <div>
                  <strong>AI</strong>
                  <span>Powered Detection</span>
                </div>

                <div>
                  <strong>YOLO</strong>
                  <span>Computer Vision</span>
                </div>

                <div>
                  <strong>24/7</strong>
                  <span>Inspection Ready</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================= ANALYSIS SECTION ================= */}

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

          {/* ================= UPLOAD ================= */}

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
                  Confidence scoring
                </div>
              </div>
            </div>
          )}

          {/* ================= SELECTED IMAGE ================= */}

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
                    Civic-Aegis will scan this image for visible road damage and
                    return detailed detection results.
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
                      Confidence score
                    </div>
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
                Civic-Aegis is detecting road damage, calculating confidence and
                evaluating severity.
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

        {/* ================= RESULTS ================= */}

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
                      result.detections?.[0]?.severity?.toLowerCase() === "high"
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

                    const isHigh = detection.severity?.toLowerCase() === "high";

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

            {/* ================= NEW ANALYSIS ================= */}

            <div className="new-analysis-card">
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

        {/* ================= FEATURES ================= */}

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

                <h3>Severity Analysis</h3>

                <p>
                  Detected damage is classified according to its severity to
                  support faster inspection.
                </p>

                <span className="feature-link">
                  Smart Classification
                  <ArrowRight size={15} />
                </span>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <Gauge size={23} />
                </div>

                <h3>Confidence Scoring</h3>

                <p>
                  View the model confidence for every detected road-damage
                  instance.
                </p>

                <span className="feature-link">
                  Transparent Results
                  <ArrowRight size={15} />
                </span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ================= FOOTER ================= */}

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
    </div>
  );
}

export default App;
