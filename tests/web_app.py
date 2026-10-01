"""Check deployable icon metadata and files using only the Python standard library."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import json
import struct

ROOT = Path(__file__).resolve().parents[1]

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = {}
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link':
            self.links[attrs.get('rel')] = attrs
        if tag == 'meta':
            self.meta[attrs.get('name')] = attrs.get('content')

def png_size(path):
    content = path.read_bytes()
    assert content[:8] == b'\x89PNG\r\n\x1a\n', path
    assert content[12:16] == b'IHDR', path
    # RGB, with no alpha or palette transparency: the OS supplies its own mask.
    assert content[25] == 2, path
    return struct.unpack('>II', content[16:24])

for output in (ROOT, ROOT / 'dist'):
    head = Head()
    head.feed((output / 'index.html').read_text())
    resolve = lambda url: output / urlsplit(url).path.lstrip('/')
    apple = head.links['apple-touch-icon']
    assert apple['href'].startswith('/')
    assert png_size(resolve(apple['href'])) == (180, 180)
    for name in ('apple-touch-icon.png', 'apple-touch-icon-precomposed.png'):
        assert (output / name).read_bytes() == resolve(apple['href']).read_bytes()
    manifest = json.loads(resolve(head.links['manifest']['href']).read_text())
    assert manifest['start_url'] == '/' and (output / 'index.html').is_file()
    assert manifest['display'] == 'standalone'
    assert manifest['name'] and head.meta['apple-mobile-web-app-title']
    assert head.meta['apple-mobile-web-app-capable'] == 'yes'
    sizes = set()
    for icon in manifest['icons']:
        size = png_size(resolve(icon['src']))
        assert icon['sizes'] == f'{size[0]}x{size[1]}'
        assert icon['type'] == 'image/png'
        sizes.add(size)
    assert {(192, 192), (512, 512)} <= sizes
print('PASS local and production Web App metadata, Apple fallbacks, opaque PNG sizes and manifest assets')
