// ─────────────────────────────────────────────────────────────
// 백엔드 API 주소 설정 — 배포 후 이 파일의 RENDER_URL 한 줄만 바꾸면 됩니다.
//  · 내 컴퓨터(Live Server 등)에서 열면 → http://localhost:8000
//  · Vercel 등 인터넷 주소에서 열면     → RENDER_URL
// 끝에 / 를 붙이지 않습니다.
// ─────────────────────────────────────────────────────────────
const RENDER_URL = "https://introduce-e129.onrender.com";

const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:";
window.API_URL = isLocal ? "http://localhost:8000" : RENDER_URL;
