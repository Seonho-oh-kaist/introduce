from fastapi import APIRouter, HTTPException, status

from app.models import GuestbookCreate, GuestbookOut
from app.storage import store

router = APIRouter(prefix="/guestbook", tags=["guestbook"])


@router.get("", response_model=list[GuestbookOut])
def list_entries():
    return store.list_guestbook()          # 최신 글이 위로


@router.post("", response_model=GuestbookOut, status_code=status.HTTP_201_CREATED)
def create_entry(payload: GuestbookCreate):
    return store.add_guestbook(payload.name, payload.message)


@router.get("/{entry_id}", response_model=GuestbookOut)
def get_entry(entry_id: int):
    entry = store.get_guestbook(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"{entry_id}번 글이 없습니다")
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int):
    if not store.delete_guestbook(entry_id):
        raise HTTPException(status_code=404, detail=f"{entry_id}번 글이 없습니다")
