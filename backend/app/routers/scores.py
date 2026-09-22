from fastapi import APIRouter, HTTPException, Query, status

from app.models import Game, ScoreCreate, ScoreOut, ScoreResult
from app.storage import store

router = APIRouter(prefix="/scores", tags=["scores"])

# 게임별 규칙: 정렬 방향과 말이 되는 점수 범위(간단한 치팅 방지)
RULES = {
    Game.click:  {"ascending": False, "min": 1,     "max": 200,        "moves": False},
    Game.memory: {"ascending": True,  "min": 4_000, "max": 3_600_000,  "moves": True},
}


@router.get("/{game}", response_model=list[ScoreOut])
def top_scores(game: Game, limit: int = Query(10, ge=1, le=50)):
    return store.top_scores(game.value, RULES[game]["ascending"], limit)


@router.post("/{game}", response_model=ScoreResult, status_code=status.HTTP_201_CREATED)
def add_score(game: Game, payload: ScoreCreate):
    rule = RULES[game]
    if not rule["min"] <= payload.score <= rule["max"]:
        raise HTTPException(status_code=422, detail="말이 안 되는 점수예요. 다시 도전해 주세요!")
    if rule["moves"] and (payload.moves is None or not 8 <= payload.moves <= 999):
        raise HTTPException(status_code=422, detail="시도 횟수가 올바르지 않아요.")
    moves = payload.moves if rule["moves"] else None

    row, rank = store.add_score(game.value, payload.name, payload.score, moves, rule["ascending"])
    return {**row, "rank": rank}
