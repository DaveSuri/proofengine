#!/usr/bin/env node
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {
  verifyFile,
  getQuota,
  resetQuota,
  purchaseSubscription,
} = require('./packages/solver-api/dist/index.js');

const PORT = Number(process.env.PORT || 4321);
const USERS_FILE =
  process.env.PROOFENGINE_USERS_FILE ||
  path.join(os.tmpdir(), 'proofengine-users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function resolveUserFromReq(req) {
  const apiKeyHeader = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = (apiKeyHeader || bearer || '').trim();
  if (!token) return null;

  const users = loadUsers();
  for (const u of Object.values(users)) {
    if (u.apiKey === token || u.sessionToken === token) {
      return u;
    }
  }
  return null;
}

const PRESETS = {
  proration_buggy: `// Stripe Mid-Cycle Proration (Buggy: per-seat floor rounding drift)
// @proofengine:boundary remaining_days in [1, 364]
// @proofengine:boundary seats in [2, 100]
// @proofengine:boundary annual_seat_price_cents == 120000
// @proofengine:boundary discount_rate == 0.175

export async function createMidCycleProrationAdjustment(
  remainingDays: number,
  seats: number,
  annualSeatPriceCents: number,
  discountRate: number,
) {
  const netSeatPriceCents = annualSeatPriceCents * (1 - discountRate);
  const expectedInvoiceAmount = Math.round(seats * netSeatPriceCents);

  // BUG: floors per-seat credit and per-seat balance before multiplying by seats
  const perSeatUnusedCredit = Math.floor((remainingDays / 365) * netSeatPriceCents);
  const totalCredits = seats * perSeatUnusedCredit;

  const perSeatUsedBalance = Math.floor(((365 - remainingDays) / 365) * netSeatPriceCents);
  const balanceDue = seats * perSeatUsedBalance;

  const drift = (totalCredits + balanceDue) - expectedInvoiceAmount;

  // @proofengine:invariant total_credits + balance_due == expected_invoice_amount
  return { totalCredits, balanceDue, expectedInvoiceAmount, drift };
}`,
  proration_fixed: `// Stripe Mid-Cycle Proration (Fixed: aggregate integer-cents conservation)
// @proofengine:boundary remaining_days in [1, 364]
// @proofengine:boundary seats in [2, 100]
// @proofengine:boundary annual_seat_price_cents == 120000
// @proofengine:boundary discount_rate == 0.175

export async function createMidCycleProrationAdjustment(
  remainingDays: number,
  seats: number,
  annualSeatPriceCents: number,
  discountRate: number,
) {
  const netSeatPriceCents = annualSeatPriceCents * (1 - discountRate);
  const expectedInvoiceAmount = Math.round(seats * netSeatPriceCents);

  // FIXED: round once on aggregate invoice amount and conserve remainder
  const totalCredits = Math.round((remainingDays / 365) * expectedInvoiceAmount);
  const balanceDue = expectedInvoiceAmount - totalCredits;
  const drift = (totalCredits + balanceDue) - expectedInvoiceAmount;

  // @proofengine:invariant total_credits + balance_due == expected_invoice_amount
  return { totalCredits, balanceDue, expectedInvoiceAmount, drift };
}`,
  coupon_exploit: `// Vibe Coder Disaster: Negative Balance / "Infinite Coupon" Exploit
// @proofengine:boundary base_price == 2900
// @proofengine:boundary coupon_discount in [0, 1000]
// @proofengine:boundary referral_credit in [0, 3000]

export function applyCouponAndReferral(
  basePrice: number,
  couponDiscount: number,
  referralCredit: number,
) {
  // BUG: missing Math.max(0, ...) clamp allows -$1.00 charge!
  const finalPrice = basePrice - couponDiscount - referralCredit;

  // @proofengine:invariant final_charge >= 0
  return finalPrice;
}`,
  webhook_idempotency: `// Enterprise Disaster: Non-Idempotent Stripe Webhook Double-Credit
// @proofengine:boundary state >= 0
// @proofengine:boundary top_up_amount > 0
// @proofengine:boundary event_id > 0

export function handleWebhookTopUp(state: number, topUpAmount: number, eventId: number) {
  // BUG: increments user credits before deduplication lock completes
  const stateAfterOnce = state + topUpAmount;
  const stateAfterRetry = stateAfterOnce + topUpAmount;
  const drift = stateAfterRetry - stateAfterOnce;

  // @proofengine:invariant f(state, event_id) == f(f(state, event_id), event_id)
  return { stateAfterOnce, stateAfterRetry, drift };
}`,
};

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ProofEngine — Symbolic Verification Studio</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0f19;
      color: #e2e8f0;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      background: #111827;
      border-bottom: 1px solid #1e293b;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      color: #f8fafc;
    }
    .badge {
      background: #0284c7;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
    }
    .quota-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    button {
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover { background: #0369a1; }
    button.secondary {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    button.secondary:hover { background: #334155; }
    button.upgrade {
      background: #eab308;
      color: #0f172a;
    }
    button.auth-btn {
      background: #10b981;
      color: #052e16;
    }
    .api-banner {
      display: none;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 8px 28px;
      font-size: 12.5px;
      color: #94a3b8;
    }
    .api-banner code {
      background: #1e293b;
      color: #38bdf8;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: "SFMono-Regular", Consolas, Menlo, monospace;
    }
    main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 18px 28px;
      height: calc(100vh - 108px);
    }
    .panel {
      display: flex;
      flex-direction: column;
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 10px;
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #1e293b;
      font-size: 13px;
      font-weight: 600;
    }
    .presets {
      display: flex;
      gap: 6px;
      padding: 10px 16px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      flex-wrap: wrap;
    }
    textarea {
      flex: 1;
      width: 100%;
      background: #0b0f19;
      color: #f8fafc;
      border: none;
      padding: 16px;
      font-family: "SFMono-Regular", Consolas, Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: none;
      outline: none;
    }
    .output {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      font-size: 13px;
    }
    .status-box {
      padding: 14px 16px;
      border-radius: 8px;
      margin-bottom: 14px;
      font-weight: 700;
      font-size: 15px;
    }
    .status-proven {
      background: rgba(22, 163, 74, 0.15);
      border: 1px solid #16a34a;
      color: #4ade80;
    }
    .status-violation {
      background: rgba(220, 38, 38, 0.15);
      border: 1px solid #dc2626;
      color: #f87171;
    }
    .status-payment {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid #eab308;
      color: #facc15;
    }
    pre {
      background: #0b0f19;
      border: 1px solid #1e293b;
      padding: 12px;
      border-radius: 6px;
      font-family: "SFMono-Regular", Consolas, Menlo, monospace;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: #111827;
      border: 1px solid #334155;
      border-radius: 12px;
      width: 400px;
      padding: 24px;
    }
    .modal h2 {
      margin: 0 0 6px 0;
      font-size: 18px;
    }
    .modal p {
      margin: 0 0 16px 0;
      font-size: 13px;
      color: #94a3b8;
    }
    .field {
      margin-bottom: 12px;
    }
    .field label {
      display: block;
      font-size: 12px;
      color: #cbd5e1;
      margin-bottom: 4px;
    }
    .field input {
      width: 100%;
      padding: 9px 12px;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #0b0f19;
      color: #f8fafc;
      font-size: 13px;
    }
    .modal-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
    }
    .error-msg {
      color: #f87171;
      font-size: 12px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>ProofEngine Studio</h1>
      <span class="badge">Z3 SMT-LIB2 Live Verifier</span>
    </div>
    <div class="quota-bar">
      <span id="userBadge">Guest Workspace</span>
      <span id="quotaText">Loading quota...</span>
      <button class="secondary" onclick="resetWorkspaceQuota()">Reset Quota</button>
      <button class="upgrade" onclick="upgradeWorkspace()">Authorize Dev Pro ($49/mo)</button>
      <button class="auth-btn" id="authBtn" onclick="openAuthModal()">Sign Up / Login</button>
    </div>
  </header>
  <div class="api-banner" id="apiBanner">
    <div>
      Signed in as <b id="bannerEmail"></b> · Personal API Key: <code id="bannerApiKey"></code>
    </div>
    <div>
      <button class="secondary" onclick="copyApiKey()">Copy API Key</button>
      <button class="secondary" onclick="logoutUser()">Logout</button>
    </div>
  </div>
  <main>
    <div class="panel">
      <div class="panel-header">
        <span>TypeScript Financial Code &amp; @proofengine Invariants</span>
        <button onclick="runVerification()">▶ Verify with Z3</button>
      </div>
      <div class="presets">
        <button class="secondary" onclick="loadPreset('proration_buggy')">1. Buggy Stripe Proration (VIOLATION)</button>
        <button class="secondary" onclick="loadPreset('proration_fixed')">2. Fixed Stripe Proration (PROVEN)</button>
        <button class="secondary" onclick="loadPreset('coupon_exploit')">3. Coupon Exploit (VIOLATION)</button>
        <button class="secondary" onclick="loadPreset('webhook_idempotency')">4. Webhook Double-Credit (VIOLATION)</button>
      </div>
      <textarea id="codeEditor"></textarea>
    </div>
    <div class="panel">
      <div class="panel-header">
        <span>Z3 Theorem Prover Result, Counterexample &amp; SMT-LIB2</span>
      </div>
      <div class="output" id="resultOutput">
        Click <b>▶ Verify with Z3</b> to run symbolic verification.
      </div>
    </div>
  </main>

  <div class="modal-backdrop" id="authModal">
    <div class="modal">
      <h2 id="modalTitle">Create Your ProofEngine Account</h2>
      <p id="modalSubtitle">Get 10 free Z3 symbolic verifications/month + personal API key.</p>
      <div class="field" id="nameField">
        <label>Full Name</label>
        <input type="text" id="authName" placeholder="Ada Lovelace" />
      </div>
      <div class="field">
        <label>Work Email</label>
        <input type="email" id="authEmail" placeholder="founder@company.com" />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" id="authPassword" placeholder="••••••••" />
      </div>
      <div class="error-msg" id="authError"></div>
      <div class="modal-actions">
        <button class="secondary" id="toggleModeBtn" onclick="toggleAuthMode()">Have an account? Login</button>
        <div>
          <button class="secondary" onclick="closeAuthModal()">Cancel</button>
          <button onclick="submitAuth()" id="submitAuthBtn">Sign Up</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const PRESETS = ${JSON.stringify(PRESETS)};
    const editor = document.getElementById('codeEditor');
    editor.value = PRESETS.proration_buggy;

    let authMode = 'signup';
    let currentUser = JSON.parse(localStorage.getItem('pe_user') || 'null');

    function getAuthHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (currentUser && currentUser.apiKey) {
        headers['x-api-key'] = currentUser.apiKey;
      }
      return headers;
    }

    function updateAuthUI() {
      const banner = document.getElementById('apiBanner');
      const authBtn = document.getElementById('authBtn');
      const userBadge = document.getElementById('userBadge');
      if (currentUser) {
        banner.style.display = 'flex';
        document.getElementById('bannerEmail').textContent = currentUser.name + ' (' + currentUser.email + ')';
        document.getElementById('bannerApiKey').textContent = currentUser.apiKey;
        authBtn.style.display = 'none';
        userBadge.textContent = currentUser.name;
      } else {
        banner.style.display = 'none';
        authBtn.style.display = 'inline-block';
        userBadge.textContent = 'Guest Workspace';
      }
    }

    function openAuthModal() {
      document.getElementById('authError').textContent = '';
      document.getElementById('authModal').style.display = 'flex';
    }

    function closeAuthModal() {
      document.getElementById('authModal').style.display = 'none';
    }

    function toggleAuthMode() {
      authMode = authMode === 'signup' ? 'login' : 'signup';
      document.getElementById('nameField').style.display = authMode === 'signup' ? 'block' : 'none';
      document.getElementById('modalTitle').textContent =
        authMode === 'signup' ? 'Create Your ProofEngine Account' : 'Sign In to ProofEngine';
      document.getElementById('submitAuthBtn').textContent = authMode === 'signup' ? 'Sign Up' : 'Login';
      document.getElementById('toggleModeBtn').textContent =
        authMode === 'signup' ? 'Have an account? Login' : 'Need an account? Sign Up';
    }

    async function submitAuth() {
      const name = document.getElementById('authName').value.trim();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const errEl = document.getElementById('authError');
      errEl.textContent = '';

      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        errEl.textContent = data.error || 'Authentication failed';
        return;
      }
      currentUser = data.user;
      localStorage.setItem('pe_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      await refreshQuota();
    }

    function copyApiKey() {
      if (currentUser && currentUser.apiKey) {
        navigator.clipboard.writeText(currentUser.apiKey);
        alert('Copied API key: ' + currentUser.apiKey);
      }
    }

    function logoutUser() {
      currentUser = null;
      localStorage.removeItem('pe_user');
      updateAuthUI();
      refreshQuota();
    }

    function loadPreset(key) {
      editor.value = PRESETS[key];
      runVerification();
    }

    async function refreshQuota() {
      const res = await fetch('/api/quota', { headers: getAuthHeaders() });
      const q = await res.json();
      document.getElementById('quotaText').textContent =
        'Tier: ' + q.tier.toUpperCase() + ' | Usage: ' + q.usedThisMonth + ' / ' + q.monthlyLimit;
    }

    async function resetWorkspaceQuota() {
      await fetch('/api/quota/reset', { method: 'POST', headers: getAuthHeaders() });
      await refreshQuota();
    }

    async function upgradeWorkspace() {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tier: 'dev-pro', autoApprove: true })
      });
      await refreshQuota();
      runVerification();
    }

    async function runVerification() {
      const out = document.getElementById('resultOutput');
      out.innerHTML = 'Running Z3 SMT solver...';
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ source: editor.value })
      });
      const data = await res.json();
      await refreshQuota();

      if (res.status === 402 || data.status === 'PAYMENT_REQUIRED') {
        const err = data.quotaError || data;
        out.innerHTML =
          '<div class="status-box status-payment">⚠ HTTP 402 — PAYMENT_REQUIRED</div>' +
          '<p>' + err.approval_prompt + '</p>' +
          '<pre>' + JSON.stringify(err, null, 2) + '</pre>';
        return;
      }

      const r = (data.results && data.results[0]) || {};
      const isProven = data.overallStatus === 'ALL_PROVEN';
      const boxClass = isProven ? 'status-proven' : 'status-violation';
      const icon = isProven ? '✔ ' : '✖ ';
      let html =
        '<div class="status-box ' + boxClass + '">' +
        icon + (r.statusLabel || data.overallStatus) + ' — ' + (r.invariant || '') +
        ' (' + data.totalDurationMs + 'ms)</div>';

      if (isProven && r.proofJwt) {
        html += '<h4>Signed HS256 Proof Attestation (proof.jwt)</h4><pre>' + r.proofJwt + '</pre>';
      }
      if (!isProven && r.counterexampleObject) {
        html += '<h4>Concrete Counterexample JSON Trace (SAT Model)</h4><pre>' +
          JSON.stringify(r.counterexampleObject, null, 2) + '</pre>';
      }
      if (data.programs && data.programs[0]) {
        html += '<h4>Generated SMT-LIB2 Program</h4><pre>' + data.programs[0].rawSmtLib + '</pre>';
      }
      out.innerHTML = html;
    }

    updateAuthUI();
    refreshQuota().then(() => runVerification());
  </script>
</body>
</html>`;

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_PAGE);
    return;
  }

  // POST /api/auth/signup
  if (req.method === 'POST' && req.url === '/api/auth/signup') {
    const { name, email, password } = await readBody(req);
    if (!email || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Email and password are required.' }));
      return;
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const users = loadUsers();
    if (users[cleanEmail]) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'An account with this email already exists.' }));
      return;
    }
    const id = crypto.randomBytes(8).toString('hex');
    const salt = crypto.randomBytes(16).toString('hex');
    const apiKey = 'pe_live_' + crypto.randomBytes(16).toString('hex');
    const workspaceId = 'user_' + id;
    const userRecord = {
      id,
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      salt,
      passwordHash: hashPassword(String(password), salt),
      apiKey,
      workspaceId,
      createdAt: new Date().toISOString(),
    };
    users[cleanEmail] = userRecord;
    saveUsers(users);
    const quota = getQuota(workspaceId);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          status: 'CREATED',
          user: {
            id: userRecord.id,
            name: userRecord.name,
            email: userRecord.email,
            apiKey: userRecord.apiKey,
            workspaceId: userRecord.workspaceId,
          },
          quota,
        },
        null,
        2,
      ),
    );
    return;
  }

  // POST /api/auth/login
  if (req.method === 'POST' && req.url === '/api/auth/login') {
    const { email, password } = await readBody(req);
    const cleanEmail = String(email || '').toLowerCase().trim();
    const users = loadUsers();
    const userRecord = users[cleanEmail];
    if (!userRecord || hashPassword(String(password || ''), userRecord.salt) !== userRecord.passwordHash) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid email or password.' }));
      return;
    }
    const quota = getQuota(userRecord.workspaceId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          status: 'AUTHENTICATED',
          user: {
            id: userRecord.id,
            name: userRecord.name,
            email: userRecord.email,
            apiKey: userRecord.apiKey,
            workspaceId: userRecord.workspaceId,
          },
          quota,
        },
        null,
        2,
      ),
    );
    return;
  }

  // GET /api/auth/me
  if (req.method === 'GET' && req.url === '/api/auth/me') {
    const user = resolveUserFromReq(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized. Provide x-api-key header.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            apiKey: user.apiKey,
            workspaceId: user.workspaceId,
          },
          quota: getQuota(user.workspaceId),
        },
        null,
        2,
      ),
    );
    return;
  }

  const user = resolveUserFromReq(req);
  const workspaceId = user ? user.workspaceId : undefined;

  if (req.method === 'GET' && req.url === '/api/quota') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getQuota(workspaceId), null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/quota/reset') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(resetQuota(workspaceId), null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/subscribe') {
    const parsed = await readBody(req);
    const sub = purchaseSubscription(
      parsed.tier || 'dev-pro',
      parsed.autoApprove !== false,
      workspaceId,
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sub, null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/verify') {
    try {
      const parsed = await readBody(req);
      const source = parsed.source || '';
      const result = await verifyFile({
        filePath: parsed.filePath || 'studio.ts',
        source,
        workspaceId: parsed.workspaceId || workspaceId,
        skipQuota: !!parsed.skipQuota,
      });
      const statusCode = result.overallStatus === 'QUOTA_EXCEEDED' ? 402 : 200;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ERROR', message: String(err) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`\n  🚀 ProofEngine Localhost Studio (with User Signup & API Keys) running at: http://localhost:${PORT}\n`);
});
