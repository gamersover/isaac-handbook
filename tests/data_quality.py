"""Check generated qualities against collectible-only source metadata."""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
catalog = json.loads((root / 'data/catalog.json').read_text())
metadata = {int(x.attrib['id']): int(x.attrib['quality']) for x in
            ET.parse(root / 'data/sources/items_metadata.xml').getroot().findall('item')}
wrong = [(x['id'], x['quality'], metadata.get(x['id'])) for x in catalog['items']
         if x['quality'] != metadata.get(x['id'])]
assert not wrong, f'Collectible qualities differ from source: {wrong}'
script = (root / 'src/data.js').read_text().strip()
assert json.loads(script.removeprefix('window.ISAAC_DATA=').removesuffix(';')) == catalog
assert next(x for x in catalog['items'] if x['id'] == 105)['quality'] == 4
assert next(x for x in catalog['items'] if x['id'] == 1)['quality'] == 3
print(f'PASS all {len(catalog["items"])} qualities match collectible metadata; browser data matches catalog')

translations = json.loads((root / 'data/zh-cn.json').read_text())
assert set(translations) == {str(x['id']) for x in catalog['items']}, 'Translation IDs do not match catalog'
missing = []
for item in catalog['items']:
    for field in ('descriptionZh', 'unlockZh'):
        text = item.get(field, '')
        if not re.search(r'[\u4e00-\u9fff]', text):
            missing.append((item['id'], field))
        assert text == translations[str(item['id'])].get(field), f'Generated translation differs: {item["id"]} {field}'
    if not item.get('description'):
        assert item.get('descriptionStatus') == 'unavailable', f'Missing source effect must be explicit: {item["id"]}'
    else:
        assert item.get('descriptionStatus') != 'unavailable'
assert not missing, f'Chinese content missing: {missing}'
available = sum(x.get('descriptionStatus') != 'unavailable' for x in catalog['items'])
print(f'PASS {available} Chinese effect summaries; {len(catalog["items"])-available} explicit missing-source notices; all unlock conditions localized')

references = json.loads((root / 'data/references.json').read_text())
assert catalog['references'] == references
item_ids = {x['id'] for x in catalog['items']}
entries = references['items'] + references['wiki']
for item_id, fields in references['overrides'].items():
    assert int(item_id) in item_ids
    for field, overrides in fields.items():
        assert field in ('descriptionZh', 'unlockZh', 'acquisition', 'acquisitionNote')
        entries += overrides
for ref in entries:
    assert ref['terms'] and all(ref['terms'])
    assert sum(key in ref for key in ('itemId', 'page', 'search')) == 1
    if 'itemId' in ref:
        assert ref['itemId'] in item_ids
print('PASS reference targets resolve to catalog items or explicitly mapped Wiki entries')

plus = catalog['versions']['repentance-plus']
plus_dir = root / 'data/sources/repentance-plus'
plus_meta = {int(n.get('id')): n for n in ET.parse(plus_dir / 'items_metadata.xml').getroot().findall('item')}
plus_xml = {int(n.get('id')): n for n in ET.parse(plus_dir / 'items.xml').getroot() if n.tag in ('active', 'passive', 'familiar')}
plus_by_id = {x['id']: x for x in plus['items']}
patches = json.loads((root / 'data/repentance-plus.json').read_text())['items']
assert set(plus_by_id) == item_ids == set(plus_xml)
for item in plus['items']:
    node = plus_xml[item['id']]
    assert item['quality'] == int(plus_meta[item['id']].get('quality'))
    assert item['charge'] == node.get('maxcharges')
    assert item['chargeType'] == node.get('chargetype', 'normal')
    assert item['hidden'] == (node.get('hidden') == 'true')
    assert re.search(r'[\u4e00-\u9fff]', item['descriptionZh'])
    if str(item['id']) in patches:
        patch = patches[str(item['id'])]
        assert all(item[field] == value for field, value in patch.items())
        assert item['description'] == '', 'Do not display stale English for changed effects'
        assert item.get('descriptionSource', '').startswith('https://')
    else:
        assert item['descriptionZh'] == translations[str(item['id'])]['descriptionZh']
expected_membership = {i: [] for i in item_ids}
for node, pool in zip(ET.parse(plus_dir / 'itempools.xml').getroot().findall('Pool'), plus['pools']):
    expected = [{'id': int(n.get('Id')), 'weight': float(n.get('Weight'))} for n in node.findall('Item')]
    assert pool['key'] == node.get('Name') and pool['entries'] == expected and pool['count'] == len(expected)
    for entry in expected:
        expected_membership[entry['id']].append({'key': pool['key'], 'weight': entry['weight']})
assert all(x['pools'] == expected_membership[x['id']] for x in plus['items'])
assert plus_by_id[436]['descriptionZh'] != translations['436']['descriptionZh']
assert plus_by_id[477]['charge'] == '4'
assert 'shop' not in {p['key'] for p in plus_by_id[177]['pools']}
assert plus_by_id[562]['quality'] == 4
print(f'PASS Plus: all {len(plus_by_id)} items and {len(plus["pools"])} pools match independent XML; {len(patches)} localized effect overrides')
