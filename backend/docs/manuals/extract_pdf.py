"""Extract searchable text from a service-manual PDF (pdfplumber)."""

import argparse
import json
from pathlib import Path

import pdfplumber


def extract_pdf(pdf_path: Path, out_txt: Path, out_meta: Path) -> dict:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page": i + 1, "text": text, "chars": len(text)})

    out_txt.parent.mkdir(parents=True, exist_ok=True)
    with out_txt.open("w", encoding="utf-8") as f:
        for p in pages:
            f.write("\n\n===== PAGE %d =====\n\n" % p["page"])
            f.write(p["text"])

    meta = {
        "source_pdf": str(pdf_path.name),
        "total_pages": len(pages),
        "total_chars": sum(p["chars"] for p in pages),
        "empty_pages": [p["page"] for p in pages if p["chars"] < 50],
        "page_chars": [{"page": p["page"], "chars": p["chars"]} for p in pages],
    }
    with out_meta.open("w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract PDF text for manual parsing")
    parser.add_argument("pdf", type=Path, help="Path to source PDF")
    parser.add_argument(
        "--out-txt",
        type=Path,
        help="Output .txt path (default: <pdf-stem>-extracted.txt beside PDF)",
    )
    parser.add_argument(
        "--out-meta",
        type=Path,
        help="Output meta JSON (default: <pdf-stem>-extracted-meta.json beside PDF)",
    )
    args = parser.parse_args()
    stem = args.pdf.stem
    out_txt = args.out_txt or args.pdf.with_name(f"{stem}-extracted.txt")
    out_meta = args.out_meta or args.pdf.with_name(f"{stem}-extracted-meta.json")
    meta = extract_pdf(args.pdf, out_txt, out_meta)
    print("pages:", meta["total_pages"])
    print("total chars:", meta["total_chars"])
    print("empty pages:", len(meta["empty_pages"]))
    print("wrote:", out_txt)
    print("wrote:", out_meta)


if __name__ == "__main__":
    main()
