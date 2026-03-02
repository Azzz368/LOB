import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from llm_poetry_stitcher import LLMPoetryStitcher


def test_json_parse_retry():
    stitcher = LLMPoetryStitcher()
    selected = {"en": ["river"]}
    controls = {"must_use_all": True}
    client_cfg = {
        "mock_responses": [
            "not-json",
            json.dumps(
                {
                    "poem": "river",
                    "used_fragments": {"en": ["river"]},
                    "notes": "",
                }
            ),
        ],
        "retries": 2,
    }
    poem = stitcher.generate(selected, client_cfg, controls)
    assert poem == "river"


def test_missing_fragment_retry():
    stitcher = LLMPoetryStitcher()
    selected = {"en": ["river"], "zh": ["月光"]}
    controls = {"must_use_all": True}
    client_cfg = {
        "mock_responses": [
            json.dumps(
                {"poem": "river", "used_fragments": {"en": ["river"]}, "notes": ""}
            ),
            json.dumps(
                {
                    "poem": "月光 river",
                    "used_fragments": {"en": ["river"], "zh": ["月光"]},
                    "notes": "",
                }
            ),
        ],
        "retries": 2,
    }
    poem = stitcher.generate(selected, client_cfg, controls)
    assert "月光" in poem


def test_validate_allows_missing_when_disabled():
    stitcher = LLMPoetryStitcher()
    selected = {"en": ["river"], "zh": ["月光"]}
    ok, errors = stitcher.validate("river", selected, {"must_use_all": False})
    assert ok is True
    assert errors == []
