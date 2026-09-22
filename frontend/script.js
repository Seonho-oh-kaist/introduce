// ═════════════════════════════════════════════════════════════
// 0. 공통 도우미
// ═════════════════════════════════════════════════════════════
const API_URL = (window.API_URL || "http://localhost:8000").replace(/\/+$/, "");
const $ = (id) => document.getElementById(id);
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const won = (n) => Math.round(n).toLocaleString("ko-KR");
let serverReady = false;

async function api(path, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${API_URL}${path}`, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2600);
}

const nick = {
  get() { try { return localStorage.getItem("nick") || ""; } catch { return ""; } },
  set(v) { try { localStorage.setItem("nick", v); } catch { /* 저장 안 돼도 게임은 됨 */ } },
};

// 422 응답(Pydantic 검증 실패)을 사람이 읽을 문장으로
function explain422(detail) {
  if (typeof detail === "string") return detail;
  const field = { name: "이름", message: "내용", score: "점수", moves: "시도 횟수" };
  if (!Array.isArray(detail)) return "입력값을 확인해 주세요.";
  return detail.map((d) => {
    const f = field[d.loc?.[d.loc.length - 1]] || "입력값";
    if (d.type === "string_too_short") return `${f}을 입력해 주세요.`;
    if (d.type === "string_too_long") return `${f}이 너무 깁니다 (최대 ${d.ctx?.max_length}자).`;
    return `${f}: ${d.msg}`;
  }).join(" ");
}

// ═════════════════════════════════════════════════════════════
// 1. 히어로의 경로 차트
// ═════════════════════════════════════════════════════════════
const START = { y: 2015, m: 3 };
const NOW = { y: 2026, m: 9 };
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
  const svg = $("career-chart");
  if (!svg) return;
  const W = 800, H = 260, TOP = 30, BOTTOM = 230;
  const X = (t) => (t / T_MAX) * W;
  const Y = (v) => BOTTOM - v * (BOTTOM - TOP);

  let seed = 20260301; // 고정 시드 → 새로고침해도 같은 모양
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296) - 0.5;

  const pts = MILESTONES.map((p) => ({ ...p, t: monthsFrom(p.y, p.m) }));
  const line = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let t = a.t; t < b.t; t++) {
      const f = (t - a.t) / (b.t - a.t);
      const eased = f * f * (3 - 2 * f);
      const wobble = rand() * 0.07 * Math.sin(Math.PI * f);
      line.push([X(t), Y(a.v + (b.v - a.v) * eased + wobble)]);
    }
  }
  const last = pts[pts.length - 1];
  line.push([X(last.t), Y(last.v)]);
  const d = line.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

  svg.insertAdjacentHTML("beforeend", `
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${cssVar("--up")}" stop-opacity=".18"/>
        <stop offset="1" stop-color="${cssVar("--up")}" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="reveal"><rect class="reveal" x="0" y="-40" width="${W}" height="${H + 80}"/></clipPath>
    </defs>
    <line class="base" x1="0" y1="${BOTTOM + 20}" x2="${W}" y2="${BOTTOM + 20}"/>
    <path class="area" clip-path="url(#reveal)" d="${d}L${W},${BOTTOM + 20}L0,${BOTTOM + 20}Z"/>
    <path class="line" clip-path="url(#reveal)" d="${d}"/>`);

  const labels = $("chart-labels");
  pts.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = `mark ${p.pos}${p.now ? " now" : ""}${i === 0 ? " edge-l" : ""}${p.t / T_MAX > 0.9 ? " edge-r" : ""}`;
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
    $("chart-years").appendChild(s);
  });
}

// ═════════════════════════════════════════════════════════════
// 2. 서버 상태 (Render 무료 서버는 깨어나는 데 30~60초)
// ═════════════════════════════════════════════════════════════
function setStatus(state, text) {
  $("status").dataset.state = state;
  $("status-text").textContent = text;
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  let first = true;
  while (Date.now() < deadline) {
    const t0 = performance.now();
    try {
      const res = await api("/health", {}, first ? 6000 : 20000);
      if (res.ok) {
        const info = await res.json();
        setStatus("ok", `서버에 연결되었습니다 · 응답 ${Math.round(performance.now() - t0)}ms`);
        const note = info.storage === "postgres"
          ? "기록은 Supabase(Postgres)에 영구 저장됩니다."
          : "기록은 서버 메모리에 저장되어, 서버가 쉬었다 깨어나면 초기화됩니다.";
        document.querySelectorAll("[data-storage-note]").forEach((el) => (el.textContent = note));
        serverReady = true;
        return true;
      }
    } catch (_) { /* 잠들어 있으면 재시도 */ }
    if (first) {
      setStatus("waking", "서버를 깨우고 있습니다. 무료 서버라 첫 요청에 최대 1분쯤 걸립니다. 게임은 먼저 해도 돼요!");
      document.querySelectorAll(".board-list").forEach((el) => (el.innerHTML = `<li class="empty">서버를 깨우는 중</li>`));
      first = false;
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  setStatus("error", "서버에 연결하지 못했습니다. config.js의 API 주소와 Render의 ALLOWED_ORIGINS를 확인하세요.");
  return false;
}

// ═════════════════════════════════════════════════════════════
// 3. 랭킹 보드  GET/POST /scores/{game}
// ═════════════════════════════════════════════════════════════
const FORMAT = {
  click: (s) => [`${s.score}`, "건"],
  memory: (s) => [`${(s.score / 1000).toFixed(2)}`, `초 · ${s.moves}회`],
};

async function loadBoard(game, highlightId) {
  const list = $(`board-${game}`);
  try {
    const res = await api(`/scores/${game}?limit=10`);
    if (res.status === 404) throw new Error("랭킹 기능이 아직 서버에 배포되지 않았어요.");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    list.replaceChildren();
    if (rows.length === 0) {
      list.innerHTML = `<li class="empty">아직 기록이 없어요. 첫 1등의 주인공이 되어 보세요!</li>`;
      return;
    }
    const medal = ["🥇", "🥈", "🥉"];
    rows.forEach((s, i) => {
      const li = document.createElement("li");
      if (s.id === highlightId) li.classList.add("me");
      li.innerHTML = `<span class="rk"></span><span class="nm"></span><span class="sc"><small></small></span>`;
      li.querySelector(".rk").textContent = medal[i] || i + 1;
      li.querySelector(".nm").textContent = s.name;
      const [num, unit] = FORMAT[game](s);
      li.querySelector(".sc").prepend(num);
      li.querySelector("small").textContent = unit;
      list.appendChild(li);
    });
  } catch (e) {
    list.innerHTML = `<li class="empty"></li>`;
    list.firstChild.textContent = e.message.includes("배포") ? e.message : "랭킹을 불러오지 못했어요";
  }
}

// 게임이 끝나면 결과 + 랭킹 등록 폼을 그린다
function showResult(box, { game, title, sub, score, moves, onAgain }) {
  box.hidden = false;
  box.innerHTML = `
    <h4></h4><p class="sub"></p>
    <form novalidate>
      <input name="name" maxlength="12" placeholder="랭킹에 올릴 이름" autocomplete="nickname" aria-label="랭킹에 올릴 이름">
      <button class="btn btn-primary" type="submit">랭킹 등록</button>
    </form>
    <p class="msg" role="status"></p>
    <button type="button" class="again">다시 하기</button>`;
  box.querySelector("h4").textContent = title;
  box.querySelector(".sub").textContent = sub;
  const form = box.querySelector("form");
  const input = form.querySelector("input");
  const btn = form.querySelector("button");
  const msg = box.querySelector(".msg");
  input.value = nick.get();
  box.querySelector(".again").addEventListener("click", onAgain);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = input.value.trim();
    if (!name) { msg.className = "msg err"; msg.textContent = "이름을 입력해 주세요."; input.focus(); return; }
    btn.disabled = true;
    msg.className = "msg";
    msg.textContent = "등록하는 중";
    try {
      const res = await api(`/scores/${game}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score, moves }),
      }, 20000);
      if (res.status === 404) throw new Error("랭킹 기능이 아직 서버에 배포되지 않았어요. 백엔드를 최신 버전으로 업데이트해 주세요.");
      if (res.status === 422) throw new Error(explain422((await res.json()).detail));
      if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
      const saved = await res.json();
      nick.set(name);
      msg.className = "msg ok";
      msg.textContent = saved.rank === 1 ? "🎉 1등입니다! 랭킹 맨 위에 이름이 올라갔어요." : `${saved.rank}위로 등록됐어요!`;
      form.remove();
      loadBoard(game, saved.id);
    } catch (e) {
      btn.disabled = false;
      msg.className = "msg err";
      msg.textContent = e.name === "AbortError" || e instanceof TypeError
        ? "서버가 아직 깨어나는 중이에요. 잠시 뒤 다시 눌러 주세요."
        : e.message;
    }
  });
  setTimeout(() => input.focus({ preventScroll: true }), 50);
}

// ═════════════════════════════════════════════════════════════
// 4. 탭
// ═════════════════════════════════════════════════════════════
function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (tab.id === "tab-click") rush.resize();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      select(next);
      next.focus();
    });
  });
}

// ═════════════════════════════════════════════════════════════
// 5. 게임 ① 10초 매수 러시 — 누를수록 주가가 오른다
// ═════════════════════════════════════════════════════════════
const rush = (() => {
  const DURATION = 10_000, TICK = 100, BASE = 10_000;
  let state = "idle", count = 0, price = BASE, series = [BASE], t0 = 0, lastTick = 0, clicksInTick = 0;
  const canvas = $("rush-chart"), ctx = canvas.getContext("2d");
  const btn = $("rush-btn");

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pad = 14;
    ctx.clearRect(0, 0, w, h);
    const up = cssVar("--up"), down = cssVar("--down"), rule = cssVar("--rule");
    const pts = [...series, price];
    const lo = Math.min(BASE * 0.97, ...pts), hi = Math.max(BASE * 1.03, ...pts);
    const n = DURATION / TICK;
    const X = (i) => pad + (i / n) * (w - pad * 2);
    const Y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

    ctx.setLineDash([3, 4]); ctx.strokeStyle = rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, Y(BASE)); ctx.lineTo(w - pad, Y(BASE)); ctx.stroke();
    ctx.setLineDash([]);

    const color = price >= BASE ? up : down;
    if (pts.length < 3) {                                   // 시작 전: 기준선 위의 점 하나
      ctx.beginPath(); ctx.arc(X(0), Y(price), 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = cssVar("--muted"); ctx.font = `14px ${cssVar("--font")}`; ctx.textAlign = "center";
      ctx.fillText("매수 버튼을 누르면 장이 열립니다", w / 2, h / 2 - 16);
      return;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "33"); grad.addColorStop(1, color + "00");
    ctx.beginPath();
    pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.lineTo(X(pts.length - 1), h); ctx.lineTo(X(0), h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.strokeStyle = color; ctx.lineWidth = 2.25; ctx.lineJoin = "round"; ctx.stroke();

    const lx = X(pts.length - 1), ly = Y(price);
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  }

  function paintStats() {
    const chg = (price / BASE - 1) * 100;
    $("rush-count").textContent = count;
    $("rush-price").textContent = won(price);
    $("rush-price").className = `stat-num ${chg >= 0 ? "up" : "down"}`;
    $("rush-chg").textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
  }

  function reset() {
    state = "idle"; count = 0; price = BASE; series = [BASE]; clicksInTick = 0;
    $("rush-time").textContent = "10.0";
    $("rush-bar").style.transform = "scaleX(1)";
    $("rush-result").hidden = true;
    $("rush-play").hidden = false;
    btn.disabled = false;
    btn.textContent = "매수";
    paintStats(); draw();
  }

  function loop(now) {
    if (state !== "running") return;
    const elapsed = now - t0;
    while (now - lastTick >= TICK && series.length <= DURATION / TICK) {
      lastTick += TICK;
      if (clicksInTick === 0) price *= 0.9965 + (Math.random() - 0.5) * 0.004;   // 안 누르면 슬금슬금 빠짐
      series.push(price);
      clicksInTick = 0;
    }
    const left = Math.max(0, DURATION - elapsed);
    $("rush-time").textContent = (left / 1000).toFixed(1);
    $("rush-bar").style.transform = `scaleX(${left / DURATION})`;
    paintStats(); draw();
    if (left <= 0) return finish();
    requestAnimationFrame(loop);
  }

  function hit() {
    if (state === "done") return;
    if (state === "idle") {
      state = "running";
      t0 = lastTick = performance.now();
      requestAnimationFrame(loop);
    }
    count++; clicksInTick++;
    price *= 1.004 + Math.random() * 0.003;
    btn.classList.add("hit");
    setTimeout(() => btn.classList.remove("hit"), 70);
    const f = document.createElement("span");
    f.className = "float";
    f.textContent = "+1";
    const box = btn.getBoundingClientRect(), host = btn.closest(".game-main").getBoundingClientRect();
    f.style.left = `${box.left - host.left + 20 + Math.random() * (box.width - 60)}px`;
    f.style.top = `${box.top - host.top + 10}px`;
    btn.closest(".game-main").appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  function finish() {
    state = "done";
    btn.disabled = true;
    btn.textContent = "장 마감";
    paintStats(); draw();
    const chg = (price / BASE - 1) * 100;
    const tier = count < 30 ? "🐜 개미" : count < 50 ? "🐜✨ 슈퍼개미" : count < 70 ? "🏦 기관급" : "🤖 고빈도매매 봇 의심";
    setTimeout(() => {
      $("rush-play").hidden = true;
      showResult($("rush-result"), {
        game: "click",
        title: `${count}건 체결 · ${tier}`,
        sub: `초당 ${(count / 10).toFixed(1)}회 · 종가 ${won(price)}원 (${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%)`,
        score: count,
        moves: null,
        onAgain: reset,
      });
    }, 600);
  }

  // 마우스·터치: pointerdown이 click보다 빠르다
  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); });
  // 키보드로 버튼을 눌렀을 때(Enter/Space) — click 이벤트의 detail이 0
  btn.addEventListener("click", (e) => { if (e.detail === 0) hit(); });
  // 키를 꾹 누르고 있는 자동 반복은 막는다
  btn.addEventListener("keydown", (e) => { if (e.repeat) e.preventDefault(); });
  // 버튼에 포커스가 없어도 스페이스바로 플레이
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.repeat || $("panel-click").hidden) return;
    const a = document.activeElement;
    if (a && (a === btn || /^(INPUT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(a.tagName))) return;
    const r = $("panel-click").getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;    // 화면에 보일 때만
    e.preventDefault();
    hit();
  });
  window.addEventListener("resize", resize);

  return { reset, resize };
})();

// ═════════════════════════════════════════════════════════════
// 6. 게임 ② 밈 카드 맞추기
// ═════════════════════════════════════════════════════════════
const MEMES = [
  { e: "🚀", w: "떡상", q: "오르긴 오르는데, 이유는 아무도 모릅니다." },
  { e: "📉", w: "떡락", q: "대체로 내가 어제 산 그 종목." },
  { e: "💎", w: "존버", q: "팔면 지는 거라고 믿는 강철 멘탈." },
  { e: "💧", w: "물타기", q: "평단을 낮추는 중입니다. 정신력도 함께요." },
  { e: "✂️", w: "손절", q: "용기 있는 자만이 누를 수 있는 버튼." },
  { e: "🧠", w: "뇌동매매", q: "뉴스 제목만 보고 3초 만에 매수 완료." },
  { e: "🐛", w: "버그", q: "내 코드에선 절대 안 생긴다던 그것 (생겼다)." },
  { e: "🔥", w: "금요배포", q: "월요일의 나에게 보내는 선물." },
];

const memory = (() => {
  const board = $("mem-board");
  let first = null, lock = false, moves = 0, pairs = 0, t0 = 0, running = false, done = false;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function tick() {
    if (!running) return;
    $("mem-time").textContent = ((performance.now() - t0) / 1000).toFixed(1);
    requestAnimationFrame(tick);
  }

  function paint() {
    $("mem-moves").textContent = moves;
    $("mem-pairs").textContent = `${pairs}/${MEMES.length}`;
  }

  function reset() {
    first = null; lock = false; moves = 0; pairs = 0; running = false; done = false;
    $("mem-time").textContent = "0.0";
    $("mem-result").hidden = true;
    $("mem-quote").textContent = "같은 카드 두 장을 찾으면 뜻풀이가 나옵니다.";
    paint();
    board.replaceChildren();
    shuffle([...MEMES, ...MEMES].map((m, i) => ({ ...m, key: m.w, i }))).forEach((m, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mem-card";
      b.dataset.key = m.key;
      b.setAttribute("aria-label", `카드 ${idx + 1}, 뒤집히지 않음`);
      b.innerHTML = `
        <span class="mem-inner">
          <span class="mem-face mem-back" aria-hidden="true"></span>
          <span class="mem-face mem-front" aria-hidden="true"><span class="mem-emoji"></span><span class="mem-word"></span></span>
        </span>`;
      b.querySelector(".mem-emoji").textContent = m.e;
      b.querySelector(".mem-word").textContent = m.w;
      b.addEventListener("click", () => flip(b, m, idx));
      board.appendChild(b);
    });
  }

  function flip(card, m, idx) {
    if (lock || done || card === first || card.classList.contains("done")) return;
    if (!running && moves === 0 && !first) { running = true; t0 = performance.now(); requestAnimationFrame(tick); }
    card.classList.add("open");
    card.setAttribute("aria-label", `카드 ${idx + 1}, ${m.w}`);
    if (!first) { first = card; return; }

    moves++;
    const a = first, b = card;
    first = null;
    if (a.dataset.key === b.dataset.key) {
      [a, b].forEach((c) => { c.classList.add("done"); c.disabled = true; });
      pairs++;
      $("mem-quote").innerHTML = `${m.e} <b></b> — <span></span>`;
      $("mem-quote").querySelector("b").textContent = m.w;
      $("mem-quote").querySelector("span").textContent = m.q;
      paint();
      if (pairs === MEMES.length) finish();
    } else {
      lock = true;
      paint();
      setTimeout(() => {
        [a, b].forEach((c) => { c.classList.add("miss"); });
        setTimeout(() => {
          [a, b].forEach((c) => {
            c.classList.remove("open", "miss");
            c.setAttribute("aria-label", c.getAttribute("aria-label").replace(/, .*$/, ", 뒤집히지 않음"));
          });
          lock = false;
        }, 350);
      }, 550);
    }
  }

  function finish() {
    running = false; done = true;
    const ms = Math.round(performance.now() - t0);
    $("mem-time").textContent = (ms / 1000).toFixed(1);
    const acc = Math.round((MEMES.length / moves) * 100);
    const tier = acc >= 80 ? "🧠 포토그래픽 메모리" : acc >= 55 ? "📚 성실한 복습러" : "🎲 감으로 푸는 편";
    setTimeout(() => showResult($("mem-result"), {
      game: "memory",
      title: `${(ms / 1000).toFixed(2)}초 · ${tier}`,
      sub: `${moves}번 시도 · 정확도 ${acc}%`,
      score: ms,
      moves,
      onAgain: reset,
    }), 500);
  }

  return { reset };
})();

// ═════════════════════════════════════════════════════════════
// 7. 프로필  GET /profile
// ═════════════════════════════════════════════════════════════
const fmtPeriod = (p) => `${p.start.replace("-", ".")} – ${p.end ? p.end.replace("-", ".") : "현재"}`;

async function loadProfile() {
  const box = $("profile-out");
  try {
    const res = await api("/profile");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    $("profile-json").textContent = JSON.stringify(data, null, 2);
    box.replaceChildren();
    const h = document.createElement("p");
    h.className = "headline";
    h.textContent = `${data.name} (${data.name_en}) · ${data.headline}`;
    const ul = document.createElement("ul");
    [...data.career, ...data.education].forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.title}, ${p.role} (${fmtPeriod(p)})`;
      ul.appendChild(li);
    });
    const tags = document.createElement("ul");
    tags.className = "tags";
    data.interests.forEach((t) => { const li = document.createElement("li"); li.textContent = t; tags.appendChild(li); });
    box.append(h, ul, tags);
  } catch (e) {
    box.innerHTML = `<p class="muted"></p>`;
    box.firstChild.textContent = `프로필을 불러오지 못했습니다 (${e.message}).`;
  }
}

// ═════════════════════════════════════════════════════════════
// 8. 방명록  GET · POST · DELETE /guestbook
// ═════════════════════════════════════════════════════════════
const timeFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function renderEntries(entries, highlightId) {
  const list = $("gb-list");
  list.replaceChildren();
  if (entries.length === 0) {
    list.innerHTML = `<li class="muted">아직 글이 없습니다. 첫 글을 남겨 주세요.</li>`;
    return;
  }
  entries.forEach((e) => {
    const li = document.createElement("li");
    if (e.id === highlightId) li.classList.add("new");
    li.innerHTML = `<div class="meta"><span class="who"></span><time></time><button type="button" class="del">삭제</button></div><p class="msg"></p>`;
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
    const res = await api("/guestbook");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderEntries(await res.json(), highlightId);
  } catch (e) {
    $("gb-list").innerHTML = `<li class="muted"></li>`;
    $("gb-list").firstChild.textContent = `방명록을 불러오지 못했습니다 (${e.message}).`;
  }
}

function showGbError(msg) {
  $("gb-error").textContent = msg;
  $("gb-error").hidden = !msg;
}

async function createEntry(ev) {
  ev.preventDefault();
  showGbError("");
  const btn = $("gb-submit");
  btn.disabled = true;
  try {
    const res = await api("/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: $("gb-name").value, message: $("gb-message").value }),
    });
    if (res.status === 422) { showGbError(explain422((await res.json()).detail)); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const created = await res.json();
    $("gb-message").value = "";
    $("gb-count").textContent = "0/200";
    nick.set($("gb-name").value.trim().slice(0, 12));
    toast("방명록에 남겼어요. 고맙습니다!");
    await loadGuestbook(created.id);
  } catch (e) {
    showGbError(`글을 남기지 못했습니다 (${e.message}). 서버 상태를 확인해 주세요.`);
  } finally {
    btn.disabled = false;
  }
}

async function deleteEntry(id, btn) {
  btn.disabled = true;
  try {
    const res = await api(`/guestbook/${id}`, { method: "DELETE" });
    if (res.status === 404) toast("이미 삭제된 글입니다.");
    else if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadGuestbook();
  } catch (e) {
    showGbError(`삭제하지 못했습니다 (${e.message}).`);
    btn.disabled = false;
  }
}

// ═════════════════════════════════════════════════════════════
// 시작
// ═════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  drawCareerChart();
  initTabs();
  rush.reset();
  rush.resize();
  memory.reset();

  $("api-base").textContent = API_URL;
  $("docs-link").href = `${API_URL}/docs`;
  $("gb-name").value = nick.get();
  $("gb-form").addEventListener("submit", createEntry);
  $("gb-message").addEventListener("input", (e) => ($("gb-count").textContent = `${e.target.value.length}/200`));

  if (await waitForServer()) {
    await Promise.all([loadBoard("click"), loadBoard("memory"), loadProfile(), loadGuestbook()]);
  } else {
    $("profile-out").innerHTML = `<p class="muted">서버에 연결되면 여기에 프로필이 표시됩니다.</p>`;
    document.querySelectorAll(".board-list").forEach((el) => (el.innerHTML = `<li class="empty">서버에 연결하지 못했어요</li>`));
  }
});
