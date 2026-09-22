# 오선호 자기소개 페이지 · 프론트엔드–백엔드 연동

클라우드컴퓨팅실습 개인 과제입니다. 정적 HTML로 만든 자기소개 페이지(Vercel)가
FastAPI 백엔드(Render)를 호출해 프로필, 방명록, 미니게임 랭킹을 보여 줍니다.

방문자는 두 가지 미니게임을 하고 기록을 등록할 수 있으며, 모든 방문자가 같은 랭킹을 공유합니다.

- **10초 매수 러시**: 10초 동안 매수 버튼을 최대한 많이 누르기. 누를수록 실시간 차트의 주가가 오릅니다.
- **밈 카드 맞추기**: 금융·개발 밈 카드 8쌍을 가장 빨리 맞추기. 짝을 찾으면 뜻풀이가 나옵니다.

## 배포 주소

| 구분 | 주소 |
|---|---|
| 자기소개 + 연동 페이지 (Vercel) | https://introduce-three-rust.vercel.app |
| 백엔드 Swagger UI (Render) | https://introduce-e129.onrender.com/docs |
| GitHub 저장소 | https://github.com/Seonho-oh-kaist/introduce |

> Render 무료 플랜은 15분간 요청이 없으면 잠듭니다. 첫 접속 때 30~60초 기다리면 페이지의 서버 상태 표시가 초록색으로 바뀝니다.

## 주요 구성

소개와 API 연동 실습을 **한 페이지**에 담았습니다. 위쪽(소개·경력·학력)은 HTML에 직접 쓴 내용이고,
아래쪽 「API 연동」 영역은 백엔드 응답으로 그립니다.

| 계층 | 기술 | 역할 | 배포 |
|---|---|---|---|
| 프론트엔드 | HTML · CSS · JavaScript (`fetch`) | 자기소개, API 호출 결과 표시 | Vercel |
| 백엔드 | FastAPI · Pydantic · APIRouter | 프로필 조회, 방명록 CRUD | Render |
| 데이터 | Supabase(Postgres) 또는 서버 메모리 | 방명록·랭킹 저장 | Supabase |

```
intro-fullstack/
├── frontend/              ← Vercel Root Directory
│   ├── index.html         자기소개 + API 연동 화면
│   ├── style.css
│   ├── script.js          경로 차트, 미니게임 2종, fetch 호출(GET/POST/DELETE)
│   └── config.js          백엔드 주소(RENDER_URL) 설정
├── backend/               ← Render Root Directory
│   ├── app/
│   │   ├── main.py        앱 생성, CORS, 라우터 조립
│   │   ├── models.py      Pydantic 요청·응답 모델
│   │   ├── storage.py     저장소 계층 (DATABASE_URL 있으면 Postgres, 없으면 메모리)
│   │   └── routers/
│   │       ├── profile.py     GET /profile
│   │       ├── guestbook.py   /guestbook CRUD
│   │       └── scores.py      /scores/{game} 랭킹
│   └── requirements.txt
└── README.md
```

### API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 서버 상태 + 저장소 종류(`memory` / `postgres`) |
| GET | `/profile` | 프로필(경력·학력·관심사) |
| GET | `/guestbook` | 방명록 목록 (최신순) |
| POST | `/guestbook` | 글 등록 — `name` 1~20자, `message` 1~200자, 어기면 422 |
| GET | `/guestbook/{id}` | 글 하나 조회 — 없으면 404 |
| DELETE | `/guestbook/{id}` | 글 삭제 — 성공 204, 없으면 404 |
| GET | `/scores/{game}` | 랭킹 TOP N (`game` = `click` 또는 `memory`, `?limit=10`) |
| POST | `/scores/{game}` | 기록 등록 — 응답에 등수(`rank`) 포함. 말이 안 되는 점수는 422 |

## 로컬 실행

```bash
# 백엔드
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS: source .venv/bin/activate
pip install -r requirements.txt
fastapi dev app/main.py           # http://127.0.0.1:8000/docs

# 프론트엔드: VS Code에서 frontend/index.html → Open with Live Server (포트 5500)
```

localhost에서 열면 `config.js`가 자동으로 `http://localhost:8000`을 호출합니다.

## 배포 설정

**Render (백엔드)** — New → Web Service → 이 저장소 선택

| 항목 | 값 |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| 환경변수 `ALLOWED_ORIGINS` | Vercel 주소 (예: `https://YOUR-PROJECT.vercel.app`, 끝에 `/` 없이) |
| 환경변수 `DATABASE_URL` | (선택) Supabase 연결 문자열. 없으면 메모리에 저장 |

**Vercel (프론트엔드)** — New Project → 이 저장소 선택

| 항목 | 값 |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Other (빌드 없음) |

배포 후 `frontend/config.js`의 `RENDER_URL`을 Render 주소로 바꿔 push하면 Vercel이 자동 재배포합니다.

### Supabase 연결 (선택)

`DATABASE_URL`이 없으면 기록이 서버 메모리에 저장되어, Render 무료 서버가 쉬었다 깨어날 때 초기화됩니다.
영구 저장하려면:

1. Supabase에서 새 프로젝트를 만듭니다 (DB 비밀번호를 기억해 둡니다).
2. 상단 **Connect** → **Session pooler**의 URI를 복사합니다.
   `postgresql://postgres.<프로젝트ID>:[YOUR-PASSWORD]@aws-0-<지역>.pooler.supabase.com:5432/postgres`
   (Render는 IPv4만 지원하므로 Direct connection이 아니라 **pooler** 주소를 써야 합니다.)
3. `[YOUR-PASSWORD]`를 실제 비밀번호로 바꿔 Render 환경변수 `DATABASE_URL`에 넣습니다.
4. 재배포되면 서버가 시작할 때 `guestbook`, `scores` 테이블을 자동으로 만듭니다.
   `/health` 응답의 `storage`가 `postgres`로 바뀌면 연결된 것입니다.
