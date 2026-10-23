"""Build the claude.ai artifact version of the site into data/work/artifact/.

The artifact host wraps the published page in its own <!doctype><html><head><body>,
so the page must not carry those tags. Everything else ships unchanged as
supporting files. Prints the output directory.
"""
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "data" / "work" / "artifact"
FILES = ["style.css", "ui.js", "data.js", "scene.js", "flat.js", "flat.html"]

OUT.mkdir(parents=True, exist_ok=True)
page = (ROOT / "index.html").read_text()
page = re.sub(r"(?is)<!doctype[^>]*>|</?(html|head|body)\b[^>]*>", "", page)
page = re.sub(r'(?i)\s*<meta (charset|name="viewport")[^>]*>', "", page)
(OUT / "index.html").write_text(page.strip() + "\n")
for f in FILES:
    shutil.copy2(ROOT / f, OUT / f)
print(OUT)
