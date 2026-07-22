from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
failures = []

def require(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)

index = (ROOT / 'index.html').read_text(encoding='utf-8')
styles = (ROOT / 'styles.css').read_text(encoding='utf-8')
app = (ROOT / 'app.js').read_text(encoding='utf-8')

require(index.count('assets/brand/talentpluto-logo.svg') >= 2, 'TalentPluto logo must appear in header and hero')
require('class="identity"' in index and 'class="orbit-core"' in index, 'preferred identity and hero composition missing')
require('Enterprise Query Plan' not in index, 'superseded redesign is still present')
require('system-orbit' in index and 'Client-to-Product Translation System' in index, 'preferred client-to-product concept missing')
require('@media(max-width:640px)' in styles, 'narrow-phone treatment missing')
require('@media(prefers-reduced-motion:reduce)' in styles, 'reduced-motion treatment missing')
require("['ArrowLeft','ArrowRight','Home','End']" in app, 'keyboard control contract missing')
require("applyScenario('onboarding')" in app, 'useful baseline state missing')

for required in [
    'resume.html','cover-letter.html','interview-brief.html','entry-plan.html','client-product-brief.html',
    'assets/brand/talentpluto-logo.svg','docs/Russell-Dudek-TalentPluto-Resume.pdf',
    'docs/Russell-Dudek-TalentPluto-Cover-Letter.pdf','docs/Russell-Dudek-TalentPluto-Interview-Brief.pdf',
    'docs/Russell-Dudek-TalentPluto-90-Day-Plan.pdf','docs/Russell-Dudek-TalentPluto-Client-Delta-Atlas.pdf'
]:
    require((ROOT / required).is_file(), f'missing required artifact: {required}')

expected_pages = {
    'Russell-Dudek-TalentPluto-Resume.pdf': 2,
    'Russell-Dudek-TalentPluto-Cover-Letter.pdf': 1,
    'Russell-Dudek-TalentPluto-Interview-Brief.pdf': 2,
    'Russell-Dudek-TalentPluto-90-Day-Plan.pdf': 2,
    'Russell-Dudek-TalentPluto-Client-Delta-Atlas.pdf': 2,
}
for filename, expected in expected_pages.items():
    pdf_path = ROOT / 'docs' / filename
    if pdf_path.is_file():
        reader = PdfReader(str(pdf_path))
        require(len(reader.pages) == expected, f'{filename}: expected {expected} pages, got {len(reader.pages)}')
        metadata = ' '.join(str(value) for value in (reader.metadata or {}).values()).lower()
        require('roleforge' not in metadata, f'{filename}: private system name in metadata')

public_extensions = {'.html','.css','.js','.md','.json','.svg'}
for path in ROOT.rglob('*'):
    if path.is_file() and path.suffix.lower() in public_extensions and '.git' not in path.parts:
        text = path.read_text(encoding='utf-8', errors='ignore').lower()
        require('roleforge' not in text, f'{path.relative_to(ROOT)}: private system name exposed')

if failures:
    print(f'Source QA failed with {len(failures)} finding(s):')
    for failure in failures:
        print(f'- {failure}')
    raise SystemExit(1)
print('Source QA passed: preferred design, logo, artifacts, pagination, keyboard, reduced motion, and confidentiality.')
