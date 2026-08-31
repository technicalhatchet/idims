import pdfplumber
import json
import re

path = r"c:\Users\chee3\IdeaProjects\idims\backend\docs\manuals\whirlpool-electric-gas-dryers.pdf.pdf"
out_txt = r"c:\Users\chee3\IdeaProjects\idims\backend\docs\manuals\whirlpool-electric-gas-dryers-extracted.txt"
out_meta = r"c:\Users\chee3\IdeaProjects\idims\backend\docs\manuals\whirlpool-electric-gas-dryers-extracted-meta.json"

pages = []
with pdfplumber.open(path) as pdf:
    print("pages:", len(pdf.pages))
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        pages.append({"page": i + 1, "text": text, "chars": len(text)})

with open(out_txt, "w", encoding="utf-8") as f:
    for p in pages:
        f.write("\n\n===== PAGE %d =====\n\n" % p["page"])
        f.write(p["text"])

meta = {
    "total_pages": len(pages),
    "total_chars": sum(p["chars"] for p in pages),
    "empty_pages": [p["page"] for p in pages if p["chars"] < 50],
    "page_chars": [{ "page": p["page"], "chars": p["chars"] } for p in pages],
}
with open(out_meta, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2)

print("total chars:", meta["total_chars"])
print("empty pages:", len(meta["empty_pages"]))
