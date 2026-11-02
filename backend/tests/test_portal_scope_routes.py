"""Every client portal route must declare portal scope (Wave 3)."""

from __future__ import annotations

import ast
from pathlib import Path

ROUTER_PATH = Path(__file__).resolve().parents[1] / "app" / "routers" / "client_portal.py"

ALLOWLIST_FUNCTION_NAMES = frozenset({
    "link_account_debug",
    "validate_portal_claim",
    "link_portal_account",
    "portal_signup_status",
    "complete_portal_signup",
})

SCOPE_MARKERS = ("portal_scope_dependency", "get_portal_scope")


def _handler_has_scope(source: str) -> bool:
    return any(marker in source for marker in SCOPE_MARKERS)


def test_all_portal_router_handlers_declare_scope():
    module_source = ROUTER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(module_source)

    missing = []
    for node in tree.body:
        if not isinstance(node, ast.AsyncFunctionDef):
            continue
        if node.name not in _portal_handler_names(tree, node):
            continue
        if node.name in ALLOWLIST_FUNCTION_NAMES:
            continue
        fn_source = ast.get_source_segment(module_source, node) or ""
        if not _handler_has_scope(fn_source):
            missing.append(node.name)

    assert not missing, f"Portal handlers missing scope dependency: {missing}"


def _portal_handler_names(tree: ast.Module, fn_node: ast.AsyncFunctionDef) -> set[str]:
    """Return set of async function names that are directly decorated with @router.*"""
    names: set[str] = set()
    for node in tree.body:
        if not isinstance(node, ast.AsyncFunctionDef):
            continue
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                if isinstance(dec.func.value, ast.Name) and dec.func.value.id == "router":
                    names.add(node.name)
    return names
