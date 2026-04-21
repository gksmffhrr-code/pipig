/* =========================================================
   대웅 디지털헬스 | 영업 파이프라인 트래커
   ========================================================= */

const PRODUCTS = [
  "씽크", "CGM Live", "카트ON", "카트BP", "CL note",
  "모비케어", "에티아", "옵티나&위스키", "더스피로킷",
  "리브레", "웰다"
];
const TEAM_PRODUCTS = {
  1: ["씽크", "CGM Live", "카트ON", "카트BP", "CL note"],
  2: ["씽크", "CGM Live", "카트ON", "카트BP", "CL note"],
  3: ["모비케어", "에티아", "옵티나&위스키", "더스피로킷"],
  4: ["리브레", "웰다"],
};
function productsForUser() {
  if (State.user && State.user.role === "team" && State.user.team) return TEAM_PRODUCTS[State.user.team] || PRODUCTS;
  return PRODUCTS;
}
function productsForTeam(team) { return TEAM_PRODUCTS[team] || PRODUCTS; }
const STAGES = [
  { key: "제품설명회", color: "#64748b" },
  { key: "데모",       color: "#0ea5e9" },
  { key: "계약",       color: "#6366f1" },
  { key: "첫처방",     color: "#10b981" },
];
const TERMINAL_STAGE = "첫처방";
const SLA_WARN = 14;  // days
const SLA_BAD = 30;

/* ---------- Accounts (login) ---------- */
const ACCOUNTS = {
  "MKT0": { id: "MKT0", name: "이현주",       role: "marketing" },
  "MKT1": { id: "MKT1", name: "백정현",       role: "marketing" },
  "MKT2": { id: "MKT2", name: "조병하",       role: "marketing" },
  "MKT3": { id: "MKT3", name: "마케터3",      role: "marketing" },
  "MKT4": { id: "MKT4", name: "마케터4",      role: "marketing" },
  "MKT5": { id: "MKT5", name: "마케터5",      role: "marketing" },
  "dh1":  { id: "dh1",  name: "디지털헬스1팀", role: "team", team: 1, password: "dhcksgjs"    },
  "dh2":  { id: "dh2",  name: "디지털헬스2팀", role: "team", team: 2, password: "qorwjdgus"   },
  "dh3":  { id: "dh3",  name: "디지털헬스3팀", role: "team", team: 3, password: "dleodud"     },
  "dh4":  { id: "dh4",  name: "디지털헬스4팀", role: "team", team: 4, password: "ghkdemrrud"  },
};
const TEAMS = [
  { n: 1, label: "디지털헬스1팀", color: "#0ea5e9" },
  { n: 2, label: "디지털헬스2팀", color: "#6366f1" },
  { n: 3, label: "디지털헬스3팀", color: "#a855f7" },
  { n: 4, label: "디지털헬스4팀", color: "#f59e0b" },
];

/* ---------- State ---------- */
const State = {
  user: null,
  hq: "all",
  div: "",
  office: "",
  rep: "",
  product: "",
  pipelines: [],
  conferences: [],
  editingId: null,
  editingConfId: null,
  accSelected: null,
  confAccSelected: null,
};

/* ---------- Storage ---------- */
const LS_KEY = "dw_pipeline_v1";
const LS_CONF_KEY = "dw_conferences_v1";
const LS_USER = "dw_pipeline_user_v1";

function loadPipelines() {
  try { State.pipelines = JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { State.pipelines = []; }
}
function savePipelines() {
  localStorage.setItem(LS_KEY, JSON.stringify(State.pipelines));
}
function loadConferences() {
  try { State.conferences = JSON.parse(localStorage.getItem(LS_CONF_KEY)) || []; }
  catch { State.conferences = []; }
}
function saveConferences() {
  localStorage.setItem(LS_CONF_KEY, JSON.stringify(State.conferences));
}

/* ---------- Org Data helpers ---------- */
const OD = window.ORG_DATA;
// row = [hqIdx, divIdx, officeIdx, repIdx, code, name]
function decodeRow(r) {
  return {
    hq: OD.hq[r[0]],
    div: OD.div[r[1]],
    office: OD.office[r[2]],
    rep: OD.rep[r[3]],
    code: r[4],
    name: r[5],
  };
}
function findAccount(code) {
  const r = OD.rows.find(row => row[4] === code);
  return r ? decodeRow(r) : null;
}
function getFilteredRows() {
  return OD.rows.filter(r => {
    const d = decodeRow(r);
    if (State.hq !== "all" && d.hq !== State.hq) return false;
    if (State.div && d.div !== State.div) return false;
    if (State.office && d.office !== State.office) return false;
    if (State.rep && d.rep !== State.rep) return false;
    return true;
  });
}

/* ---------- Cascading filter options ---------- */
function updateFilterOptions() {
  // Build options based on current 본부 selection
  const visible = OD.rows.filter(r => State.hq === "all" || OD.hq[r[0]] === State.hq);
  const divSet = new Set(visible.map(r => OD.div[r[1]]));
  const offSet = new Set(visible.filter(r => !State.div || OD.div[r[1]] === State.div).map(r => OD.office[r[2]]));
  const repSet = new Set(visible.filter(r =>
    (!State.div || OD.div[r[1]] === State.div) &&
    (!State.office || OD.office[r[2]] === State.office)
  ).map(r => OD.rep[r[3]]));

  fillSelect("fDiv", [...divSet].sort(), "전체 사업부", State.div);
  fillSelect("fOffice", [...offSet].sort(), "전체 사무소", State.office);
  fillSelect("fRep", [...repSet].sort(), "전체 담당자", State.rep);
  fillSelect("fProduct", productsForUser(), "전체 품목", State.product);
}
function fillSelect(id, arr, placeholder, selected) {
  const el = document.getElementById(id);
  el.innerHTML = `<option value="">${placeholder}</option>` +
    arr.map(v => `<option value="${v}" ${v===selected?"selected":""}>${v}</option>`).join("");
}

/* ---------- Pipeline filtering ---------- */
function getFilteredPipelines() {
  return State.pipelines.filter(p => {
    if (State.hq !== "all" && p.hq !== State.hq) return false;
    if (State.div && p.div !== State.div) return false;
    if (State.office && p.office !== State.office) return false;
    if (State.rep && p.rep !== State.rep) return false;
    if (State.product && p.product !== State.product) return false;
    return true;
  });
}

/* ---------- SLA ---------- */
function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function slaStatus(p) {
  if (p.stage === TERMINAL_STAGE) return "ok";
  const d = daysSince(p.updatedAt);
  if (d >= SLA_BAD) return "bad";
  if (d >= SLA_WARN) return "warn";
  return "ok";
}

/* ---------- LOGIN ---------- */
function initLogin() {
  const select = document.getElementById("loginSelect");
  const codeInput = document.getElementById("loginCode");
  const passInput = document.getElementById("loginPass");
  const btn = document.getElementById("loginBtn");

  const tryAutoLogin = () => {
    const saved = localStorage.getItem(LS_USER);
    if (saved) { try { State.user = JSON.parse(saved); showApp(); return true; } catch {} }
    return false;
  };
  if (tryAutoLogin()) return;

  btn.addEventListener("click", () => {
    let id;
    if (select.value) id = select.value;
    else if (codeInput.value) id = codeInput.value.trim();
    else { alert("계정을 선택하거나 ID를 입력하세요."); return; }

    const acc = ACCOUNTS[id] || ACCOUNTS[id.toUpperCase()] || ACCOUNTS[id.toLowerCase()];
    if (!acc) { alert("존재하지 않는 계정입니다."); return; }

    if (acc.role === "team") {
      const pw = passInput.value;
      if (!pw) { alert("비밀번호를 입력하세요."); return; }
      if (pw !== acc.password) { alert("비밀번호가 일치하지 않습니다."); return; }
    }

    State.user = { id: acc.id, name: acc.name, role: acc.role, team: acc.team || null };
    localStorage.setItem(LS_USER, JSON.stringify(State.user));
    showApp();
  });

  const updatePassVisibility = () => {
    const id = select.value || codeInput.value.trim();
    const acc = ACCOUNTS[id] || ACCOUNTS[(id||"").toUpperCase()] || ACCOUNTS[(id||"").toLowerCase()];
    const wrap = document.getElementById("loginPassWrap");
    if (acc && acc.role === "team") wrap.classList.remove("hidden");
    else wrap.classList.add("hidden");
  };
  select.addEventListener("change", () => { codeInput.value = ""; updatePassVisibility(); });
  codeInput.addEventListener("input", () => { select.value = ""; updatePassVisibility(); });
}
function showApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("hidden");
  const roleTag = State.user.role === "team" ? " · 팀" : " · 마케팅";
  document.getElementById("userBadge").textContent = `${State.user.name} (${State.user.id})${roleTag}`;
  renderAll();
}

/* ---------- TABS ---------- */
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(x => { x.classList.remove("tab-active"); x.classList.add("text-slate-600"); });
      b.classList.add("tab-active"); b.classList.remove("text-slate-600");
      document.querySelectorAll(".tab-content").forEach(s => s.classList.add("hidden"));
      document.getElementById("tab-" + b.dataset.tab).classList.remove("hidden");
      renderCurrentTab();
    });
  });
}
function currentTab() {
  const active = document.querySelector(".tab-btn.tab-active");
  return active ? active.dataset.tab : "overview";
}

/* ---------- HQ Toggle (핵심 요구사항) ---------- */
function initHqToggle() {
  document.querySelectorAll(".hq-btn").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".hq-btn").forEach(x => x.classList.remove("active","active-local","active-hosp"));
      const hq = b.dataset.hq;
      State.hq = hq;
      if (hq === "all") b.classList.add("active");
      else if (hq === "로컬") b.classList.add("active-local");
      else if (hq === "병원") b.classList.add("active-hosp");
      // Reset downstream filters since they depend on HQ
      State.div = ""; State.office = ""; State.rep = "";
      updateFilterOptions();
      renderAll();
    });
  });
}

/* ---------- Filter events ---------- */
function initFilters() {
  document.getElementById("fDiv").addEventListener("change", e => {
    State.div = e.target.value; State.office = ""; State.rep = "";
    updateFilterOptions(); renderAll();
  });
  document.getElementById("fOffice").addEventListener("change", e => {
    State.office = e.target.value; State.rep = "";
    updateFilterOptions(); renderAll();
  });
  document.getElementById("fRep").addEventListener("change", e => {
    State.rep = e.target.value; renderAll();
  });
  document.getElementById("fProduct").addEventListener("change", e => {
    State.product = e.target.value; renderAll();
  });
  document.getElementById("resetFilter").addEventListener("click", () => {
    State.hq = "all"; State.div = ""; State.office = ""; State.rep = ""; State.product = "";
    document.querySelectorAll(".hq-btn").forEach(x => x.classList.remove("active","active-local","active-hosp"));
    document.querySelector('.hq-btn[data-hq="all"]').classList.add("active");
    updateFilterOptions(); renderAll();
  });
}

/* ---------- HEADER ACTIONS ---------- */
function initHeaderActions() {
  document.getElementById("refreshBtn").addEventListener("click", () => { loadPipelines(); loadConferences(); renderAll(); });
  document.getElementById("addBtn").addEventListener("click", () => {
    if (currentTab() === "conferences") openConfModal();
    else openModal();
  });
  document.getElementById("slaBtn").addEventListener("click", () => runSlaCheck());
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      localStorage.removeItem(LS_USER);
      location.reload();
    }
  });
}
function runSlaCheck() {
  const f = getFilteredPipelines();
  const warn = f.filter(p => slaStatus(p) === "warn").length;
  const bad = f.filter(p => slaStatus(p) === "bad").length;
  alert(`SLA 점검 결과\n• 경고 (14일 이상): ${warn}건\n• 위반 (30일 이상): ${bad}건\n\n[알림 센터] 탭에서 상세 확인 가능`);
  document.querySelector('.tab-btn[data-tab="alerts"]').click();
}

/* ---------- RENDER ---------- */
function renderAll() {
  updateFilterOptions();
  renderCurrentTab();
}
function renderCurrentTab() {
  const t = currentTab();
  if (t === "overview") renderOverview();
  else if (t === "pipeline") renderKanban();
  else if (t === "mytasks") renderMyTasks();
  else if (t === "alerts") renderAlerts();
  else if (t === "report") renderReport();
  else if (t === "accounts") renderAccounts();
  else if (t === "conferences") renderConferences();
  updateAddButton();
}
function updateAddButton() {
  const btn = document.getElementById("addBtn");
  btn.textContent = currentTab() === "conferences" ? "+ 학회 등록" : "+ 파이프라인 등록";
}

/* ---------- OVERVIEW ---------- */
let _chartP, _chartS;
function renderOverview() {
  const f = getFilteredPipelines();
  const active = f.filter(p => p.stage !== TERMINAL_STAGE);
  const won = f.filter(p => p.stage === TERMINAL_STAGE);
  const sla = f.filter(p => slaStatus(p) === "bad");
  document.getElementById("kpiTotal").textContent = f.length;
  document.getElementById("kpiActive").textContent = active.length;
  document.getElementById("kpiWon").textContent = won.length;
  document.getElementById("kpiSla").textContent = sla.length;

  // Product chart
  const byProd = PRODUCTS.map(p => f.filter(x => x.product === p).length);
  if (_chartP) _chartP.destroy();
  _chartP = new Chart(document.getElementById("chartProduct"), {
    type: "bar",
    data: {
      labels: PRODUCTS,
      datasets: [{
        data: byProd,
        backgroundColor: "#0ea5e9",
        borderRadius: 6,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  // Stage chart
  const byStage = STAGES.map(s => f.filter(x => x.stage === s.key).length);
  if (_chartS) _chartS.destroy();
  _chartS = new Chart(document.getElementById("chartStage"), {
    type: "doughnut",
    data: {
      labels: STAGES.map(s => s.key),
      datasets: [{
        data: byStage,
        backgroundColor: STAGES.map(s => s.color),
      }]
    },
    options: { plugins: { legend: { position: "right" } } }
  });

  // HQ × Product matrix
  const hqs = State.hq === "all" ? ["로컬","병원"] : [State.hq];
  let html = `<table class="w-full text-sm">
    <thead class="bg-slate-50"><tr>
      <th class="px-3 py-2 text-left font-medium text-slate-600">본부</th>
      ${PRODUCTS.map(p => `<th class="px-3 py-2 text-center font-medium text-slate-600">${p}</th>`).join("")}
      <th class="px-3 py-2 text-center font-medium text-slate-600">합계</th>
    </tr></thead><tbody>`;
  hqs.forEach(hq => {
    const sub = f.filter(x => x.hq === hq);
    html += `<tr class="border-t border-slate-100"><td class="px-3 py-2 font-semibold">${hq}</td>`;
    let sum = 0;
    PRODUCTS.forEach(p => {
      const c = sub.filter(x => x.product === p).length;
      sum += c;
      html += `<td class="px-3 py-2 text-center ${c?"":"text-slate-300"}">${c}</td>`;
    });
    html += `<td class="px-3 py-2 text-center font-bold text-sky-600">${sum}</td></tr>`;
  });
  html += `</tbody></table>`;
  document.getElementById("hqMatrix").innerHTML = html;
}

/* ---------- KANBAN ---------- */
function renderKanban() {
  const f = getFilteredPipelines();
  const board = document.getElementById("kanbanBoard");
  board.innerHTML = STAGES.map(s => {
    const items = f.filter(p => p.stage === s.key);
    return `
      <div class="kanban-col bg-slate-100 rounded-xl p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" style="background:${s.color}"></span>
            <span class="font-semibold text-sm">${s.key}</span>
          </div>
          <span class="text-xs bg-white px-2 py-0.5 rounded-full">${items.length}</span>
        </div>
        <div class="space-y-2 max-h-[65vh] overflow-y-auto scrollbar-thin">
          ${items.map(cardHtml).join("") || '<div class="text-xs text-slate-400 text-center py-6">없음</div>'}
        </div>
      </div>`;
  }).join("");
  // Bind
  board.querySelectorAll(".pipe-card").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });
}
function cardHtml(p) {
  const sla = slaStatus(p);
  const slaCls = sla === "bad" ? "sla-bad" : sla === "warn" ? "sla-warn" : "sla-ok";
  const hqBadge = p.hq === "로컬"
    ? '<span class="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">로컬</span>'
    : '<span class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">병원</span>';
  const d = daysSince(p.updatedAt);
  return `
    <div class="pipe-card bg-white rounded-lg p-3 ${slaCls}" data-id="${p.id}">
      <div class="flex items-center gap-1.5 mb-1 flex-wrap">
        ${hqBadge}
        <span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${p.product}</span>
      </div>
      <div class="font-semibold text-sm text-slate-900 leading-tight">${p.accName}</div>
      <div class="text-[11px] text-slate-500 mt-0.5">${p.office} · ${p.rep}</div>
      ${p.notes ? `<div class="text-xs text-slate-600 mt-1.5 line-clamp-2">${escapeHtml(p.notes)}</div>` : ""}
      <div class="flex items-center justify-between mt-2 text-[11px]">
        <span class="text-slate-400">${d}일 전 업데이트</span>
        ${p.nextDate ? `<span class="text-amber-600">📅 ${p.nextDate}</span>` : ""}
      </div>
    </div>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---------- MY TASKS ---------- */
function renderMyTasks() {
  // Owned by current marketer
  const mine = State.pipelines.filter(p => p.ownerId === State.user.id);
  mine.sort((a,b) => (a.nextDate||"9999").localeCompare(b.nextDate||"9999"));
  document.getElementById("myTaskCount").textContent = `${mine.length}건`;
  const list = document.getElementById("myTasksList");
  if (!mine.length) {
    list.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">담당 파이프라인이 없습니다. 상단 [+ 파이프라인 등록]으로 추가하세요.</div>';
    return;
  }
  list.innerHTML = mine.map(p => {
    const sla = slaStatus(p);
    const badge = sla === "bad" ? '<span class="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded">SLA 위반</span>'
                : sla === "warn" ? '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">경고</span>' : "";
    return `<div class="p-4 hover:bg-slate-50 cursor-pointer" onclick="openModal('${p.id}')">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-xs font-semibold text-slate-900">${p.accName}</span>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${p.product}</span>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${p.stage}</span>
            ${badge}
          </div>
          <div class="text-xs text-slate-500">${p.hq} · ${p.div} · ${p.office} · ${p.rep}</div>
          ${p.nextAction ? `<div class="text-xs text-slate-700 mt-1">다음 활동: ${escapeHtml(p.nextAction)}</div>` : ""}
        </div>
        <div class="text-right">
          ${p.nextDate ? `<div class="text-xs text-amber-600 font-medium">📅 ${p.nextDate}</div>` : '<div class="text-xs text-slate-400">일정 미정</div>'}
          <div class="text-[11px] text-slate-400 mt-1">${daysSince(p.updatedAt)}일 전</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ---------- ALERTS ---------- */
function renderAlerts() {
  const f = getFilteredPipelines().filter(p => p.stage !== TERMINAL_STAGE);
  const withSla = f.map(p => ({p, s: slaStatus(p), d: daysSince(p.updatedAt)}))
                    .filter(x => x.s !== "ok")
                    .sort((a,b) => b.d - a.d);
  const list = document.getElementById("alertsList");
  if (!withSla.length) {
    list.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">SLA 경보 대상 없음 ✅</div>';
    return;
  }
  list.innerHTML = withSla.map(({p,s,d}) => {
    const chip = s === "bad" ? '<span class="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded">위반 (30일+)</span>'
                             : '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">경고 (14일+)</span>';
    return `<div class="p-4 hover:bg-slate-50 cursor-pointer" onclick="openModal('${p.id}')">
      <div class="flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            ${chip}
            <span class="text-xs font-semibold">${p.accName}</span>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${p.product}</span>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${p.stage}</span>
          </div>
          <div class="text-xs text-slate-500">${p.hq} · ${p.office} · ${p.rep} · 담당 마케터 ${p.ownerName||p.ownerId}</div>
        </div>
        <div class="text-sm font-bold text-rose-600">${d}일</div>
      </div>
    </div>`;
  }).join("");
}

/* ---------- REPORT ---------- */
function renderReport() {
  const f = getFilteredPipelines();
  // HQ × Division × Product
  const divs = [...new Set(f.map(p => `${p.hq}|${p.div}`))].sort();
  let html = `<table class="w-full text-sm"><thead class="bg-slate-50"><tr>
    <th class="px-3 py-2 text-left font-medium text-slate-600">본부</th>
    <th class="px-3 py-2 text-left font-medium text-slate-600">사업부</th>
    ${PRODUCTS.map(p=>`<th class="px-3 py-2 text-center font-medium text-slate-600">${p}</th>`).join("")}
    <th class="px-3 py-2 text-center font-medium text-slate-600">첫처방</th>
    <th class="px-3 py-2 text-center font-medium text-slate-600">합계</th>
  </tr></thead><tbody>`;
  divs.forEach(d => {
    const [hq, div] = d.split("|");
    const sub = f.filter(p => p.hq === hq && p.div === div);
    let sum = 0;
    html += `<tr class="border-t border-slate-100"><td class="px-3 py-2">${hq}</td><td class="px-3 py-2">${div}</td>`;
    PRODUCTS.forEach(p => {
      const c = sub.filter(x => x.product === p).length;
      sum += c;
      html += `<td class="px-3 py-2 text-center ${c?"":"text-slate-300"}">${c}</td>`;
    });
    const won = sub.filter(x => x.stage === TERMINAL_STAGE).length;
    html += `<td class="px-3 py-2 text-center text-emerald-600 font-semibold">${won}</td>`;
    html += `<td class="px-3 py-2 text-center font-bold">${sum}</td></tr>`;
  });
  if (!divs.length) html += `<tr><td colspan="${PRODUCTS.length+4}" class="px-3 py-8 text-center text-slate-400 text-sm">데이터 없음</td></tr>`;
  html += `</tbody></table>`;
  document.getElementById("reportTable").innerHTML = html;

  // Rep ranking
  const byRep = {};
  f.forEach(p => {
    byRep[p.rep] = byRep[p.rep] || { rep: p.rep, hq: p.hq, office: p.office, total: 0, won: 0 };
    byRep[p.rep].total++;
    if (p.stage === TERMINAL_STAGE) byRep[p.rep].won++;
  });
  const ranked = Object.values(byRep).sort((a,b) => b.total - a.total).slice(0, 10);
  let rh = `<table class="w-full text-sm"><thead class="bg-slate-50"><tr>
    <th class="px-3 py-2 text-left font-medium text-slate-600 w-12">#</th>
    <th class="px-3 py-2 text-left font-medium text-slate-600">담당자</th>
    <th class="px-3 py-2 text-left font-medium text-slate-600">본부 · 사무소</th>
    <th class="px-3 py-2 text-center font-medium text-slate-600">파이프라인</th>
    <th class="px-3 py-2 text-center font-medium text-slate-600">첫처방</th>
  </tr></thead><tbody>`;
  ranked.forEach((r,i) => {
    rh += `<tr class="border-t border-slate-100">
      <td class="px-3 py-2">${i+1}</td>
      <td class="px-3 py-2 font-semibold">${r.rep}</td>
      <td class="px-3 py-2 text-slate-600">${r.hq} · ${r.office}</td>
      <td class="px-3 py-2 text-center">${r.total}</td>
      <td class="px-3 py-2 text-center text-emerald-600 font-semibold">${r.won}</td>
    </tr>`;
  });
  if (!ranked.length) rh += `<tr><td colspan="5" class="px-3 py-8 text-center text-slate-400 text-sm">데이터 없음</td></tr>`;
  rh += `</tbody></table>`;
  document.getElementById("repRanking").innerHTML = rh;
}

/* ---------- ACCOUNTS ---------- */
function renderAccounts() {
  const rows = getFilteredRows();
  const search = document.getElementById("accSearch").value.trim().toLowerCase();
  const filtered = search
    ? rows.filter(r => {
        const d = decodeRow(r);
        return d.name.toLowerCase().includes(search) ||
               String(d.code).includes(search) ||
               d.rep.toLowerCase().includes(search);
      })
    : rows;
  const show = filtered.slice(0, 500); // virtual-ish: limit to 500 for performance
  document.getElementById("accCount").textContent = `${filtered.length.toLocaleString()}개 거래처${filtered.length > 500 ? " (500개 표시)" : ""}`;

  const tbody = document.getElementById("accTbody");
  // Count pipelines per account code
  const pipeCount = {};
  State.pipelines.forEach(p => { pipeCount[p.accCode] = (pipeCount[p.accCode]||0) + 1; });

  tbody.innerHTML = show.map(r => {
    const d = decodeRow(r);
    const pc = pipeCount[d.code] || 0;
    const hqBadge = d.hq === "로컬"
      ? '<span class="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">로컬</span>'
      : '<span class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">병원</span>';
    return `<tr class="border-t border-slate-100 hover:bg-slate-50">
      <td class="px-3 py-2">${hqBadge}</td>
      <td class="px-3 py-2">${d.div}</td>
      <td class="px-3 py-2">${d.office}</td>
      <td class="px-3 py-2">${d.rep}</td>
      <td class="px-3 py-2 text-slate-500 font-mono text-xs">${d.code}</td>
      <td class="px-3 py-2 font-medium">${d.name}</td>
      <td class="px-3 py-2">
        <button onclick="openModalForAccount('${d.code}')" class="text-xs ${pc?'text-sky-600 font-semibold':'text-slate-400'} hover:underline">
          ${pc?`${pc}건 · +추가`:'+ 등록'}
        </button>
      </td>
    </tr>`;
  }).join("");
}

/* ---------- MODAL ---------- */
function refreshPipelineProducts(includeValue) {
  const list = [...productsForUser()];
  if (includeValue && !list.includes(includeValue)) list.push(includeValue);
  document.getElementById("mProduct").innerHTML = list.map(p => `<option value="${p}">${p}</option>`).join("");
}
function initModal() {
  refreshPipelineProducts();
  const mStage = document.getElementById("mStage");
  mStage.innerHTML = STAGES.map(s => `<option value="${s.key}">${s.key}</option>`).join("");

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("mCancel").addEventListener("click", closeModal);
  document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.getElementById("mSave").addEventListener("click", savePipeline);
  document.getElementById("mDelete").addEventListener("click", deletePipeline);

  // Account search
  const searchEl = document.getElementById("mAccSearch");
  const sugg = document.getElementById("mAccSuggest");
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (q.length < 2) { sugg.classList.add("hidden"); return; }
    const matches = OD.rows.filter(r => {
      const name = r[5].toLowerCase();
      return name.includes(q);
    }).slice(0, 10);
    if (!matches.length) { sugg.classList.add("hidden"); return; }
    sugg.innerHTML = matches.map(r => {
      const d = decodeRow(r);
      return `<div class="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm" data-code="${d.code}">
        <div class="font-medium">${d.name}</div>
        <div class="text-xs text-slate-500">${d.hq} · ${d.office} · ${d.rep}</div>
      </div>`;
    }).join("");
    sugg.classList.remove("hidden");
    sugg.querySelectorAll("[data-code]").forEach(el => {
      el.addEventListener("click", () => {
        State.accSelected = findAccount(el.dataset.code);
        showSelectedAcc();
        sugg.classList.add("hidden");
        searchEl.value = "";
      });
    });
  });
}
function showSelectedAcc() {
  const el = document.getElementById("mAccSelected");
  if (!State.accSelected) { el.innerHTML = ""; return; }
  const a = State.accSelected;
  el.innerHTML = `<div class="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
    <div class="font-semibold text-sm">${a.name} <span class="text-xs font-normal text-slate-500 ml-1">${a.code}</span></div>
    <div class="text-xs text-slate-600">${a.hq} · ${a.div} · ${a.office} · ${a.rep}</div>
  </div>`;
}
function openModal(id) {
  State.editingId = id || null;
  State.accSelected = null;
  document.getElementById("modal").classList.add("show");
  document.getElementById("modalTitle").textContent = id ? "파이프라인 수정" : "파이프라인 등록";
  document.getElementById("mDelete").classList.toggle("hidden", !id);
  document.getElementById("mAccSearch").value = "";
  document.getElementById("mAccSuggest").classList.add("hidden");
  document.getElementById("mAccSelected").innerHTML = "";

  if (id) {
    const p = State.pipelines.find(x => x.id === id);
    if (!p) return;
    State.accSelected = findAccount(p.accCode) || { hq:p.hq, div:p.div, office:p.office, rep:p.rep, code:p.accCode, name:p.accName };
    showSelectedAcc();
    refreshPipelineProducts(p.product);
    document.getElementById("mProduct").value = p.product;
    document.getElementById("mStage").value = p.stage;
    document.getElementById("mNotes").value = p.notes || "";
    document.getElementById("mNextAction").value = p.nextAction || "";
    document.getElementById("mNextDate").value = p.nextDate || "";
  } else {
    refreshPipelineProducts();
    const list = productsForUser();
    document.getElementById("mProduct").value = list[0];
    document.getElementById("mStage").value = STAGES[0].key;
    document.getElementById("mNotes").value = "";
    document.getElementById("mNextAction").value = "";
    document.getElementById("mNextDate").value = "";
  }
}
function openModalForAccount(code) {
  openModal();
  State.accSelected = findAccount(code);
  showSelectedAcc();
}
function closeModal() {
  document.getElementById("modal").classList.remove("show");
  State.editingId = null;
  State.accSelected = null;
}
function savePipeline() {
  if (!State.accSelected) { alert("거래처를 선택하세요."); return; }
  const product = document.getElementById("mProduct").value;
  const stage = document.getElementById("mStage").value;
  const notes = document.getElementById("mNotes").value.trim();
  const nextAction = document.getElementById("mNextAction").value.trim();
  const nextDate = document.getElementById("mNextDate").value;
  const now = new Date().toISOString();
  const a = State.accSelected;

  if (State.editingId) {
    const p = State.pipelines.find(x => x.id === State.editingId);
    if (!p) return;
    const stageChanged = p.stage !== stage;
    Object.assign(p, {
      accCode: a.code, accName: a.name, hq: a.hq, div: a.div, office: a.office, rep: a.rep,
      product, stage, notes, nextAction, nextDate,
      updatedAt: now,
      history: [...(p.history||[]), { at: now, user: State.user.id, action: stageChanged ? `단계 변경 → ${stage}` : "수정" }],
    });
  } else {
    State.pipelines.push({
      id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
      accCode: a.code, accName: a.name, hq: a.hq, div: a.div, office: a.office, rep: a.rep,
      product, stage, notes, nextAction, nextDate,
      ownerId: State.user.id, ownerName: State.user.name,
      createdAt: now, updatedAt: now,
      history: [{ at: now, user: State.user.id, action: "등록" }],
    });
  }
  savePipelines();
  closeModal();
  renderAll();
}
function deletePipeline() {
  if (!State.editingId) return;
  if (!confirm("이 파이프라인을 삭제하시겠습니까?")) return;
  State.pipelines = State.pipelines.filter(p => p.id !== State.editingId);
  savePipelines();
  closeModal();
  renderAll();
}

/* ---------- CONFERENCES ---------- */
function confProducts(c) {
  const set = new Set();
  if (c.ads?.luncheon?.enabled && c.ads.luncheon.product) set.add(c.ads.luncheon.product);
  if (c.ads?.insert?.enabled && c.ads.insert.product) set.add(c.ads.insert.product);
  (c.ads?.booths || []).forEach(b => { if (b.product) set.add(b.product); });
  return [...set];
}
function getFilteredConferences() {
  return State.conferences.filter(c => {
    if (State.hq !== "all" && c.hq && c.hq !== State.hq) return false;
    if (State.div && c.div && c.div !== State.div) return false;
    if (State.office && c.office && c.office !== State.office) return false;
    if (State.rep && c.rep && c.rep !== State.rep) return false;
    if (State.product && !confProducts(c).includes(State.product)) return false;
    return true;
  });
}
function fmtMoney(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  if (!isFinite(n)) return "";
  return n.toLocaleString("ko-KR") + "원";
}
function renderConferences() {
  const list = getFilteredConferences().slice().sort((a, b) => {
    const ad = a.startDate || a.createdAt || "";
    const bd = b.startDate || b.createdAt || "";
    return bd.localeCompare(ad);
  });
  const container = document.getElementById("confList");
  document.getElementById("confCount").textContent = `${list.length}건`;
  if (!list.length) {
    container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400 text-sm">학회 기록 없음. 상단 [+ 학회 등록] 버튼으로 추가하세요.</div>';
    return;
  }
  container.innerHTML = list.map(confCardHtml).join("");
  container.querySelectorAll(".conf-card").forEach(el => el.addEventListener("click", () => openConfModal(el.dataset.id)));
}
function confCardHtml(c) {
  const dateStr = c.startDate && c.endDate ? `${c.startDate} ~ ${c.endDate}`
                : c.startDate ? c.startDate
                : c.endDate ? `~ ${c.endDate}` : "";
  const hqBadge = !c.hq ? "" : c.hq === "로컬"
    ? '<span class="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">로컬</span>'
    : '<span class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">병원</span>';
  const adsHtml = [];
  if (c.ads?.luncheon?.enabled) adsHtml.push(`<div class="text-[11px] text-slate-600">🍽️ <span class="font-medium">런천</span> ${escapeHtml(c.ads.luncheon.product || "—")}</div>`);
  const booths = (c.ads?.booths || []).filter(b => b.product);
  if (booths.length) adsHtml.push(`<div class="text-[11px] text-slate-600">🏬 <span class="font-medium">부스</span> ${booths.map(b => escapeHtml(b.product)).join(", ")}</div>`);
  if (c.ads?.insert?.enabled) adsHtml.push(`<div class="text-[11px] text-slate-600">📄 <span class="font-medium">내지</span> ${escapeHtml(c.ads.insert.product || "—")}</div>`);
  return `<div class="conf-card bg-white rounded-xl p-4 border border-slate-100 cursor-pointer hover:shadow-md transition" data-id="${c.id}">
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="font-semibold text-sm text-slate-900 leading-tight flex-1">${escapeHtml(c.confName)}</div>
      ${hqBadge}
    </div>
    ${dateStr ? `<div class="text-[11px] text-slate-500 mb-1">📅 ${dateStr}</div>` : ""}
    ${c.accName ? `<div class="text-[11px] text-slate-600">🏥 ${escapeHtml(c.accName)}</div>` : ""}
    ${(c.department || c.customer) ? `<div class="text-[11px] text-slate-600">🩺 ${escapeHtml([c.department, c.customer].filter(Boolean).join(" · "))}</div>` : ""}
    ${c.totalCost ? `<div class="text-[11px] text-emerald-700 mt-1.5 font-semibold">💰 ${fmtMoney(c.totalCost)}</div>` : ""}
    ${adsHtml.length ? `<div class="mt-1 space-y-0.5">${adsHtml.join("")}</div>` : '<div class="text-[11px] text-slate-400 mt-1">광고 항목 없음</div>'}
    ${c.notes ? `<div class="text-xs text-slate-500 mt-2 line-clamp-2">${escapeHtml(c.notes)}</div>` : ""}
    <div class="text-[10px] text-slate-400 mt-2">${c.ownerName || c.ownerId} · ${daysSince(c.updatedAt)}일 전</div>
  </div>`;
}

/* ---------- Conference Modal ---------- */
function buildProductOptions() {
  return productsForUser().map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
}
function addBoothRow(product) {
  const list = document.getElementById("cBoothList");
  const row = document.createElement("div");
  row.className = "booth-row flex gap-2 items-center";
  row.innerHTML = `<select class="booth-product flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm">
    <option value="">-- 품목 선택 --</option>
    ${buildProductOptions()}
  </select>
  <button type="button" class="booth-remove text-rose-600 hover:text-rose-800 px-2 text-sm">×</button>`;
  list.appendChild(row);
  if (product) row.querySelector(".booth-product").value = product;
  row.querySelector(".booth-remove").addEventListener("click", () => row.remove());
}
function toggleAdField(enabled, selectId) {
  const sel = document.getElementById(selectId);
  sel.disabled = !enabled;
  sel.classList.toggle("opacity-40", !enabled);
  if (!enabled) sel.value = "";
}
function toggleBoothSection(enabled) {
  const list = document.getElementById("cBoothList");
  const addBtn = document.getElementById("cAddBooth");
  list.classList.toggle("hidden", !enabled);
  addBtn.classList.toggle("hidden", !enabled);
  if (!enabled) list.innerHTML = "";
  else if (!list.children.length) addBoothRow();
}
function initConfModal() {
  document.getElementById("cLuncheonProduct").innerHTML = '<option value="">-- 품목 선택 --</option>' + buildProductOptions();
  document.getElementById("cInsertProduct").innerHTML = '<option value="">-- 품목 선택 --</option>' + buildProductOptions();

  document.getElementById("confModalClose").addEventListener("click", closeConfModal);
  document.getElementById("cCancel").addEventListener("click", closeConfModal);
  document.getElementById("confModal").addEventListener("click", e => { if (e.target.id === "confModal") closeConfModal(); });
  document.getElementById("cSave").addEventListener("click", saveConference);
  document.getElementById("cDelete").addEventListener("click", deleteConferenceFn);

  document.getElementById("cAdLuncheon").addEventListener("change", e => toggleAdField(e.target.checked, "cLuncheonProduct"));
  document.getElementById("cAdInsert").addEventListener("change", e => toggleAdField(e.target.checked, "cInsertProduct"));
  document.getElementById("cAdBooth").addEventListener("change", e => toggleBoothSection(e.target.checked));
  document.getElementById("cAddBooth").addEventListener("click", () => addBoothRow());

  const searchEl = document.getElementById("cAccSearch");
  const sugg = document.getElementById("cAccSuggest");
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim().toLowerCase();
    if (q.length < 2) { sugg.classList.add("hidden"); return; }
    const matches = OD.rows.filter(r => r[5].toLowerCase().includes(q)).slice(0, 10);
    if (!matches.length) { sugg.classList.add("hidden"); return; }
    sugg.innerHTML = matches.map(r => {
      const d = decodeRow(r);
      return `<div class="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm" data-code="${d.code}">
        <div class="font-medium">${d.name}</div>
        <div class="text-xs text-slate-500">${d.hq} · ${d.office} · ${d.rep}</div></div>`;
    }).join("");
    sugg.classList.remove("hidden");
    sugg.querySelectorAll("[data-code]").forEach(el => {
      el.addEventListener("click", () => {
        State.confAccSelected = findAccount(el.dataset.code);
        showConfSelectedAcc();
        sugg.classList.add("hidden");
        searchEl.value = "";
      });
    });
  });
  document.getElementById("cAccSelected").addEventListener("click", e => {
    if (e.target.dataset.clear === "1") { State.confAccSelected = null; showConfSelectedAcc(); }
  });
}
function showConfSelectedAcc() {
  const el = document.getElementById("cAccSelected");
  if (!State.confAccSelected) { el.innerHTML = ""; return; }
  const a = State.confAccSelected;
  el.innerHTML = `<div class="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 flex justify-between items-center">
    <div><div class="font-semibold text-sm">${a.name} <span class="text-xs font-normal text-slate-500 ml-1">${a.code}</span></div>
    <div class="text-xs text-slate-600">${a.hq} · ${a.div} · ${a.office} · ${a.rep}</div></div>
    <button data-clear="1" class="text-xs text-rose-600 hover:underline">×</button></div>`;
}
function openConfModal(id) {
  State.editingConfId = id || null;
  State.confAccSelected = null;
  document.getElementById("confModal").classList.add("show");
  document.getElementById("confModalTitle").textContent = id ? "학회 수정" : "학회 등록";
  document.getElementById("cDelete").classList.toggle("hidden", !id);

  document.getElementById("cLuncheonProduct").innerHTML = '<option value="">-- 품목 선택 --</option>' + buildProductOptions();
  document.getElementById("cInsertProduct").innerHTML = '<option value="">-- 품목 선택 --</option>' + buildProductOptions();
  document.getElementById("cBoothList").innerHTML = "";

  document.getElementById("cAccSearch").value = "";
  document.getElementById("cAccSuggest").classList.add("hidden");
  document.getElementById("cAccSelected").innerHTML = "";

  if (id) {
    const c = State.conferences.find(x => x.id === id);
    if (!c) return;
    if (c.accCode) {
      State.confAccSelected = findAccount(c.accCode) || { hq:c.hq, div:c.div, office:c.office, rep:c.rep, code:c.accCode, name:c.accName };
      showConfSelectedAcc();
    }
    document.getElementById("cName").value = c.confName || "";
    document.getElementById("cStart").value = c.startDate || "";
    document.getElementById("cEnd").value = c.endDate || "";
    document.getElementById("cDept").value = c.department || "";
    document.getElementById("cCustomer").value = c.customer || "";
    document.getElementById("cTotalCost").value = c.totalCost || "";
    document.getElementById("cNotes").value = c.notes || "";
    const luncheonOn = !!c.ads?.luncheon?.enabled;
    const insertOn = !!c.ads?.insert?.enabled;
    const boothOn = (c.ads?.booths || []).length > 0;
    document.getElementById("cAdLuncheon").checked = luncheonOn;
    document.getElementById("cAdInsert").checked = insertOn;
    document.getElementById("cAdBooth").checked = boothOn;
    toggleAdField(luncheonOn, "cLuncheonProduct");
    toggleAdField(insertOn, "cInsertProduct");
    if (luncheonOn) document.getElementById("cLuncheonProduct").value = c.ads.luncheon.product || "";
    if (insertOn) document.getElementById("cInsertProduct").value = c.ads.insert.product || "";
    toggleBoothSection(boothOn);
    if (boothOn) {
      document.getElementById("cBoothList").innerHTML = "";
      (c.ads.booths || []).forEach(b => addBoothRow(b.product));
    }
  } else {
    document.getElementById("cName").value = "";
    document.getElementById("cStart").value = "";
    document.getElementById("cEnd").value = "";
    document.getElementById("cDept").value = "";
    document.getElementById("cCustomer").value = "";
    document.getElementById("cTotalCost").value = "";
    document.getElementById("cNotes").value = "";
    document.getElementById("cAdLuncheon").checked = false;
    document.getElementById("cAdInsert").checked = false;
    document.getElementById("cAdBooth").checked = false;
    toggleAdField(false, "cLuncheonProduct");
    toggleAdField(false, "cInsertProduct");
    toggleBoothSection(false);
  }
}
function closeConfModal() {
  document.getElementById("confModal").classList.remove("show");
  State.editingConfId = null;
  State.confAccSelected = null;
}
function collectConfModalData() {
  const confName = document.getElementById("cName").value.trim();
  const startDate = document.getElementById("cStart").value || "";
  const endDate = document.getElementById("cEnd").value || "";
  const department = document.getElementById("cDept").value.trim();
  const customer = document.getElementById("cCustomer").value.trim();
  const totalCost = document.getElementById("cTotalCost").value.trim();
  const notes = document.getElementById("cNotes").value.trim();

  const ads = { luncheon: { enabled: false, product: "" }, insert: { enabled: false, product: "" }, booths: [] };
  if (document.getElementById("cAdLuncheon").checked) {
    ads.luncheon.enabled = true;
    ads.luncheon.product = document.getElementById("cLuncheonProduct").value || "";
  }
  if (document.getElementById("cAdInsert").checked) {
    ads.insert.enabled = true;
    ads.insert.product = document.getElementById("cInsertProduct").value || "";
  }
  if (document.getElementById("cAdBooth").checked) {
    document.querySelectorAll("#cBoothList .booth-row").forEach(row => {
      const p = row.querySelector(".booth-product").value;
      if (p) ads.booths.push({ product: p });
    });
  }
  return { confName, startDate, endDate, department, customer, totalCost, notes, ads };
}
function saveConference() {
  const d = collectConfModalData();
  if (!d.confName) { alert("학회명을 입력하세요."); return; }
  if (d.startDate && d.endDate && d.startDate > d.endDate) { alert("종료일은 시작일 이후여야 합니다."); return; }

  const a = State.confAccSelected;
  const now = new Date().toISOString();
  const accFields = {
    accCode: a ? a.code : "", accName: a ? a.name : "",
    hq: a ? a.hq : "", div: a ? a.div : "", office: a ? a.office : "", rep: a ? a.rep : "",
  };

  if (State.editingConfId) {
    const c = State.conferences.find(x => x.id === State.editingConfId);
    if (!c) return;
    Object.assign(c, d, accFields, { updatedAt: now });
  } else {
    State.conferences.unshift({
      id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
      ...d, ...accFields,
      ownerId: State.user.id, ownerName: State.user.name,
      createdAt: now, updatedAt: now,
    });
  }
  saveConferences();
  closeConfModal();
  renderAll();
}
function deleteConferenceFn() {
  if (!State.editingConfId) return;
  if (!confirm("이 학회를 삭제하시겠습니까?")) return;
  State.conferences = State.conferences.filter(c => c.id !== State.editingConfId);
  saveConferences();
  closeConfModal();
  renderAll();
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadPipelines();
  loadConferences();
  initLogin();
  initTabs();
  initHqToggle();
  initFilters();
  initHeaderActions();
  initModal();
  initConfModal();

  document.getElementById("accSearch").addEventListener("input", () => {
    if (currentTab() === "accounts") renderAccounts();
  });
});
