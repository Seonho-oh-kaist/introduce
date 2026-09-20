from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.models import GuestbookCreate, GuestbookOut

router = APIRouter(prefix="/guestbook", tags=["guestbook"])

# ── 임시 저장소 (서버 메모리) ──────────────────────────
# Render 무료 플랜은 15분간 요청이 없으면 잠들고, 깨어나면 이 리스트가 초기화된다.
# 그래서 첫 글 하나를 기본으로 넣어 둔다. 진짜 DB 연결은 4주차(Supabase)에서.
MAX_ENTRIES = 50
fake_db: list[dict] = [
    {"id": 1, "name": "오선호", "message": "방문해 주셔서 감사합니다. 한 줄 남겨 주세요!", "created_at": datetime.now(timezone.utc)},
]
_next_id = 2


def _find(entry_id: int):
    return next((e for e in fake_db if e["id"] == entry_id), None)


@router.get("", response_model=list[GuestbookOut])
def list_entries():
    return list(reversed(fake_db))   # 최신 글이 위로


@router.post("", response_model=GuestbookOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: GuestbookCreate):
    global _next_id
    record = {"id": _next_id, "created_at": datetime.now(timezone.utc), **payload.model_dump()}
    fake_db.append(record)
    _next_id += 1
    if len(fake_db) > MAX_ENTRIES:   # 메모리가 무한히 늘지 않도록 오래된 글부터 정리
        del fake_db[0]
    return record


@router.get("/{entry_id}", response_model=GuestbookOut)
def get_entry(entry_id: int):
    entry = _find(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"{entry_id}번 글이 없습니다")
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int):
    entry = _find(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"{entry_id}번 글이 없습니다")
    fake_db.remove(entry)
