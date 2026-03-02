from app import detect_language


def test_detect_language_english():
    lang_code, confidence = detect_language("This is a simple English sentence.")
    assert lang_code
    assert 0.0 <= confidence <= 1.0


def test_detect_language_chinese():
    lang_code, confidence = detect_language("今天天气很好，我们一起去公园吧。")
    assert lang_code
    assert 0.0 <= confidence <= 1.0
