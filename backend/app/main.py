import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import guestbook, profile, scores
from app.storage import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.open()        # DB 연결 + 테이블 준비 (메모리 모드면 기본 글만 넣음)
    yield
    store.close()


app = FastAPI(
    title="오선호 자기소개 API",
    description="자기소개 페이지(Vercel)가 호출하는 백엔드입니다. 프로필, 방명록, 미니게임 랭킹을 제공합니다.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS: 허용할 프론트 주소를 환경변수로 받는다 ────────────
# 로컬 기본값: VS Code Live Server(5500), Vite(5173)
# Render 배포 시 ALLOWED_ORIGINS=https://<내 프로젝트>.vercel.app  (여러 개면 쉼표로 구분)
DEFAULT_ORIGINS = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:5173"
origins = [
    o.strip().rstrip("/")
    for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "오선호 자기소개 API입니다. /docs 에서 테스트할 수 있습니다."}


@app.get("/health")
def health_check():
    # storage: "memory"(서버가 쉬면 초기화) 또는 "postgres"(Supabase 영구 저장)
    return {"status": "ok", "storage": store.kind}


app.include_router(profile.router)
app.include_router(guestbook.router)
app.include_router(scores.router)
