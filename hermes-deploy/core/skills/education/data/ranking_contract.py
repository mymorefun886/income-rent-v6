# Phase 10.1.9: Ranking Contract Freeze (v1.0)

This module loads and validates the frozen ranking contract.
The contract is IMMUTABLE — any change requires a version bump.

Contract file: `ranking_contract_v1.json`

Usage:
    from skills.education.data.ranking_contract import load_ranking_contract, get_frozen_weights

    contract = load_ranking_contract()
    weights = contract["weights"]  # {"constraint": 0.5, ...}
"""

import json
from pathlib import Path
from typing import Optional


CONTRACT_FILE = Path(__file__).parent / "ranking_contract_v1.json"


def load_ranking_contract() -> dict:
    """Load the frozen ranking contract from JSON file."""
    with open(CONTRACT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_frozen_weights() -> dict:
    """Get the frozen ranking weights (immutable)."""
    contract = load_ranking_contract()
    return contract["weights"]


def get_frozen_formula() -> str:
    """Get the frozen ranking formula string."""
    contract = load_ranking_contract()
    return contract["formula"]


def validate_weights_against_contract(weights: dict) -> bool:
    """Validate that given weights match the frozen contract."""
    contract_weights = get_frozen_weights()
    for key in contract_weights:
        if key not in weights:
            return False
        if abs(weights[key] - contract_weights[key]) > 0.001:
            return False
    return True


def is_immutable() -> bool:
    """Check if the ranking contract is frozen (immutable)."""
    contract = load_ranking_contract()
    return contract.get("immutable", False)


def get_feedback_rule() -> dict:
    """Get the feedback flow rule (feedback must NOT mutate weights)."""
    contract = load_ranking_contract()
    return contract.get("feedback_rule", {})
