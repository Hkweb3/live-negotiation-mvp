const elements = {
  authStatus: document.getElementById("authStatus"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  registerBtn: document.getElementById("registerBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  authError: document.getElementById("authError"),
  vertical: document.getElementById("vertical"),
  channel: document.getElementById("channel"),
  customerName: document.getElementById("customerName"),
  counterparty: document.getElementById("counterparty"),
  content: document.getElementById("content"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  ingestError: document.getElementById("ingestError"),
  currentCase: document.getElementById("currentCase"),
  caseHistory: document.getElementById("caseHistory")
};

let activeCaseId = null;
let currentUser = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setError(target, message) {
  if (!message) {
    target.classList.add("hidden");
    target.textContent = "";
    return;
  }

  target.classList.remove("hidden");
  target.textContent = message;
}

function setAuthStatus() {
  if (!currentUser) {
    elements.authStatus.textContent = "Not signed in.";
    return;
  }

  elements.authStatus.textContent = `Signed in as ${currentUser.email} (${currentUser.role})`;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function refreshSession() {
  const data = await request("/api/auth/me", { method: "GET" });
  currentUser = data.user;
  setAuthStatus();
}

async function register() {
  setError(elements.authError, "");

  try {
    const payload = {
      email: elements.authEmail.value,
      password: elements.authPassword.value,
      name: elements.authName.value || undefined
    };

    const data = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    currentUser = data.user;
    setAuthStatus();
    await loadCases();
  } catch (error) {
    setError(elements.authError, error.message);
  }
}

async function login() {
  setError(elements.authError, "");

  try {
    const payload = {
      email: elements.authEmail.value,
      password: elements.authPassword.value
    };

    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    currentUser = data.user;
    setAuthStatus();
    await loadCases();
  } catch (error) {
    setError(elements.authError, error.message);
  }
}

async function logout() {
  setError(elements.authError, "");

  await request("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });

  currentUser = null;
  activeCaseId = null;
  setAuthStatus();
  elements.caseHistory.innerHTML = '<div class="empty">No cases yet.</div>';
  elements.currentCase.innerHTML = '<div class="empty">No case analyzed yet.</div>';
}

function renderCase(record) {
  const entities = record.structured.entities
    .map(
      (entity) =>
        `<li class="item"><h3>${escapeHtml(entity.key)}</h3><p>${escapeHtml(entity.value)} | Confidence: ${Math.round(entity.confidence * 100)}%</p></li>`
    )
    .join("");

  const tasks = record.tasks
    .map(
      (task) =>
        `<li class="item"><h3>${escapeHtml(task.title)}</h3><p>Owner: ${escapeHtml(task.owner)} | Due in ${task.dueInDays} day(s) | Priority: ${task.priority}</p></li>`
    )
    .join("");

  const actions = record.actions
    .map((action) => {
      const status = action.status === "executed" ? `<div class="executed">Executed</div>` : "";
      const button =
        action.status === "proposed"
          ? `<button class="secondary" data-action-id="${action.id}" data-case-id="${record.id}">Approve + Execute</button>`
          : "";

      return `<li class="item">
        <h3>${escapeHtml(action.title)}</h3>
        <p>${escapeHtml(action.description)}</p>
        ${status}
        <pre>${escapeHtml(action.draft)}</pre>
        ${button}
      </li>`;
    })
    .join("");

  elements.currentCase.innerHTML = `
    <div class="meta">
      <div><strong>Vertical:</strong> ${escapeHtml(record.vertical)}</div>
      <div><strong>Channel:</strong> ${escapeHtml(record.channel)}</div>
      <div><strong>Summary:</strong> ${escapeHtml(record.structured.summary)}</div>
      <div><strong>Confidence:</strong> ${Math.round(record.structured.confidence * 100)}%</div>
    </div>
    <div class="chips">${record.structured.signals.map((signal) => `<span class="chip">${escapeHtml(signal)}</span>`).join("")}</div>
    <h2>Extracted Entities</h2>
    <ul class="list">${entities || "<li class=\"empty\">No entities extracted.</li>"}</ul>
    <h2>Tasks</h2>
    <ul class="list">${tasks}</ul>
    <h2>Actions</h2>
    <ul class="list">${actions}</ul>
  `;

  elements.currentCase.querySelectorAll("button[data-action-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const caseId = button.dataset.caseId;
      const actionId = button.dataset.actionId;
      await executeAction(caseId, actionId);
    });
  });
}

function renderCaseHistory(cases) {
  if (!cases.length) {
    elements.caseHistory.innerHTML = '<div class="empty">No cases yet.</div>';
    return;
  }

  elements.caseHistory.innerHTML = cases
    .map(
      (record) => `<div class="case-card">
        <div><strong>${escapeHtml(record.vertical)}</strong></div>
        <div>${new Date(record.createdAt).toLocaleString()}</div>
        <div>${escapeHtml(record.structured.summary)}</div>
        <button class="secondary" data-open-case="${record.id}">Open</button>
      </div>`
    )
    .join("");

  elements.caseHistory.querySelectorAll("button[data-open-case]").forEach((button) => {
    button.addEventListener("click", () => {
      const caseId = button.dataset.openCase;
      const record = cases.find((item) => item.id === caseId);
      if (record) {
        activeCaseId = caseId;
        renderCase(record);
      }
    });
  });
}

async function loadCases() {
  if (!currentUser) {
    elements.caseHistory.innerHTML = '<div class="empty">Sign in to load cases.</div>';
    return;
  }

  const vertical = elements.vertical.value;
  const records = await request(`/api/cases?vertical=${encodeURIComponent(vertical)}`, {
    method: "GET"
  });

  renderCaseHistory(records);

  if (!activeCaseId && records.length > 0) {
    activeCaseId = records[0].id;
    renderCase(records[0]);
  }
}

async function executeAction(caseId, actionId) {
  try {
    const updatedRecord = await request(`/api/cases/${caseId}/actions/${actionId}/execute`, {
      method: "POST",
      body: JSON.stringify({})
    });

    activeCaseId = updatedRecord.id;
    renderCase(updatedRecord);
    await loadCases();
  } catch (error) {
    setError(elements.ingestError, error.message);
  }
}

async function ingest() {
  setError(elements.ingestError, "");

  if (!currentUser) {
    setError(elements.ingestError, "Please login first.");
    return;
  }

  elements.analyzeBtn.disabled = true;
  elements.analyzeBtn.textContent = "Processing...";

  const payload = {
    vertical: elements.vertical.value,
    channel: elements.channel.value,
    content: elements.content.value,
    context: {
      customerName: elements.customerName.value || undefined,
      counterparty: elements.counterparty.value || undefined
    }
  };

  try {
    const record = await request("/api/ingest", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    activeCaseId = record.id;
    renderCase(record);
    await loadCases();
  } catch (error) {
    setError(elements.ingestError, error.message);
  } finally {
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.textContent = "Analyze + Generate Actions";
  }
}

elements.registerBtn.addEventListener("click", register);
elements.loginBtn.addEventListener("click", login);
elements.logoutBtn.addEventListener("click", logout);
elements.analyzeBtn.addEventListener("click", ingest);
elements.vertical.addEventListener("change", () => {
  activeCaseId = null;
  void loadCases();
});

if (!elements.content.value) {
  elements.content.value = `Client email:\nWe need 2 extra landing pages and one new checkout flow added this week.\nOriginal project fee was $4,500. Can you also include two more revisions before April 16?`;
}

void refreshSession().then(loadCases);
