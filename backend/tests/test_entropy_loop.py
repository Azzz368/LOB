import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from entropy_loop_app import stitch_text, tokenize_text


def test_tokenize_text():
    text = "moonlight falls on stone"
    assert tokenize_text(text) == ["moonlight", "falls", "on", "stone"]


def test_stitch_text():
    fragments = ["moon", "light", "  ", "stone"]
    assert stitch_text(fragments) == "moon light stone"
