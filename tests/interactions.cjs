const {parseHTML}=require('linkedom');
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8');
const {document,window}=parseHTML(html);const memory=new Map();
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(value));},configurable:true});
const ctx={document,window,console,localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},navigator:{clipboard:{writeText:async()=>{}}},setTimeout:()=>0,clearTimeout:()=>{}};
vm.runInNewContext(document.querySelector('script').textContent,ctx);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const click=s=>{assert.ok($(s),s);$(s).click();};
const change=(s,v,type='change')=>{$(s).value=v;$(s).dispatchEvent(new window.Event(type));};
const input=(s,v)=>change(s,v,'input');
const ids=()=>$$('.item-card').map(x=>Number(x.dataset.id));
const page=()=>$('#pageLabel').textContent;
const results=[];function test(name,fn){fn();results.push(name);console.log('PASS',name);}
test('Initial catalog has 721 records; first page starts at onion #1',()=>{assert.equal($('#resultCount').textContent,'721');assert.equal(ids()[0],1);assert.equal($('#pagePrev').disabled,true);});
test('Pool directory shows 31 real pools and hidden room opens 62 entries',()=>{click('[data-view="pools"]');assert.equal($$('.pool-card').length,31);click('.pool-card[data-pool="secret"]');assert.equal($('#resultCount').textContent,'62');assert.equal($('.quick-actions .active').dataset.view,'all');assert.equal($('#poolSelect').value,'secret');});
test('Pool stays applied through next / previous; page is never zero',()=>{const first=ids();click('#pageNext');assert.equal($('#resultCount').textContent,'62');assert.equal(page(),'2 / 3');click('#pagePrev');assert.deepEqual(ids(),first);assert.equal(page(),'1 / 3');assert.equal($('#pagePrev').disabled,true);});
test('Secret pool + Q4 returns R Key, and detail lists actual pools',()=>{change('#qualitySelect','4');assert.ok(ids().includes(636));click('[data-open="636"]');assert.equal($('#drawer').getAttribute('aria-hidden'),'false');assert.equal($$('.detail-pools button').length,3);assert.ok($('.detail-pools').textContent.includes('隐藏房'));assert.ok($('.d-command').textContent.includes('g c636'));click('#drawerClose');});
test('Spindown mode ignores pool/quality filters and defaults to D6',()=>{click('[data-view="spindown"]');assert.equal($('.filters').hidden,true);assert.ok(Number($('#resultCount').textContent)>500);assert.equal(ids()[0],105);});
test('Search D6 sets the first item to #105 and keeps all subsequent entries',()=>{input('#searchInput','D6');assert.equal(ids()[0],105);assert.equal($('#spinTarget').textContent.includes('#105'),true);assert.equal(ids().length,24);assert.equal($('#targetSuggestions').hidden,true);});
test('D6 pages stay continuous and preserve selected mode',()=>{const first=ids();click('#pageNext');const second=ids();assert.ok(second[0]>first.at(-1));assert.equal($('.quick-actions .active').dataset.view,'spindown');click('#pageNext');assert.ok(ids()[0]>second.at(-1));click('#pagePrev');assert.deepEqual(ids(),second);click('#pagePrev');assert.deepEqual(ids(),first);assert.equal($('#pagePrev').disabled,true);});
test('R Key starts at 636; all high IDs are preserved including blocked route',()=>{input('#searchInput','R Key');assert.equal(ids()[0],636);change('#pageSize','96');assert.ok(ids().includes(732));assert.ok(ids().includes(668));assert.ok($('.item-card[data-id="668"]').textContent.includes('截断'));assert.ok($('.item-card[data-id="656"]').textContent.includes('跳过'));});
test('D20 #166 → D6 #105 = 61 uses; swap is impossible',()=>{click('[data-spin-task="calculate"]');assert.equal($('#calculator').hidden,false);assert.equal($('#catalogResults').hidden,true);input('#calcFrom','D20');input('#calcTo','D6');click('#calcRun');assert.ok($('#calcResult').textContent.includes('61 次'));click('#calcSwap');assert.ok($('#calcResult').textContent.includes('不能到达'));assert.ok($('#calcResult').textContent.includes('只会减少'));});
test('Missing and hidden IDs are skipped rather than counted as uses',()=>{input('#calcFrom','649');input('#calcTo','647');click('#calcRun');assert.ok($('#calcResult').textContent.includes('1 次'));assert.ok($('#calcResult').textContent.includes('跳过 1'));input('#calcFrom','657');input('#calcTo','655');click('#calcRun');assert.ok($('#calcResult').textContent.includes('1 次'));assert.ok($('#calcResult').textContent.includes('跳过 1'));});
test('Dad Note blocks 669 → 636 but allows 669 → 668',()=>{input('#calcFrom','669');input('#calcTo','636');click('#calcRun');assert.ok($('#calcResult').textContent.includes('不能到达'));input('#calcTo','668');click('#calcRun');assert.ok($('#calcResult').textContent.includes('1 次'));});
test('Equal items need 0 uses, invalid name and hidden target report invalid',()=>{input('#calcFrom','D6');input('#calcTo','105');click('#calcRun');assert.ok($('#calcResult').textContent.includes('0 次'));input('#calcFrom','不存在的道具');click('#calcRun');assert.ok($('#calcResult').textContent.includes('有效'));input('#calcFrom','60');input('#calcTo','59');click('#calcRun');assert.ok($('#calcResult').textContent.includes('不能到达'));});
test('Target suggestions support partial name and selectable start',()=>{click('[data-spin-task="sources"]');input('#searchInput','R Ke');assert.equal($('#targetSuggestions').hidden,false);click('#targetSuggestions [data-target="636"]');assert.equal(ids()[0],636);assert.equal($('#targetSuggestions').hidden,true);});
test('Detail action starts the list at its item; favorites survive page changes',()=>{click('[data-open="637"]');click('#drawer [data-target="637"]');assert.equal(ids()[0],637);assert.equal($('#drawer').getAttribute('aria-hidden'),'true');click('[data-favorite="637"]');assert.ok(memory.get('isaac:favorites').includes('637'));assert.equal(ids()[0],637);});
test('Pool selection in detail returns to normal catalog and applies that pool',()=>{click('[data-open="637"]');const pool=$('#drawer [data-pool]').dataset.pool;click('#drawer [data-pool]');assert.equal($('.quick-actions .active').dataset.view,'all');assert.equal($('#poolSelect').value,pool);assert.equal($('.filters').hidden,false);});
test('Empty search, reset, last page boundaries, page jump clamp',()=>{input('#searchInput','__nothing_exists__');assert.equal($('#resultCount').textContent,'0');assert.equal(page(),'1 / 1');assert.equal($('#pageNext').disabled,true);click('#resetFilters');assert.equal($('#resultCount').textContent,'721');change('#pageJump','9999');assert.equal($('#pageNext').disabled,true);assert.equal(ids().at(-1),732);change('#pageJump','-50');assert.equal(ids()[0],1);assert.equal($('#pagePrev').disabled,true);});
test('Pool entries all refer to real item records; R Key and D6 match source membership',()=>{const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/catalog.json')));const all=new Set(data.items.map(x=>x.id));assert.ok(data.pools.every(p=>p.entries.every(e=>all.has(e.id))));assert.deepEqual(data.items.find(x=>x.id===636).pools.map(x=>x.key),['secret','greedShop','greedSecret']);assert.equal(data.items.filter(x=>x.hidden).length,4);});

test('Quality display and filtering agree for D6 Q4',()=>{click('[data-view="all"]');click('#resetFilters');input('#searchInput','D6');assert.equal(ids()[0],105);assert.equal($('.item-card[data-id="105"] .qbadge').textContent,'Q4');change('#qualitySelect','4');assert.ok(ids().includes(105));assert.equal($('#qualitySelect').value,'4');});
test('Pool search stays in its column and uses one search field',()=>{click('[data-view="pools"]');input('#searchInput','隐藏');assert.equal($('.quick-actions .active').dataset.view,'pools');assert.ok($$('.pool-card').length>=3);assert.ok($$('.pool-card').every(p=>p.textContent.includes('隐藏')));assert.equal($('#searchInput').getAttribute('aria-label'),'搜索道具池');change('#poolMode','greed');assert.ok($$('.pool-card').every(p=>p.textContent.includes('贪婪模式')));click('.pool-card');click('#backPools');assert.equal($('#searchInput').value,'隐藏');assert.equal($('#poolMode').value,'greed');});
test('Favorites do not inherit catalog filters; each view retains its query',()=>{click('[data-view="all"]');click('#resetFilters');input('#searchInput','D6');change('#qualitySelect','4');click('[data-favorite="105"]');click('[data-view="favorites"]');assert.ok(ids().includes(105));assert.ok(ids().includes(637));assert.equal($('#poolSelect').value,'all');input('#searchInput','D6');click('[data-view="all"]');assert.equal($('#searchInput').value,'D6');assert.equal($('#qualitySelect').value,'4');click('[data-view="favorites"]');assert.equal($('#searchInput').value,'D6');});
test('Removing a favorite offers an undo and restores the item',()=>{click('[data-favorite="105"]');assert.ok(!ids().includes(105));assert.ok($('#undoFavorite'));click('#undoFavorite');assert.ok(ids().includes(105));assert.equal($('#favoriteCount').textContent,'2');});
test('Dialog locks background and preserves both scroll positions during favorite changes',()=>{click('[data-open="105"]');assert.equal($('#drawer').hidden,false);assert.equal($('.app-shell').hasAttribute('inert'),true);assert.equal($('#contentScroll').style.overflow,'hidden');$('#drawerContent').scrollTop=150;click('#detailFavorite');assert.equal($('#drawerContent').scrollTop,150);assert.equal($('#drawer').hidden,false);click('#drawerClose');assert.equal($('#drawer').hidden,true);assert.equal($('.app-shell').hasAttribute('inert'),false);assert.equal($('#contentScroll').style.overflow,'');});
test('Individual filter chips clear only their own condition',()=>{click('[data-view="all"]');assert.equal($('#searchInput').value,'D6');click('[data-clear-filter="q"]');assert.equal($('#searchInput').value,'D6');assert.equal($('#qualitySelect').value,'all');click('#clearSearch');assert.equal($('#resultCount').textContent,'721');});
test('Mobile filters expose expanded state and close on show results',()=>{click('#filterToggle');assert.equal($('#filterToggle').getAttribute('aria-expanded'),'true');assert.equal($('.filters').classList.contains('is-expanded'),true);click('#filterDone');assert.equal($('#filterToggle').getAttribute('aria-expanded'),'false');});
test('Calculation becomes stale when input changes and marks invalid field',()=>{click('[data-view="spindown"]');click('[data-spin-task="calculate"]');input('#calcFrom','D20');input('#calcTo','D6');click('#calcRun');assert.ok($('#calcResult').textContent.includes('61 次'));input('#calcFrom','bad item');assert.ok(!$('#calcResult').textContent.includes('61 次'));click('#calcRun');assert.equal($('#calcFrom').getAttribute('aria-invalid'),'true');assert.equal($('#calcTo').getAttribute('aria-invalid'),'false');});
test('Chinese summaries can be searched and original descriptions stay in details',()=>{click('[data-view="all"]');click('#resetFilters');input('#searchInput','99 把钥匙');assert.deepEqual(ids(),[17]);click('[data-open="17"]');assert.ok($('#drawerContent').textContent.includes('获得 99 把钥匙'));assert.ok($('#drawerContent').textContent.includes('Gives Isaac 99 Keys.'));click('#drawerClose');});
// Geometry is supplied only for popup interaction tests; production uses the browser viewport.
window.innerWidth=1280;window.innerHeight=900;
window.HTMLElement.prototype.getBoundingClientRect=function(){return {left:40,top:300,bottom:342,width:180,height:42};};
const key=(selector,value)=>{const event=new window.Event('keydown',{bubbles:true,cancelable:true});event.key=value;$(selector).dispatchEvent(event);};
test('All six select controls expose labels and keep native values synchronized',()=>{
 click('[data-view="all"]');click('#resetFilters');assert.equal($$('.select-trigger').length,6);
 assert.equal($('#poolSelect').hidden,true);assert.equal($('label[for="poolSelect-trigger"]').textContent,'道具池');
 click('#sortSelect-trigger');key('#sortSelect-trigger','End');key('#sortSelect-trigger','Enter');
 assert.equal($('#sortSelect').value,'name');assert.equal($('#sortSelect-trigger').textContent,'英文名 A–Z');
 assert.equal($('#sortSelect-trigger').getAttribute('aria-expanded'),'false');
 assert.equal($('label[for="qualitySelect-trigger"]').textContent,'品质');
 click('#qualitySelect-trigger');key('#qualitySelect-trigger','End');key('#qualitySelect-trigger','Enter');
 assert.equal($('#qualitySelect').value,'4');assert.equal($('#qualitySelect-trigger').textContent,'Q4');
 assert.ok($$('.item-card .qbadge').every(b=>b.textContent==='Q4'));
 click('#qualitySelect-trigger');key('#qualitySelect-trigger','Home');key('#qualitySelect-trigger','ArrowDown');key('#qualitySelect-trigger','Enter');
 assert.equal($('#qualitySelect').value,'0');assert.ok($$('.item-card .qbadge').every(b=>b.textContent==='Q0'));
 click('#resetFilters');assert.equal($('#qualitySelect-trigger').textContent,'全部品质');assert.equal($('#qualitySelect').value,'all');
 assert.equal($('#sortSelect-trigger').textContent,'ID 从小到大');
});
test('Searchable pool selection filters options and applies the real catalog filter',()=>{
 click('#poolSelect-trigger');input('.select-search','隐藏');
 assert.equal($$('#poolSelect-listbox [role=option]:not([hidden])').length,3);
 key('.select-search','Enter');assert.equal($('#poolSelect').value,'secret');assert.equal($('#resultCount').textContent,'62');
 assert.ok($('#poolSelect-trigger').textContent.includes('隐藏房'));
 assert.equal($('#poolSelect-listbox [data-value="secret"]').getAttribute('aria-selected'),'true');
});
test('Empty pool search, Escape and Tab preserve the selected value',()=>{
 click('#poolSelect-trigger');input('.select-search','no-such-pool');assert.equal($('.select-search').parentElement.querySelector('.select-empty').hidden,false);
 key('.select-search','Enter');assert.equal($('#poolSelect-trigger').getAttribute('aria-expanded'),'true');
 key('.select-search','Escape');assert.equal($('#poolSelect-trigger').getAttribute('aria-expanded'),'false');
 assert.equal($('#poolSelect').value,'secret');click('#poolSelect-trigger');key('.select-search','Tab');
 assert.equal($('#poolSelect-trigger').getAttribute('aria-expanded'),'false');
});
test('Only one popup opens; outside pointer and view changes dismiss it; recent sorting stays disabled',()=>{
 click('#poolSelect-trigger');click('#sortSelect-trigger');assert.equal($('#poolSelect-trigger').getAttribute('aria-expanded'),'false');
 assert.equal($$('.select-popup:not([hidden])').length,1);
 $('#searchInput').dispatchEvent(new window.Event('pointerdown',{bubbles:true}));
 assert.equal($('#sortSelect-trigger').getAttribute('aria-expanded'),'false');
 click('#poolSelect-trigger');click('[data-view="recent"]');assert.equal($$('.select-popup:not([hidden])').length,0);
 assert.equal($('#sortSelect-trigger').disabled,true);click('[data-view="all"]');assert.equal($('#sortSelect-trigger').disabled,false);
});
test('Page-size and directory mode custom options dispatch existing change behavior',()=>{
 click('#resetFilters');click('#pageSize-trigger');click('#pageSize-listbox [data-value="48"]');assert.equal(ids().length,48);
 click('[data-view="pools"]');input('#searchInput','');click('#poolMode-trigger');click('#poolMode-listbox [data-value="greed"]');
 assert.ok($$('.pool-card').length>0);assert.ok($$('.pool-card').every(p=>p.textContent.includes('贪婪模式')));
});
// Drive animation completion explicitly to cover interrupted transitions without timeouts.
const animated=[];
window.HTMLElement.prototype.animate=function(frames,options){
 const a={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true;},finish(){this.complete?.();},finished:{then(done){a.complete=done;}}};
 animated.push(a);return a;
};
let reduceMotion=false;
window.matchMedia=query=>({matches:query.includes('prefers-reduced-motion')&&reduceMotion});
test('Interrupted drawer close cannot hide reopened details or unlock their background',()=>{
 click('[data-view="all"]');click('#resetFilters');click('[data-open="1"]');click('#drawerClose');
 const closing=animated.filter(a=>a.target.id==='drawer').at(-1);
 assert.equal($('#drawer').hidden,false);assert.equal($('.app-shell').hasAttribute('inert'),true);
 click('#drawer [data-open="2"]');closing.finish();
 assert.equal($('#drawer').hidden,false);assert.equal($('.app-shell').hasAttribute('inert'),true);
 click('#drawerClose');animated.filter(a=>a.target.id==='drawer').at(-1).finish();
 assert.equal($('#drawer').hidden,true);assert.equal($('.app-shell').hasAttribute('inert'),false);
});
test('Reopening a closing select keeps the new popup visible',()=>{
 click('#sortSelect-trigger');key('#sortSelect-trigger','Escape');const closing=animated.at(-1);
 click('#sortSelect-trigger');closing.finish();assert.equal($('#sortSelect-trigger').getAttribute('aria-expanded'),'true');
 assert.equal($('#sortSelect-listbox').parentElement.hidden,false);
 key('#sortSelect-trigger','Escape');animated.at(-1).finish();assert.equal($('#sortSelect-listbox').parentElement.hidden,true);
});
test('Reduced-motion preference bypasses animations and closes dialogs immediately',()=>{
 reduceMotion=true;const before=animated.length;
 click('[data-open="1"]');click('#drawerClose');click('#sortSelect-trigger');key('#sortSelect-trigger','Escape');
 assert.equal(animated.length,before);assert.equal($('#drawer').hidden,true);assert.equal($('#sortSelect-listbox').parentElement.hidden,true);
});
test('New Chinese effects are searchable and keep the original English available',()=>{
 click('[data-view="all"]');click('#resetFilters');input('#searchInput','切换当前骰子');assert.deepEqual(ids(),[489]);
 click('[data-open="489"]');assert.ok($('#drawerContent').textContent.includes('中文摘要'));
 assert.ok($('#drawerContent').textContent.includes('使用以撒击败精神错乱'));
 assert.ok($('#drawerContent .original-text').textContent.includes('die item'));click('#drawerClose');
});
test('Missing source effects have explicit Chinese notices and no empty original disclosure',()=>{
 for(const id of [59,656]){
  input('#searchInput','c'+id);click('[data-open="'+id+'"]');
  assert.ok($('#drawerContent').textContent.includes('资料缺失'));
  assert.ok($('#drawerContent').textContent.includes('未提供独立效果说明'));
  assert.equal($('#drawerContent .original-text'),null);click('#drawerClose');
 }
});
const openDetail=id=>{if(!$('#drawer').hidden)click('#drawerClose');click('[data-view="all"]');click('#resetFilters');input('#searchInput','c'+id);click('[data-open="'+id+'"]');};
test('Dollar acquisition contains only its specific source and links the slot machine explanation',()=>{
 openDetail(18);const section=$('.acquisition-section');assert.ok(section.textContent.includes('老虎机'));
 assert.ok(!section.textContent.includes('死亡证明'));assert.ok(!section.textContent.includes('倒转 1 次'));
 assert.ok(!section.textContent.includes('undefined'));
 const link=section.querySelector('.wiki-reference');assert.equal(decodeURIComponent(link.getAttribute('href')),'https://isaac.huijiwiki.com/wiki/赌博机');
 assert.equal(link.getAttribute('target'),'_blank');assert.ok(link.getAttribute('rel').includes('noopener'));
});
test('Inline item links navigate in the drawer; Back restores the original text disclosure and scroll',()=>{
 openDetail(283);const before=$('#detailTitle').textContent;$('#drawerContent .original-text').open=true;$('#drawerContent').scrollTop=180;
 click('#drawerContent .item-reference[data-open="105"]');assert.ok($('#detailTitle').textContent.includes('六面骰'));
 assert.equal($('#drawerBack').hidden,false);click('#drawerBack');assert.equal($('#detailTitle').textContent,before);
 assert.equal($('#drawerContent').scrollTop,180);assert.equal($('#drawerContent .original-text').open,true);assert.equal($('#drawerBack').hidden,true);
 click('#drawerClose');openDetail(18);assert.equal($('#drawerBack').hidden,true);
});
test('Boss references do not open same-name items, and player/boss Isaac have different targets',()=>{
 openDetail(489);const boss=$$('.d-unlock a').find(a=>a.textContent==='精神错乱');
 assert.ok(decodeURIComponent(boss.getAttribute('href')).endsWith('/实体/412'));assert.ok(!boss.getAttribute('href').includes('%2F'));
 assert.equal($('.d-unlock [data-open="510"]'),null);
 openDetail(323);const isaacs=$$('.d-unlock a').filter(a=>a.textContent==='以撒');assert.equal(isaacs.length,2);
 assert.notEqual(isaacs[0].getAttribute('href'),isaacs[1].getAttribute('href'));
 assert.ok(decodeURIComponent(isaacs[1].getAttribute('href')).endsWith('/以撒_(首领)'));
});
test('Longest reference wins and generic words do not become unrelated item links',()=>{
 openDetail(168);assert.ok($('#drawerContent .item-reference[data-open="47"]'));
 assert.equal($('#drawerContent .item-reference[data-open="52"]'),null);
 openDetail(713);assert.equal($('#drawerContent .item-reference[data-open="254"]'),null);
 openDetail(531);assert.ok($('.d-unlock .item-reference[data-open="254"]'));
 openDetail(104);assert.ok($('.d-unlock .item-reference[data-open="81"]'));
 openDetail(187);assert.equal($('.d-unlock .item-reference[data-open="81"]'),null);assert.ok($('.d-unlock .wiki-reference'));
});

test('Global edition changes effect text, charge and quality without mutating Repentance',()=>{
 openDetail(436);assert.ok($('#drawerContent').textContent.includes('本房间内射速'));
 change('#versionSelect','repentance-plus');assert.ok($('#drawerContent').textContent.includes('挡下 10 次'));
 assert.ok($('.detail-edition').textContent.includes('1.9.7.15'));assert.equal($('#drawerContent .original-text'),null);
 assert.equal(JSON.parse(memory.get('isaac:version')),'repentance-plus');
 openDetail(477);assert.ok($('.d-type').textContent.includes('4 格充能'));assert.equal($('.d-quality-row b').textContent,'Q3');
 change('#versionSelect','repentance');assert.ok($('.d-type').textContent.includes('6 格充能'));assert.equal($('.d-quality-row b').textContent,'Q4');
 openDetail(436);assert.ok($('#drawerContent').textContent.includes('本房间内射速'));
});
test('Version-specific pool membership, directory counts and select option counts stay synchronized',()=>{
 click('#drawerClose');click('#resetFilters');change('#poolSelect','shop');input('#searchInput','c177');assert.deepEqual(ids(),[177]);
 change('#versionSelect','repentance-plus');assert.deepEqual(ids(),[]);assert.equal($('#poolSelect').value,'shop');assert.equal($('#searchInput').value,'c177');
 assert.ok($('#poolSelect-trigger').textContent.includes('(94)'));assert.equal($('#poolSelect-listbox [data-value="shop"] small').textContent,'94');
 click('[data-view="pools"]');change('#poolMode','all');input('#searchInput','');assert.ok($('.pool-card[data-pool="shop"] strong').textContent.includes('94'));
 change('#versionSelect','repentance');assert.ok($('.pool-card[data-pool="shop"] strong').textContent.includes('95'));
 click('[data-view="all"]');assert.deepEqual(ids(),[177]);
});
test('Quality filtering and search use the active edition while favorites remain shared',()=>{
 click('#resetFilters');input('#searchInput','c562');change('#qualitySelect','4');assert.deepEqual(ids(),[]);
 change('#versionSelect','repentance-plus');assert.deepEqual(ids(),[562]);click('[data-favorite="562"]');
 change('#versionSelect','repentance');assert.deepEqual(ids(),[]);click('[data-view="favorites"]');click('#resetFilters');assert.ok(ids().includes(562));
 click('[data-view="all"]');click('#resetFilters');input('#searchInput','挡下 10 次');assert.deepEqual(ids(),[]);
 change('#versionSelect','repentance-plus');assert.deepEqual(ids(),[436]);
});
test('Switching edition invalidates calculations and uses current pool options via keyboard',()=>{
 click('[data-view="spindown"]');click('[data-spin-task="calculate"]');input('#calcFrom','D20');input('#calcTo','D6');click('#calcRun');assert.ok($('#calcResult').textContent.includes('61 次'));
 change('#versionSelect','repentance');assert.ok($('#calcResult').textContent.includes('版本已切换'));click('#calcRun');assert.ok($('#calcResult').textContent.includes('61 次'));
 click('[data-view="all"]');click('#resetFilters');click('#versionSelect-trigger');key('#versionSelect-trigger','End');key('#versionSelect-trigger','Enter');
 assert.equal($('#versionSelect').value,'repentance-plus');click('#poolSelect-trigger');input('.select-search','商店');
 key('.select-search','Enter');assert.equal($('#poolSelect').value,'shop');assert.equal($('#resultCount').textContent,'94');
});
test('Saved edition loads on startup, and invalid preferences safely fall back',()=>{
 for(const saved of ['repentance-plus','obsolete-version']){
  const fresh=parseHTML(html);fresh.window.HTMLElement.prototype.animate=undefined;
  const storage=new Map([['isaac:version',JSON.stringify(saved)]]);
  vm.runInNewContext(fresh.document.querySelector('script').textContent,{document:fresh.document,window:fresh.window,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},setTimeout:()=>0,clearTimeout:()=>{}});
  const expected=saved==='repentance-plus'?'repentance-plus':'repentance';
  assert.equal(fresh.document.querySelector('#versionSelect').value,expected);
  assert.ok(fresh.document.querySelector('.version-label').textContent.includes(expected==='repentance-plus'?'1.9.7.15':'1.7.9b'));
 }
});

console.log(JSON.stringify({passed:results.length,tests:results},null,2));
