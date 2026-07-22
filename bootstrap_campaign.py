from pathlib import Path
import base64, io, shutil, zipfile
parts = sorted(Path(".campaign-payload").glob("part*.txt"))
data = "".join(p.read_text() for p in parts)
with zipfile.ZipFile(io.BytesIO(base64.b64decode(data))) as archive:
    archive.extractall(Path.cwd())
shutil.rmtree(".campaign-payload", ignore_errors=True)
Path("bootstrap_campaign.py").unlink(missing_ok=True)
Path(".github/workflows/bootstrap.yml").unlink(missing_ok=True)
print("Published complete campaign source")
