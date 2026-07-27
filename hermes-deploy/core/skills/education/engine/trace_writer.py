# Recommendation Trace Writer
# Persists the reasoning chain for each recommendation session.

import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime, timezone


@dataclass
class TraceStep:
    """Single step in the recommendation pipeline."""
    step: str
    step_order: int
    input_summary: dict = field(default_factory=dict)
    output_summary: dict = field(default_factory=dict)
    schools_considered: int | None = None
    metadata: dict = field(default_factory=dict)


class RecommendationTracer:
    """Write recommendation trace to PostgreSQL."""

    def __init__(self, pool_or_conn):
        self.pool = pool_or_conn
        self._is_conn = hasattr(pool_or_conn, 'fetchrow') and not hasattr(pool_or_conn, 'acquire')

    async def _fetchrow(self, query, *args):
        if self._is_conn:
            return await self.pool.fetchrow(query, *args)
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def _execute(self, query, *args):
        if self._is_conn:
            return await self.pool.execute(query, *args)
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def create_session(
        self,
        user_id: str,
        child_profile: dict | None = None,
        family_constraints: dict | None = None,
        engine_version: str = "v1",
    ) -> str:
        """Create a recommendation session, return session_id."""
        row = await self._fetchrow(
            """
            INSERT INTO memory.recommendation_session
                (user_id, child_profile, family_constraints, engine_version)
            VALUES ($1, $2::jsonb, $3::jsonb, $4)
            RETURNING id
            """,
            user_id,
            json.dumps(child_profile or {}),
            json.dumps(family_constraints or {}),
            engine_version,
        )
        return str(row["id"])

    async def log_step(
        self,
        session_id: str,
        step: TraceStep,
    ):
        """Log a pipeline step."""
        await self._execute(
            """
            INSERT INTO memory.recommendation_trace
                (session_id, step, step_order, input_summary, output_summary,
                 schools_considered, metadata)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)
            """,
            session_id,
            step.step,
            step.step_order,
            json.dumps(step.input_summary),
            json.dumps(step.output_summary),
            step.schools_considered,
            json.dumps(step.metadata),
        )

    async def save_results(
        self,
        session_id: str,
        ranked_schools: list[dict],
    ):
        """Save final ranked results."""
        for i, entry in enumerate(ranked_schools[:10]):
            school = entry.get("school", entry)
            await self._execute(
                """
                INSERT INTO memory.recommendation_result
                    (session_id, school_id, rank, constraint_score, fit_score,
                     overall_score, match_reasons)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (session_id, school_id) DO UPDATE SET
                    rank = EXCLUDED.rank,
                    overall_score = EXCLUDED.overall_score
                """,
                session_id,
                school.get("school_id", school.get("name", "unknown")),
                i + 1,
                entry.get("constraint_score"),
                entry.get("fit_score"),
                entry.get("total_score"),
                json.dumps(entry.get("match_reasons", entry.get("reasoning", ""))),
            )

    async def finalize_session(
        self,
        session_id: str,
        total_considered: int,
        total_ranked: int,
    ):
        """Update session with final counts."""
        await self._execute(
            """
            UPDATE memory.recommendation_session
            SET total_schools_considered = $2,
                total_ranked = $3
            WHERE id = $1
            """,
            session_id,
            total_considered,
            total_ranked,
        )


def get_tracer(pool_or_conn) -> RecommendationTracer:
    """Factory function."""
    return RecommendationTracer(pool_or_conn)
