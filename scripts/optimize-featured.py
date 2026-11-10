"""Optional asset maintenance; requires Pillow, not part of the Node.js build."""
from pathlib import Path
from PIL import Image, ImageOps
import base64
import io
import json
import sys

root = Path(__file__).resolve().parent.parent
target = root / 'site/assets/img/optimized'
stream = '--stdout' in sys.argv
if not stream:
    target.mkdir(parents=True, exist_ok=True)
results = []
for source, stem in [('newsdesk-desktop.png', 'newsdesk'), ('antou-v32.jpg', 'antou-v32')]:
    with Image.open(root / 'site/assets/img/screenshots' / source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        for width in [160, 320]:
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            name = f'{stem}-{width}.webp'
            if stream:
                buffer = io.BytesIO()
                resized.save(buffer, format='WEBP', quality=88, method=6)
                results.append({'name': name, 'data': base64.b64encode(buffer.getvalue()).decode('ascii')})
            else:
                resized.save(target / name, quality=88, method=6)
print(json.dumps(results) if stream else 'Featured thumbnails generated; original screenshots unchanged.')
