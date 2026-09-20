from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── 프로필 (GET /profile 응답 모양) ─────────────────────
class Period(BaseModel):
    title: str          # 학교·회사 이름
    role: str           # 전공·직무
    start: str          # "2023-09" 형식
    end: str | None     # 진행 중이면 None


class ProfileOut(BaseModel):
    name: str
    name_en: str
    headline: str
    now: list[str]
    education: list[Period]
    career: list[Period]
    interests: list[str]


# ── 방명록 ────────────────────────────────────────────
class GuestbookCreate(BaseModel):
    # 앞뒤 공백을 자동으로 지운 뒤 길이를 검사한다 → "   " 만 보내면 422
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=20)
    message: str = Field(min_length=1, max_length=200)


class GuestbookOut(BaseModel):
    id: int
    name: str
    message: str
    created_at: datetime
