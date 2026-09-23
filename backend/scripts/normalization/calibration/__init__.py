"""CG-5 — corpus normalization calibration (metrics, golden set, baseline compare)."""

from .baseline_metrics import collect_baseline_metrics, compare_baselines, write_baseline
from .gap_analyzer import analyze_corpus_gaps, format_gap_report_text
from .golden_runner import evaluate_golden_set, load_golden_set

__all__ = [
    "collect_baseline_metrics",
    "compare_baselines",
    "write_baseline",
    "analyze_corpus_gaps",
    "format_gap_report_text",
    "evaluate_golden_set",
    "load_golden_set",
]
