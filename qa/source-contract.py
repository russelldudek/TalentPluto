from __future__ import annotations

import re
from hashlib import sha256
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
FINDINGS = ROOT / "qa" / "source-findings.txt"
failures: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


index = (ROOT / "index.html").read_text(encoding="utf-8")
styles = (ROOT / "styles.css").read_text(encoding="utf-8")
documents = (ROOT / "documents.css").read_text(encoding="utf-8")
app = (ROOT / "app.js").read_text(encoding="utf-8")
logo_path = ROOT / "assets" / "brand" / "talentpluto-logo.jpg"

require(index.count("assets/brand/talentpluto-logo.jpg") >= 2, "TalentPluto logo must appear in header and hero")
require('class="identity"' in index and 'class="orbit-core"' in index, "preferred hero composition missing")
require("system-orbit" in index and "Client-to-Product Translation System" in index, "approved client-to-product concept missing")
require("Enterprise Query Plan" not in index, "superseded redesign remains on homepage")
require("position:relative;left:auto;bottom:auto;transform:none" in styles, "hero caption is not in safe document flow")
require("@media(max-width:640px)" in styles, "narrow-phone homepage treatment missing")
require("@media(prefers-reduced-motion:reduce)" in styles, "reduced-motion treatment missing")
require("['ArrowLeft','ArrowRight','Home','End']" in app, "keyboard scenario contract missing")
require("applyScenario('onboarding')" in app, "useful scenario baseline missing")
require("Direct online document surfaces" in documents, "direct online document system missing")
require(logo_path.is_file(), "native TalentPluto JPEG is missing")
if logo_path.is_file():
    logo_bytes = logo_path.read_bytes()
    require(logo_bytes[:2] == b"\xff\xd8" and logo_bytes[-2:] == b"\xff\xd9", "TalentPluto logo is not a valid JPEG")
    require(sha256(logo_bytes).hexdigest() == "5f18f4586982f5a324e57b197f43f482f30bc964a0a6945882ef75c2f60b89f2", "TalentPluto logo bytes differ from the supplied image")

routes = {
    "resume.html": 2,
    "cover-letter.html": 1,
    "interview-brief.html": 2,
    "entry-plan.html": 2,
    "client-product-brief.html": 2,
}
for route, expected_surfaces in routes.items():
    path = ROOT / route
    require(path.is_file(), f"missing document route: {route}")
    if not path.is_file():
        continue
    text = path.read_text(encoding="utf-8")
    require("<iframe" not in text.lower(), f"{route}: browser PDF pane remains")
    require(text.count('class="sheet paper"') == expected_surfaces, f"{route}: expected {expected_surfaces} online paper surfaces")
    require("assets/brand/talentpluto-logo.jpg" in text, f"{route}: native TalentPluto logo missing")
    require(re.search(r"<a[^>]+download[^>]+href=\"docs/[^\"]+\.pdf\"", text, re.I) is not None or re.search(r"<a[^>]+href=\"docs/[^\"]+\.pdf\"[^>]+download", text, re.I) is not None, f"{route}: native PDF download missing")

resume_text = (ROOT / "resume.html").read_text(encoding="utf-8")
cover_text = (ROOT / "cover-letter.html").read_text(encoding="utf-8")
require('href="cover-letter.html"' in resume_text, "resume lacks reciprocal cover-letter navigation")
require('href="resume.html"' in cover_text, "cover letter lacks reciprocal resume navigation")
require('class="cover-body letter-body"' in cover_text, "cover letter has no visible online letter body")
visible_cover = re.sub(r"<[^>]+>", " ", cover_text)
visible_cover = re.sub(r"\s+", " ", visible_cover).strip()
require(len(visible_cover) > 1800, "cover letter online content is blank or incomplete")

expected_pages = {
    "Russell-Dudek-TalentPluto-Resume.pdf": 2,
    "Russell-Dudek-TalentPluto-Cover-Letter.pdf": 1,
    "Russell-Dudek-TalentPluto-Interview-Brief.pdf": 2,
    "Russell-Dudek-TalentPluto-90-Day-Plan.pdf": 2,
    "Russell-Dudek-TalentPluto-Client-Delta-Atlas.pdf": 2,
}
for filename, expected in expected_pages.items():
    pdf_path = ROOT / "docs" / filename
    require(pdf_path.is_file(), f"missing required PDF: {filename}")
    if not pdf_path.is_file():
        continue
    reader = PdfReader(str(pdf_path))
    require(len(reader.pages) == expected, f"{filename}: expected {expected} pages, got {len(reader.pages)}")
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    require(len(text.strip()) > 500, f"{filename}: PDF text is blank or incomplete")
    if "Cover-Letter" in filename:
        require(len(text.strip()) > 1800, "cover letter PDF is blank or incomplete")
    metadata = " ".join(str(value) for value in (reader.metadata or {}).values()).lower()
    require("roleforge" not in metadata, f"{filename}: private system name in metadata")
    require(re.search(r"roleforge|food safety management|enterprise query plan", text, re.I) is None, f"{filename}: prohibited or superseded text")

public_extensions = {".html", ".css", ".js", ".md", ".json", ".svg"}
for path in ROOT.rglob("*"):
    if path.is_file() and path.suffix.lower() in public_extensions and ".git" not in path.parts and "qa" not in path.parts:
        text = path.read_text(encoding="utf-8", errors="ignore")
        require(re.search(r"roleforge|food safety management|enterprise query plan", text, re.I) is None, f"{path.relative_to(ROOT)}: prohibited or superseded text")

FINDINGS.write_text("\n".join(failures), encoding="utf-8")
if failures:
    print(f"Source QA failed with {len(failures)} finding(s):")
    for failure in failures:
        print(f"- {failure}")
    raise SystemExit(1)
print("Source QA passed: direct HTML documents, exact PDFs, supplied logo, approved hero, navigation, and confidentiality.")
