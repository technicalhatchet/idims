from app.services.cpsc_recall_model_match import match_model_to_recall, normalize_model


def test_normalize_model_strips_punctuation():
    assert normalize_model("WFW-8300 SW") == "WFW8300SW"


def test_exact_match():
    hit = match_model_to_recall("WFW8300SW", ["WFW8300SW"])
    assert hit == ("WFW8300SW", "exact")


def test_prefix_requires_six_chars():
    assert match_model_to_recall("ABC12", ["ABC12345"]) is None
    hit = match_model_to_recall("WFW8300SW", ["WFW830"])
    assert hit and hit[1] == "prefix_recall"


def test_wildcard_prefix():
    hit = match_model_to_recall("WFW8300SW", ["WFW830*"])
    assert hit == ("WFW830", "prefix_recall")
