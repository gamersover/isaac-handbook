"""Cache the catalog's existing public image assets for static deployment."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen, Request

root = Path(__file__).resolve().parent.parent
assets = root / 'assets/items'
assets.mkdir(parents=True, exist_ok=True)
items = json.loads((root / 'data/catalog.json').read_text())['items']
def fetch(item):
    destination = assets / f'{item["id"]}.webp'
    if destination.exists() and destination.read_bytes()[:4] == b'RIFF':
        return None
    source = item.get('iconSource', item['icon'])
    if not source.startswith('https://cdn.jsdelivr.net/gh/Swashua/Bindings-of-Isaac-Cheat-Sheet@main/public/images/items/'):
        return item['id'], 'Unexpected source URL'
    for attempt in range(3):
        try:
            data = urlopen(Request(source, headers={'User-Agent': 'Isaac-Handbook-Asset-Build/1.0'}), timeout=25).read()
            if data.startswith(b'\x89PNG\r\n\x1a\n'):
                destination = destination.with_suffix('.png')
            elif data[:4] != b'RIFF' or data[8:12] != b'WEBP':
                raise ValueError('Not a PNG or WebP image')
            destination.write_bytes(data)
            return None
        except Exception as error:
            failure = str(error)
    return item['id'], failure
errors = []
with ThreadPoolExecutor(max_workers=12) as executor:
    for index, result in enumerate(executor.map(fetch, items), 1):
        if result: errors.append(result)
        if index % 100 == 0: print(f'Cached {index}/{len(items)}', flush=True)
print(json.dumps({'total': len(items), 'errors': errors, 'bytes': sum(p.stat().st_size for p in assets.glob('*'))}))
if errors: raise SystemExit(1)
