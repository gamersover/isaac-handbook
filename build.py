from pathlib import Path
import json, argparse, hashlib, copy, shutil
import xml.etree.ElementTree as ET
parser=argparse.ArgumentParser()
parser.add_argument("--preview")
args=parser.parse_args()
root=Path(__file__).parent
# Collectibles and trinkets reuse IDs. Read only <item> metadata, never
# merge both namespaces into the same ID map.
catalog=json.loads((root/'data/catalog.json').read_text())
metadata={int(node.attrib['id']):node.attrib for node in
          ET.parse(root/'data/sources/items_metadata.xml').getroot().findall('item')}
translations=json.loads((root/'data/zh-cn.json').read_text())
catalog['references']=json.loads((root/'data/references.json').read_text())
for item in catalog['items']:
    item['quality']=int(metadata[item['id']]['quality'])
    item.update(translations.get(str(item['id']), {}))
    candidates=[root/'assets/items'/f'{item["id"]}.{ext}' for ext in ('webp','png')]
    asset=next((path for path in candidates if path.exists()),None)
    if asset is None:
        raise SystemExit(f'Missing icon for {item["id"]}; run python3 scripts/cache_icons.py')
    item.setdefault('iconSource',item['icon'])
    item['icon']=asset.relative_to(root).as_posix()
catalog.pop('versions', None)
catalog.update(label='忏悔', patch='1.7.9b')
# Build each edition from its own resource snapshot. Never apply Plus overrides
# to the base records: a later rebuild or edition switch must be reversible.
plus_dir=root/'data/sources/repentance-plus'
manifest=json.loads((plus_dir/'manifest.json').read_text())
for filename, digest in manifest['files'].items():
    assert hashlib.sha256((plus_dir/filename).read_bytes()).hexdigest()==digest, filename
patches=json.loads((root/'data/repentance-plus.json').read_text())
plus=copy.deepcopy(catalog)
plus.update(version=patches['version'], label=patches['label'], patch=patches['patch'],
            retrieved=manifest['retrieved'], sourceUrl=manifest['url'])
plus_metadata={int(n.attrib['id']):n.attrib for n in ET.parse(plus_dir/'items_metadata.xml').getroot().findall('item')}
plus_items={int(n.attrib['id']):n for n in ET.parse(plus_dir/'items.xml').getroot()
            if n.tag in ('passive','active','familiar')}
assert set(plus_items)=={x['id'] for x in plus['items']}, 'Review added/removed collectibles before building'
by_id={x['id']:x for x in plus['items']}
for item in plus['items']:
    node=plus_items[item['id']]
    item.update(quality=int(plus_metadata[item['id']]['quality']),
                charge=node.get('maxcharges'), chargeType=node.get('chargetype','normal'),
                hidden=node.get('hidden')=='true',
                type='Activated' if node.tag=='active' else 'Passive', pools=[])
    item.update(patches['items'].get(str(item['id']), {}))
pool_names={p['key']:p for p in catalog['pools']}
plus['pools']=[]
for node in ET.parse(plus_dir/'itempools.xml').getroot().findall('Pool'):
    key=node.attrib['Name']
    entries=[{'id':int(n.attrib['Id']),'weight':float(n.attrib['Weight'])} for n in node.findall('Item')]
    assert all(e['id'] in by_id for e in entries), key
    plus['pools'].append(dict(pool_names[key], entries=entries, count=len(entries)))
    for entry in entries:
        by_id[entry['id']]['pools'].append({'key':key,'weight':entry['weight']})
catalog['versions']={'repentance-plus':plus}
serialized=json.dumps(catalog,ensure_ascii=False,separators=(',', ':'))
(root/'data/catalog.json').write_text(serialized)
(root/'src/data.js').write_text('window.ISAAC_DATA='+serialized+';\n')
shell=(root/'src/shell.html').read_text()
css=(root/'src/styles.css').read_text()
data=(root/'src/data.js').read_text()
app=(root/'src/select.js').read_text()+'\n'+(root/'src/app.js').read_text()
fragment=shell.replace('<div id="isaac-preview">','<div id="isaac-preview">\n<style>'+css+'</style>',1)
fragment += '\n<script>\n'+data+'\n'+app+'\n</script>\n'
# Avoid leaking a global data variable in the inline copy.
inline=fragment.replace('window.ISAAC_DATA=', 'const ISAAC_CATALOG=').replace('const DATA=window.ISAAC_DATA;', 'const DATA=ISAAC_CATALOG;')
script_start=inline.index('<script>\n')+len('<script>\n')
inline=inline[:script_start]+'(() => {\n'+inline[script_start:]
inline=inline.replace('\n</script>','\n})();\n</script>')
(root/'dist').mkdir(exist_ok=True)
shutil.copytree(root/'assets',root/'dist/assets',dirs_exist_ok=True)
shutil.copyfile(root/'static/_headers',root/'dist/_headers')
# Keep icons identical in local previews and production. The root ICO also
# serves browsers that request /favicon.ico without reading the page links.
for destination in (root/'favicon.ico', root/'dist/favicon.ico'):
    shutil.copyfile(root/'assets/branding/favicon.ico', destination)
head='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="以撒忏悔道具图鉴、道具池查询与倒转骰子计算"><title>以撒道具手册</title><meta name="theme-color" content="#201f1b"><link rel="icon" href="assets/branding/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" type="image/svg+xml" href="assets/branding/favicon.svg"><link rel="apple-touch-icon" sizes="180x180" href="assets/branding/apple-touch-icon.png">'
page=head+'<style>body{margin:0;background:#141413}*{box-sizing:border-box}</style></head><body>'+fragment+'</body></html>'
(root/'dist/index.html').write_text(page)
revision=hashlib.sha256((css+data+app).encode()).hexdigest()[:12]
(root/'index.html').write_text(head+'<link rel="stylesheet" href="src/styles.css?v='+revision+'"><style>body{margin:0;background:#141413}*{box-sizing:border-box}</style></head><body>'+shell+'<script src="src/data.js?v='+revision+'"></script><script src="src/select.js?v='+revision+'"></script><script src="src/app.js?v='+revision+'"></script></body></html>')
if args.preview: Path(args.preview).write_text(inline)
print('Built:',len(page.encode()),'bytes; inline:',len(inline.encode()),'bytes')
