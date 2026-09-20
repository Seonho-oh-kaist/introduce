from fastapi import APIRouter

from app.models import ProfileOut

router = APIRouter(prefix="/profile", tags=["profile"])

# 소개 내용은 여기 한 곳만 고치면 프론트의 'API 연동' 영역에도 그대로 반영된다.
PROFILE = {
    "name": "오선호",
    "name_en": "Seon Ho Oh",
    "headline": "금융 시스템을 만들던 개발자, 이제 금융 데이터를 연구합니다.",
    "now": [
        "유안타증권 정보시스템팀에서 카드·계좌 시스템 개발 (Java, Oracle, Linux)",
        "KAIST 디지털금융 MBA 재학 중 (재무 데이터베이스, 계량 금융, 금융 윤리)",
        "WRDS(Compustat, CRSP, TAQ)로 실증 자산가격 연구",
    ],
    "education": [
        {"title": "KAIST", "role": "디지털금융 MBA (DFMBA)", "start": "2026-03", "end": None},
        {"title": "광운대학교", "role": "전자공학 학사", "start": "2015-03", "end": "2021-02"},
    ],
    "career": [
        {"title": "유안타증권", "role": "정보시스템팀 주임, 소프트웨어 엔지니어", "start": "2023-09", "end": None},
        {"title": "한국펀드파트너스", "role": "소프트웨어 엔지니어 (펀드회계 시스템)", "start": "2022-01", "end": "2023-09"},
    ],
    "interests": ["퀀트 금융", "실증 자산가격결정", "한국 금융 규제", "콘텐츠 자동화", "음원 마스터링"],
}


@router.get("", response_model=ProfileOut)
def get_profile():
    return PROFILE
