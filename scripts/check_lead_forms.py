#!/usr/bin/env python3
"""Fail the build if lead forms regress to a placeholder inbox or a missing asset.

Needles are split so this file does not contain the forbidden literals.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules"}
TEXT_SUFFIXES = {
    ".html",
    ".js",
    ".css",
    ".xml",
    ".txt",
    ".json",
    ".yml",
    ".yaml",
    ".md",
    ".svg",
    ".mjs",
}

NEEDLES = (
    "form" + "spree",
    "YOUR_FORM_" + "ID",
    "REPLACE_" + "WITH",
    "555" + "-",
)
SECRET = "X-TDP-" + "Lead-Secret"
PROFILE_ID = "63e7470e-fe1e-4367-aae0-56d0d6392d78"
API_URL = "https://www.tradedeskpro.com/api/leads"
ASSET_ATTR = re.compile(
    r"""<(script|img|source|video|audio)\b[^>]*?\s(?:src)=["']([^"']+)["']"""
    r"""|<link\b[^>]*?\srel=["']stylesheet["'][^>]*?\shref=["']([^"']+)["']"""
    r"""|<link\b[^>]*?\shref=["']([^"']+)["'][^>]*?\srel=["']stylesheet["']""",
    re.IGNORECASE,
)
SKIP_URL = re.compile(r"^(https?:)?//|^(mailto:|tel:|data:|javascript:|#)", re.IGNORECASE)


def iter_text_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.resolve() == Path(__file__).resolve():
            continue
        files.append(path)
    return files


def find_needles(text: str) -> list[str]:
    found = []
    lower = text.lower()
    for needle in NEEDLES:
        if needle.lower() in lower:
            found.append(needle)
    return found


def local_asset_path(html_file: Path, url: str) -> Path | None:
    url = url.strip()
    if not url or SKIP_URL.match(url):
        return None
    path_part = url.split("#", 1)[0].split("?", 1)[0]
    if path_part.endswith("/"):
        path_part += "index.html"
    if path_part.startswith("/"):
        return ROOT / path_part.lstrip("/")
    return (html_file.parent / path_part).resolve()


def check() -> list[str]:
    errors: list[str] = []
    for path in iter_text_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = path.relative_to(ROOT).as_posix()
        for needle in find_needles(text):
            errors.append(f"{rel}: forbidden placeholder {needle!r}")
        if SECRET in text:
            errors.append(f"{rel}: client code must not contain the lead secret header")
        if path.suffix.lower() != ".html":
            continue
        for match in ASSET_ATTR.finditer(text):
            url = next(g for g in match.groups()[1:] if g)
            asset = local_asset_path(path, url)
            if asset is None:
                continue
            if not asset.is_file():
                errors.append(f"{rel}: missing local asset {url}")
        if "<form" in text.lower() and "blog/" not in rel:
            if "/js/tdp-leads.js" not in text:
                errors.append(f"{rel}: lead form page is missing /js/tdp-leads.js")
            if 'name="company_website"' not in text:
                errors.append(f"{rel}: lead form is missing the honeypot field")

    script = ROOT / "js" / "tdp-leads.js"
    if not script.is_file():
        errors.append("js/tdp-leads.js is missing")
    else:
        js = script.read_text(encoding="utf-8")
        if PROFILE_ID not in js:
            errors.append("js/tdp-leads.js is missing the TradeDeskPro profile id")
        if API_URL not in js:
            errors.append("js/tdp-leads.js is missing the TradeDeskPro leads URL")
        if SECRET in js:
            errors.append("js/tdp-leads.js must not send a lead secret")
    return errors


def self_test() -> None:
    sample = "https://form" + "spree.io/f/YOUR_FORM_" + "ID and REPLACE_" + "WITH and (830) 555" + "-0100"
    found = find_needles(sample)
    if len(found) != len(NEEDLES):
        raise SystemExit(f"needle self-test failed: {found}")


def main() -> int:
    self_test()
    errors = check()
    if errors:
        print("Lead form check failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1
    print("Lead form check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
