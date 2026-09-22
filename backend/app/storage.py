"""
저장소 계층 — 라우터는 여기 함수만 부르고, 실제로 어디에 저장되는지는 모른다.

· 환경변수 DATABASE_URL 이 있으면 → Postgres(Supabase)에 영구 저장
· 없으면                        → 서버 메모리(파이썬 리스트). 서버가 잠들면 초기화
"""
import os
from datetime import datetime, timezone

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

WELCOME = ("오선호", "방문해 주셔서 감사합니다. 게임 기록도 남겨 주세요!")
MAX_MEMORY_ROWS = 500


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────
# 1) 메모리 저장소
# ─────────────────────────────────────────────────────────────
class MemoryStore:
    kind = "memory"

    def __init__(self):
        self.guestbook: list[dict] = []
        self.scores: list[dict] = []
        self._gid = 0
        self._sid = 0

    def open(self):
        if not self.guestbook:
            self.add_guestbook(*WELCOME)

    def close(self):
        pass

    # 방명록
    def list_guestbook(self, limit: int = 50):
        return list(reversed(self.guestbook))[:limit]

    def add_guestbook(self, name: str, message: str):
        self._gid += 1
        row = {"id": self._gid, "name": name, "message": message, "created_at": _now()}
        self.guestbook.append(row)
        del self.guestbook[:-MAX_MEMORY_ROWS]
        return row

    def get_guestbook(self, entry_id: int):
        return next((e for e in self.guestbook if e["id"] == entry_id), None)

    def delete_guestbook(self, entry_id: int) -> bool:
        row = self.get_guestbook(entry_id)
        if row is None:
            return False
        self.guestbook.remove(row)
        return True

    # 랭킹
    def top_scores(self, game: str, ascending: bool, limit: int):
        rows = [s for s in self.scores if s["game"] == game]
        rows.sort(key=lambda s: (s["score"] if ascending else -s["score"], s["created_at"]))
        return rows[:limit]

    def add_score(self, game: str, name: str, score: int, moves: int | None, ascending: bool):
        self._sid += 1
        row = {"id": self._sid, "game": game, "name": name, "score": score,
               "moves": moves, "created_at": _now()}
        self.scores.append(row)
        del self.scores[:-MAX_MEMORY_ROWS]
        # 나보다 좋은 기록 + 같은 점수지만 먼저 세운 기록 → 보드 순서와 같은 등수
        better = sum(1 for s in self.scores if s["game"] == game and s["id"] != row["id"]
                     and ((s["score"] < score if ascending else s["score"] > score)
                          or s["score"] == score))
        return row, better + 1


# ─────────────────────────────────────────────────────────────
# 2) Postgres(Supabase) 저장소
# ─────────────────────────────────────────────────────────────
SCHEMA = """
create table if not exists guestbook (
    id          bigserial primary key,
    name        text        not null,
    message     text        not null,
    created_at  timestamptz not null default now()
);
create table if not exists scores (
    id          bigserial primary key,
    game        text        not null,
    name        text        not null,
    score       integer     not null,
    moves       integer,
    created_at  timestamptz not null default now()
);
create index if not exists scores_game_score_idx on scores (game, score);
-- Supabase Data API(anon 키)로는 못 건드리게 막아 둔다.
-- 이 서버는 테이블 소유자(postgres)로 접속하므로 영향이 없다.
alter table guestbook enable row level security;
alter table scores    enable row level security;
"""


class PostgresStore:
    kind = "postgres"

    def __init__(self, url: str):
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        self.pool = ConnectionPool(
            url,
            min_size=1,
            max_size=4,
            open=False,
            # Supabase pooler(PgBouncer)와 충돌하지 않도록 prepared statement 끄기
            kwargs={"prepare_threshold": None, "row_factory": dict_row},
        )

    def open(self):
        self.pool.open(wait=True, timeout=20)
        with self.pool.connection() as conn:
            conn.execute(SCHEMA)
            if conn.execute("select count(*) as n from guestbook").fetchone()["n"] == 0:
                conn.execute("insert into guestbook (name, message) values (%s, %s)", WELCOME)

    def close(self):
        self.pool.close()

    # 방명록
    def list_guestbook(self, limit: int = 50):
        with self.pool.connection() as conn:
            return conn.execute(
                "select id, name, message, created_at from guestbook order by id desc limit %s",
                (limit,),
            ).fetchall()

    def add_guestbook(self, name: str, message: str):
        with self.pool.connection() as conn:
            return conn.execute(
                "insert into guestbook (name, message) values (%s, %s) "
                "returning id, name, message, created_at",
                (name, message),
            ).fetchone()

    def get_guestbook(self, entry_id: int):
        with self.pool.connection() as conn:
            return conn.execute(
                "select id, name, message, created_at from guestbook where id = %s", (entry_id,)
            ).fetchone()

    def delete_guestbook(self, entry_id: int) -> bool:
        with self.pool.connection() as conn:
            return conn.execute("delete from guestbook where id = %s", (entry_id,)).rowcount > 0

    # 랭킹
    def top_scores(self, game: str, ascending: bool, limit: int):
        order = "asc" if ascending else "desc"   # 코드에서 정한 두 값뿐이라 SQL 주입 위험 없음
        with self.pool.connection() as conn:
            return conn.execute(
                f"select id, game, name, score, moves, created_at from scores "
                f"where game = %s order by score {order}, created_at asc limit %s",
                (game, limit),
            ).fetchall()

    def add_score(self, game: str, name: str, score: int, moves: int | None, ascending: bool):
        cmp = "<" if ascending else ">"
        with self.pool.connection() as conn:
            row = conn.execute(
                "insert into scores (game, name, score, moves) values (%s, %s, %s, %s) "
                "returning id, game, name, score, moves, created_at",
                (game, name, score, moves),
            ).fetchone()
            better = conn.execute(
                # 나보다 좋은 기록 + 같은 점수지만 먼저 세운 기록 → 보드 순서와 같은 등수
                f"select count(*) as n from scores where game = %s and id <> %s "
                f"and (score {cmp} %s or score = %s)",
                (game, row["id"], score, score),
            ).fetchone()["n"]
        return row, better + 1


def _build_store():
    if not DATABASE_URL:
        return MemoryStore()
    try:
        return PostgresStore(DATABASE_URL)
    except ImportError:
        # requirements.txt에 psycopg가 없는 채로 DATABASE_URL만 설정된 경우.
        # 배포를 통째로 실패시키는 대신 메모리 모드로 조용히 내려간다.
        print("[storage] DATABASE_URL is set but psycopg is not installed — falling back to memory store.")
        return MemoryStore()


store = _build_store()
