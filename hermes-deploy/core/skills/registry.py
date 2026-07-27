# Hermes Core — Skill Registry
# Discovers, loads, and routes to domain skills at startup.

import importlib.util
import json
import logging
import os

from skills.base import BaseSkill, SkillResult

logger = logging.getLogger("hermes.skills")


class SkillRegistry:
    """Discovers skills from the skills/ directory and routes intents to them."""

    def __init__(self, skills_dir: str | None = None):
        self._skills: dict[str, BaseSkill] = {}       # name → skill instance
        self._intents: dict[str, str] = {}             # intent → skill name
        self._domains: dict[str, str] = {}             # domain → skill name
        self._loaded = False

        if skills_dir is None:
            skills_dir = os.path.join(os.path.dirname(__file__))
        self.skills_dir = skills_dir

    # -- discovery -----------------------------------------------------------

    def discover(self) -> None:
        """Scan skills/ subdirectories for skill manifests. Idempotent."""
        if self._loaded:
            return

        for entry in sorted(os.listdir(self.skills_dir)):
            skill_path = os.path.join(self.skills_dir, entry)
            if not os.path.isdir(skill_path) or entry.startswith("_"):
                continue

            manifest = self._find_manifest(skill_path)
            if manifest is None:
                continue

            try:
                self._load_skill(entry, skill_path, manifest)
                logger.info("Loaded skill: %s v%s", manifest["name"], manifest.get("version", "0.1.0"))
            except Exception:
                logger.exception("Failed to load skill %s", entry)

        self._loaded = True
        logger.info("Registry ready: %d skills, %d intents", len(self._skills), len(self._intents))

    def _find_manifest(self, skill_path: str) -> dict | None:
        for name in ("skill.json", "skill.yaml", "skill.yml"):
            p = os.path.join(skill_path, name)
            if os.path.exists(p):
                if name.endswith(".json"):
                    with open(p) as f:
                        return json.load(f)
                else:
                    import yaml
                    with open(p) as f:
                        return yaml.safe_load(f)
        return None

    def _load_skill(self, folder: str, skill_path: str, manifest: dict) -> None:
        handler_path = os.path.join(skill_path, "handler.py")
        if not os.path.exists(handler_path):
            logger.warning("No handler.py in %s", skill_path)
            return

        # Dynamically import the handler module
        module_name = f"skills.{folder}"
        spec = importlib.util.spec_from_file_location(module_name, handler_path)
        if spec is None or spec.loader is None:
            logger.warning("Cannot load module for %s", handler_path)
            return

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find the BaseSkill subclass
        skill_cls = None
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if isinstance(attr, type) and issubclass(attr, BaseSkill) and attr is not BaseSkill:
                skill_cls = attr
                break

        if skill_cls is None:
            logger.warning("No BaseSkill subclass in %s", handler_path)
            return

        skill = skill_cls()
        skill.name = manifest.get("name", folder)
        skill.version = manifest.get("version", "0.1.0")
        skill.description = manifest.get("description", "")

        self._skills[skill.name] = skill
        for intent in manifest.get("intents", []):
            self._intents[intent] = skill.name
        for domain in manifest.get("domains", []):
            self._domains[domain] = skill.name

    # -- routing -------------------------------------------------------------

    def find_by_intent(self, intent: str) -> BaseSkill | None:
        name = self._intents.get(intent)
        return self._skills.get(name) if name else None

    def find_by_domain(self, domain: str) -> BaseSkill | None:
        name = self._domains.get(domain)
        return self._skills.get(name) if name else None

    def get(self, name: str) -> BaseSkill | None:
        return self._skills.get(name)

    @property
    def skill_names(self) -> list[str]:
        return list(self._skills.keys())


# Module-level singleton — discovered once at import time
registry = SkillRegistry()
