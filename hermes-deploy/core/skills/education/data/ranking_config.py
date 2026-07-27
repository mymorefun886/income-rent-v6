# Education Data Layer — Ranking Config
# Database-backed, per-domain, per-version ranking weights.
# Replaces hardcoded constraint=0.5, fit=0.3, evidence=0.2.

import json
from dataclasses import dataclass, field
from typing import Optional

import httpx


@dataclass
class RankingConfig:
    """Configurable ranking weights loaded from database."""
    domain: str = "education"
    version: str = "v1"
    name: str = "Default Balanced"
    description: str = ""
    weights: dict = field(default_factory=lambda: {
        "constraint": 0.5,
        "academic_signal": 0.25,
        "preference_match": 0.15,
        "evidence": 0.10,
    })
    is_active: bool = True

    @property
    def constraint_weight(self) -> float:
        return self.weights.get("constraint", 0.5)

    @property
    def academic_signal_weight(self) -> float:
        return self.weights.get("academic_signal", 0.25)

    @property
    def preference_match_weight(self) -> float:
        return self.weights.get("preference_match", 0.15)

    @property
    def evidence_weight(self) -> float:
        return self.weights.get("evidence", 0.10)

    @property
    def total_weight(self) -> float:
        return self.constraint_weight + self.academic_signal_weight + self.preference_match_weight + self.evidence_weight

    def validate(self) -> bool:
        """Check that weights sum to approximately 1.0."""
        return abs(self.total_weight - 1.0) < 0.01

    def score(self, constraint_score: float, academic_score: float,
              preference_score: float, evidence_score: float) -> float:
        """Compute weighted total score (4-factor)."""
        return (
            constraint_score * self.constraint_weight
            + academic_score * self.academic_signal_weight
            + preference_score * self.preference_match_weight
            + evidence_score * self.evidence_weight
        )


# Built-in preset configs for different parent profiles
# 4-factor weights: constraint + academic_signal + preference_match + evidence = 1.0
PRESET_CONFIGS = {
    "balanced": RankingConfig(
        version="v1", name="Default Balanced",
        description="Balanced: constraint 0.5, academic 0.25, preference 0.15, evidence 0.10",
        weights={"constraint": 0.5, "academic_signal": 0.25, "preference_match": 0.15, "evidence": 0.10},
    ),
    "academic_first": RankingConfig(
        version="v2-academic", name="Academic First",
        description="Prioritize academic fit: constraint 0.35, academic 0.4, preference 0.15, evidence 0.10",
        weights={"constraint": 0.35, "academic_signal": 0.4, "preference_match": 0.15, "evidence": 0.10},
    ),
    "practical": RankingConfig(
        version="v2-practical", name="Practical Parent",
        description="Prioritize logistics: constraint 0.6, academic 0.15, preference 0.15, evidence 0.10",
        weights={"constraint": 0.6, "academic_signal": 0.15, "preference_match": 0.15, "evidence": 0.10},
    ),
    "evidence_heavy": RankingConfig(
        version="v2-evidence", name="Evidence Heavy",
        description="Prioritize documented evidence: constraint 0.3, academic 0.2, preference 0.1, evidence 0.4",
        weights={"constraint": 0.3, "academic_signal": 0.2, "preference_match": 0.1, "evidence": 0.4},
    ),
}


def load_config(config_name: str = "balanced") -> RankingConfig:
    """Load a preset ranking config by name."""
    return PRESET_CONFIGS.get(config_name, PRESET_CONFIGS["balanced"])


def config_for_profile(family) -> RankingConfig:
    """Select ranking config based on family profile signals."""
    # High-budget parent → academic config (competitive)
    if family.max_annual_fee > 60000:
        return PRESET_CONFIGS["academic_first"]

    # Budget-constrained → practical config (logistics matter more)
    if family.max_annual_fee > 0 and family.max_annual_fee < 30000:
        return PRESET_CONFIGS["practical"]

    # Default
    return PRESET_CONFIGS["balanced"]
