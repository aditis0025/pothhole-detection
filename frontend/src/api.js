const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Persistent citizen identifier for anonymous/guest voting
export function getCitizenIdentifier() {
  let ident = localStorage.getItem("civic_citizen_id");
  if (!ident) {
    ident = "citizen_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("civic_citizen_id", ident);
  }
  return ident;
}

export function getAuthToken() {
  return localStorage.getItem("civic_token");
}

export function setAuthSession(token, user) {
  if (token) localStorage.setItem("civic_token", token);
  if (user) localStorage.setItem("civic_user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("civic_token");
  localStorage.removeItem("civic_user");
}

export function getStoredUser() {
  try {
    const u = localStorage.getItem("civic_user");
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

function getHeaders(isJson = true) {
  const headers = {};
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function checkDuplicateComplaints(location, damageType, severity) {
  const res = await fetch(`${API_BASE}/complaints/check-duplicate`, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({
      location,
      damage_type: damageType,
      severity,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to check for similar complaints.");
  }
  return res.json();
}

export async function createComplaint(data) {
  const res = await fetch(`${API_BASE}/complaints`, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to register complaint.");
  }
  return res.json();
}

export async function searchComplaints(params = {}) {
  const query = new URLSearchParams();
  if (params.location) query.append("location", params.location);
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.priority && params.priority !== "all")
    query.append("priority", params.priority);
  if (params.damage_type && params.damage_type !== "all")
    query.append("damage_type", params.damage_type);
  if (params.sort) query.append("sort", params.sort);
  query.append("user_identifier", getCitizenIdentifier());

  const res = await fetch(`${API_BASE}/complaints?${query.toString()}`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch complaints.");
  }
  return res.json();
}

export async function getComplaintDetails(id) {
  const userIdent = getCitizenIdentifier();
  const res = await fetch(
    `${API_BASE}/complaints/${id}?user_identifier=${encodeURIComponent(userIdent)}`,
    {
      headers: getHeaders(true),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Complaint not found.");
  }
  return res.json();
}

export async function voteComplaint(complaintId, voteType) {
  const res = await fetch(`${API_BASE}/complaints/${complaintId}/vote`, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({
      vote_type: voteType,
      user_identifier: getCitizenIdentifier(),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Vote failed.");
  }
  return res.json();
}

export async function uploadEvidence(
  complaintId,
  file,
  description = "",
  userName = "",
) {
  const formData = new FormData();
  formData.append("file", file);

  const query = new URLSearchParams();
  if (description) query.append("description", description);
  if (userName) query.append("user_name", userName);

  const headers = {};
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${API_BASE}/complaints/${complaintId}/evidence?${query.toString()}`,
    {
      method: "POST",
      headers,
      body: formData,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload evidence.");
  }
  return res.json();
}

export function getDownloadUrl(complaintId) {
  return `${API_BASE}/complaints/${complaintId}/download`;
}

export function resolveImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // If starts with /outputs or /uploads, prepend API_BASE
  if (url.startsWith("/")) {
    return `${API_BASE}${url}`;
  }
  // Windows file path fallback
  const filename = url.split("\\").pop().split("/").pop();
  return `${API_BASE}/outputs/${encodeURIComponent(filename)}`;
}

export async function getAdminStatistics() {
  const res = await fetch(`${API_BASE}/admin/statistics`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch admin statistics.");
  }
  return res.json();
}

export async function getAdminComplaints(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.priority && params.priority !== "all")
    query.append("priority", params.priority);
  if (params.damage_type && params.damage_type !== "all")
    query.append("damage_type", params.damage_type);
  if (params.search) query.append("search", params.search);

  const res = await fetch(`${API_BASE}/admin/complaints?${query.toString()}`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch admin complaints.");
  }
  return res.json();
}

export async function updateComplaintStatus(complaintId, status, notes = "") {
  const res = await fetch(
    `${API_BASE}/admin/complaints/${complaintId}/status`,
    {
      method: "PATCH",
      headers: getHeaders(true),
      body: JSON.stringify({ status, notes }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update complaint status.");
  }
  return res.json();
}

export async function apiLogin(email, password, expectedRole = null) {
  const payload = { email, password };
  if (expectedRole) {
    payload.expected_role = expectedRole;
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed.");
  }
  return res.json();
}

export async function apiRegister(email, fullName, password, role = "user") {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, full_name: fullName, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed.");
  }
  return res.json();
}
