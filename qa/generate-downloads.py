from __future__ import annotations

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

ITEMS = {
    "resume.html": "Russell-Dudek-TalentPluto-Resume.pdf",
    "cover-letter.html": "Russell-Dudek-TalentPluto-Cover-Letter.pdf",
    "interview-brief.html": "Russell-Dudek-TalentPluto-Interview-Brief.pdf",
    "entry-plan.html": "Russell-Dudek-TalentPluto-90-Day-Plan.pdf",
    "client-product-brief.html": "Russell-Dudek-TalentPluto-Enterprise-Query-Plan.pdf",
}

EXPECTED_PAGES = {
    "resume.html": 2,
    "cover-letter.html": 1,
    "interview-brief.html": 2,
    "entry-plan.html": 2,
    "client-product-brief.html": 2,
}

PRINT_CSS = """
@page { size: Letter; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
.doc-actions { display: none !important; }
.doc-shell { margin: 0 !important; padding: 0 !important; width: 8.5in !important; max-width: none !important; box-shadow: none !important; }
.sheet { width: 8.5in !important; height: 11in !important; min-height: 11in !important; margin: 0 !important; overflow: hidden !important; break-after: page !important; page-break-after: always !important; }
.sheet:last-child { break-after: auto !important; page-break-after: auto !important; }
"""


def inline_document(route: str) -> str:
    source = (ROOT / route).read_text(encoding="utf-8")
    css = (ROOT / "docs.css").read_text(encoding="utf-8")
    logo = ROOT / "assets" / "brand" / "talentpluto-logo.jpg"
    if not logo.exists():
        raise FileNotFoundError(logo)
    data_uri = "data:image/jpeg;base64," + base64.b64encode(logo.read_bytes()).decode("ascii")
    css = css.replace("url('assets/brand/talentpluto-logo.jpg')", f"url('{data_uri}')")
    style = f"<style>{css}\n{PRINT_CSS}</style>"
    source = source.replace('<link rel="stylesheet" href="docs.css">', style)
    source = source.replace('<link href="docs.css" rel="stylesheet"/>', style)
    if "docs.css" in source:
        raise RuntimeError(f"Could not inline docs.css in {route}")
    return source


def validate_geometry(page, route: str) -> None:
    geometry = page.locator(".sheet").evaluate_all(
        """sheets => sheets.map((sheet, index) => {
          const rect = sheet.getBoundingClientRect();
          const footer = sheet.querySelector('.footerline')?.getBoundingClientRect();
          const children = [...sheet.children].filter(el => !el.classList.contains('footerline'));
          const contentBottom = Math.max(...children.map(el => el.getBoundingClientRect().bottom), rect.top);
          return {
            page: index + 1,
            width: rect.width,
            height: rect.height,
            scrollHeight: sheet.scrollHeight,
            clientHeight: sheet.clientHeight,
            footerClearance: footer ? footer.top - contentBottom : null
          };
        })"""
    )
    if len(geometry) != EXPECTED_PAGES[route]:
        raise RuntimeError(f"{route}: expected {EXPECTED_PAGES[route]} sheets, found {len(geometry)}")
    for item in geometry:
        if abs(item["width"] - 816) > 1 or abs(item["height"] - 1056) > 1:
            raise RuntimeError(f"{route} page {item['page']} is not US Letter geometry: {item}")
        if item["scrollHeight"] > item["clientHeight"] + 1:
            raise RuntimeError(f"{route} page {item['page']} overflows: {item}")
        if item["footerClearance"] is not None and item["footerClearance"] < 8:
            raise RuntimeError(f"{route} page {item['page']} collides with its footer: {item}")
    print(route, geometry)


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for route, filename in ITEMS.items():
                page = browser.new_page(viewport={"width": 816, "height": 1056})
                page.set_content(inline_document(route), wait_until="load")
                page.emulate_media(media="print")
                page.wait_for_timeout(50)
                validate_geometry(page, route)
                output = DOCS / filename
                page.pdf(
                    path=str(output),
                    format="Letter",
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                )
                page.close()
                reader = PdfReader(str(output))
                if len(reader.pages) != EXPECTED_PAGES[route]:
                    raise RuntimeError(
                        f"{route}: generated {len(reader.pages)} PDF pages; expected {EXPECTED_PAGES[route]}"
                    )
                text = "\n".join((page.extract_text() or "") for page in reader.pages)
                if len(text.strip()) < 500:
                    raise RuntimeError(f"{route}: generated PDF is unexpectedly sparse or blank")
                print(f"generated {output.name}: {len(reader.pages)} pages, {output.stat().st_size} bytes")
        finally:
            browser.close()

    print("generate-downloads: PASS")


if __name__ == "__main__":
    main()
