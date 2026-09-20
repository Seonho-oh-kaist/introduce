// ═════════════════════════════════════════════════════════════
// 1. 히어로의 경로 차트 (서버와 무관, 페이지만으로 그림)
// ═════════════════════════════════════════════════════════════
const START = { y: 2015, m: 3 };     // 광운대 입학
const NOW = { y: 2026, m: 9 };       // 차트 끝 = 현재
const monthsFrom = (y, m) => (y - START.y) * 12 + (m - START.m);
const T_MAX = monthsFrom(NOW.y, NOW.m);

// 실제 이정표. v는 선의 높이(0~1)이며 값 자체에는 의미가 없습니다.
const MILESTONES = [
  { y: 2015, m: 3, v: 0.08, title: "광운대 입학", sub: "전자공학", pos: "above" },
  { y: 2021, m: 2, v: 0.30, title: "졸업", sub: "2021", pos: "below" },
  { y: 2022, m: 1, v: 0.40, title: "한국펀드파트너스", sub: "펀드회계 시스템", pos: "above" },
  { y: 2023, m: 9, v: 0.60, title: "유안타증권", sub: "카드·계좌 시스템", pos: "below" },
  { y: 2026, m: 3, v: 0.83, title: "KAIST DFMBA", sub: "디지털금융 MBA", pos: "above" },
  { y: 2026, m: 9, v: 0.90, title: "지금", sub: "개발과 연구를 함께", pos: "below", now: true },
];

function drawCareerChart() {
  const svg = document.getElementById("career-chart");
  const labels = document.getElementById("chart-labels");
  const years = document.getElementById("chart-years");
  if (!svg) return;

  const W = 800, H = 260, TOP = 30, BOTTOM = 230;
  const X = (t) => (t / T_MAX) * W;
  const Y = (v) => BOTTOM - v * (BOTTOM - TOP);

  // 고정 시드 난수 → 새로고침해도 같은 모양
  let seed = 20260301;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;

  const pts = MILESTONES.map((p) => ({ ...p, t: monthsFrom(p.y, p.m) }));
  const line = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let t = a.t; t < b.t; t++) {
      const f = (t - a.t) / (b.t - a.t);
      const eased = f * f * (3 - 2 * f);                    // 부드러운 보간
      const wobble = rand() * 0.07 * Math.sin(Math.PI * f);  // 이정표에서는 0
      line.push([X(t), Y(a.v + (b.v - a.v) * eased + wobble)]);
    }
  }
  const last = pts[pts.length - 1];
  line.push([X(last.t), Y(last.v)]);

  const d = line.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const ns = "http://www.w3.org/2000/svg";
  const make = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
    return el;
  };
  // 왼쪽부터 드러나는 마스크(clipPath) — 선이 한 번 그려지는 효과
  const clip = make("clipPath", { id: "reveal" });
  const rect = document.createElementNS(ns, "rect");
  Object.entries({ class: "reveal", x: 0, y: -40, width: W, height: H + 80 }).forEach(([k, v]) => rect.setAttribute(k, v));
  clip.appendChild(rect);

  make("line", { class: "base", x1: 0, y1: BOTTOM + 20, x2: W, y2: BOTTOM + 20 });
  make("path", { class: "area", d: `${d}L${W},${BOTTOM + 20}L0,${BOTTOM + 20}Z`, "clip-path": "url(#reveal)" });
  make("path", { class: "line", d, "clip-path": "url(#reveal)" });

  // 점과 라벨 (HTML로 올려야 화면 비율이 바뀌어도 원이 찌그러지지 않음)
  pts.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = `mark ${p.pos}${p.now ? " now" : ""}`;
    if (i === 0) el.classList.add("edge-l");
    if (p.t / T_MAX > 0.9) el.classList.add("edge-r");
    el.style.left = `${(p.t / T_MAX) * 100}%`;
    el.style.top = `${(Y(p.v) / H) * 100}%`;
    el.innerHTML = `<span class="pt"></span><span class="lbl"><b></b></span>`;
    el.querySelector("b").textContent = p.title;
    el.querySelector(".lbl").append(p.sub);
    labels.appendChild(el);
  });

  [2015, 2018, 2021, 2024, 2026].forEach((yr) => {
    const s = document.createElement("span");
    s.textContent = yr;
    s.style.left = `${(Math.max(0, monthsFrom(yr, yr === 2015 ? 3 : 1)) / T_MAX) * 100}%`;
    years.appendChild(s);
  });
}

// ═════════════════════════════════════════════════════════════
// 2. 백엔드 API 연동 (config.js 의 window.API_URL 사용)
// ═════════════════════════════════════════════════════════════
const API_URL = (window.API_URL || "http://localhost:8000").replace(/\/+$/, "");
const $ = (id) => document.getElementById(id);

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function setStatus(state, text) {
  $("status").dataset.state = state;
  $("status-text").textContent = text;
}

// Render 무료 서버는 잠들어 있으면 깨어나는 데 30~60초가 걸린다 → 재시도
async function waitForServer() {
  const deadline = Date.now() + 90_000;
  let first = true;
  while (Date.now() < deadline) {
    const t0 = performance.now();
    try {
      const res = await fetchWithTimeout(`${API_URL}/health`, {}, first ? 6000 : 20000);
      if (res.ok) {
        setStatus("ok", `서버에 연결되었습니다. 응답 ${Math.round(performance.now() - t0)}ms`);
        return true;
      }
    } catch (_) { /* 잠들어 있거나 네트워크 오류 → 재시도 */ }
    if (first) {
      setStatus("waking", "서버를 깨우고 있습니다. 무료 서버라 첫 요청에 최대 1분쯤 걸립니다.");
      first = false;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  setStatus(
    "error",
    "서버에 연결하지 못했습니다. config.js의 API 주소와 Render의 ALLOWED_ORIGINS 값을 확인하세요."
  );
  return false;
}

// ── GET /profile ─────────────────────────────
function fmtPeriod(p) {
  const f = (s) => s.replace("-", ".");
  return `${f(p.start)} – ${p.end ? f(p.end) : "현재"}`;
}

async function loadProfile() {
  const box = $("profile-out");
  try {
    const res = await fetchWithTimeout(`${API_URL}/profile`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $("profile-json").textContent = JSON.stringify(data, null, 2);

    box.replaceChildren();
    const h = document.createElement("p");
    h.className = "headline";
    h.textContent = `${data.name} (${data.name_en}) · ${data.headline}`;
    box.appendChild(h);

    const ul = document.createElement("ul");
    [...data.career, ...data.education].forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.title}, ${p.role} (${fmtPeriod(p)})`;
      ul.appendChild(li);
    });
    box.appendChild(ul);

    const tags = document.createElement("ul");
    tags.className = "tags";
    data.interests.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      tags.appendChild(li);
    });
    box.appendChild(tags);
  } catch (e) {
    box.innerHTML = `<p class="muted"></p>`;
    box.firstChild.textContent = `프로필을 불러오지 못했습니다 (${e.message}).`;
  }
}

// ── /guestbook : GET · POST · DELETE ─────────────
const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

function renderEntries(entries, highlightId) {
  const list = $("gb-list");
  list.replaceChildren();
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "아직 글이 없습니다. 첫 글을 남겨 주세요.";
    list.appendChild(li);
    return;
  }
  entries.forEach((e) => {
    const li = document.createElement("li");
    if (e.id === highlightId) li.classList.add("new");
    li.innerHTML = `
      <div class="meta">
        <span class="who"></span>
        <time></time>
        <button type="button" class="del">삭제</button>
      </div>
      <p class="msg"></p>`;
    li.querySelector(".who").textContent = e.name;
    const time = li.querySelector("time");
    time.dateTime = e.created_at;
    time.textContent = timeFmt.format(new Date(e.created_at));
    li.querySelector(".msg").textContent = e.message;
    const del = li.querySelector(".del");
    del.setAttribute("aria-label", `${e.name}님의 글 삭제`);
    del.addEventListener("click", () => deleteEntry(e.id, del));
    list.appendChild(li);
  });
}

async function loadGuestbook(highlightId) {
  try {
    const res = await fetchWithTimeout(`${API_URL}/guestbook`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderEntries(await res.json(), highlightId);
  } catch (e) {
    $("gb-list").innerHTML = `<li class="muted"></li>`;
    $("gb-list").firstChild.textContent = `방명록을 불러오지 못했습니다 (${e.message}).`;
  }
}

// 422 응답(Pydantic 검증 실패)을 사람이 읽을 문장으로 바꾼다
function explain422(detail) {
  const field = { name: "이름", message: "내용" };
  if (!Array.isArray(detail)) return "입력값을 확인해 주세요.";
  return detail
    .map((d) => {
      const f = field[d.loc?.[d.loc.length - 1]] || "입력값";
      if (d.type === "string_too_short") return `${f}을 입력해 주세요.`;
      if (d.type === "string_too_long") return `${f}이 너무 깁니다 (최대 ${d.ctx?.max_length}자).`;
      return `${f}: ${d.msg}`;
    })
    .join(" ");
}

function showError(msg) {
  const el = $("gb-error");
  el.textContent = msg;
  el.hidden = !msg;
}

async function createEntry(ev) {
  ev.preventDefault();
  showError("");
  const btn = $("gb-submit");
  btn.disabled = true;
  btn.textContent = "보내는 중";
  try {
    const res = await fetchWithTimeout(`${API_URL}/guestbook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: $("gb-name").value, message: $("gb-message").value }),
    });
    if (res.status === 422) {
      showError(explain422((await res.json()).detail));
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const created = await res.json();
    $("gb-message").value = "";
    updateCount();
    await loadGuestbook(created.id);
  } catch (e) {
    showError(`글을 남기지 못했습니다 (${e.message}). 서버 상태를 확인해 주세요.`);
  } finally {
    btn.disabled = false;
    btn.textContent = "남기기";
  }
}

async function deleteEntry(id, btn) {
  btn.disabled = true;
  try {
    const res = await fetchWithTimeout(`${API_URL}/guestbook/${id}`, { method: "DELETE" });
    if (res.status === 404) showError("이미 삭제된 글입니다.");
    else if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadGuestbook();
  } catch (e) {
    showError(`삭제하지 못했습니다 (${e.message}).`);
    btn.disabled = false;
  }
}

function updateCount() {
  $("gb-count").textContent = `${$("gb-message").value.length}/200`;
}

// ═════════════════════════════════════════════════════════════
// 시작
// ═════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  drawCareerChart();

  $("api-base").textContent = API_URL;
  $("docs-link").href = `${API_URL}/docs`;
  $("gb-form").addEventListener("submit", createEntry);
  $("gb-message").addEventListener("input", updateCount);

  if (await waitForServer()) {
    await Promise.all([loadProfile(), loadGuestbook()]);
  } else {
    $("profile-out").innerHTML = `<p class="muted">서버에 연결되면 여기에 프로필이 표시됩니다.</p>`;
    $("gb-list").innerHTML = "";
  }
});
