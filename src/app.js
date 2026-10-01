(() => {
'use strict';
const root=document.getElementById('isaac-preview');
const $=s=>root.querySelector(s), $$=s=>[...root.querySelectorAll(s)];
const DATA=window.ISAAC_DATA;
let catalog=DATA, items, byId, pools, usable, ranks;
function loadEdition(key){
 catalog=key==='repentance-plus'?DATA.versions[key]:DATA;
 items=catalog.items;byId=new Map(items.map(x=>[x.id,x]));
 pools=new Map(catalog.pools.map(p=>[p.key,p]));
 usable=items.filter(x=>!x.hidden);ranks=new Map(usable.map((x,i)=>[x.id,i]));
}
const aliases={481:['红镐子','红稿子','红镐','红稿','红色镐子','honggaozi'],147:['镐子','稿子','铁镐','gaozi','pickaxe'],166:['D20','二十面骰'],105:['D6','六面骰'],636:['R Key','R键','R键盘'],127:['后悔药'],191:['三美刀'],723:['Spindown','倒转骰子','减一骰子'],189:['超级食肉男孩死忠粉']};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Only annotated terms become links. All text, including unmatched parts, is escaped.
const referenceData=DATA.references;
function referenceText(value,item,field){
 const text=String(value??''),terms=new Map(),used=new Set();
 // Reserve full item names so a shorter boss/mechanic cannot match inside them.
 items.forEach(x=>terms.set(x.cn,{skip:true}));
 const add=ref=>ref.terms.forEach(term=>terms.set(term,ref));
 referenceData.items.forEach(add);
 referenceData.wiki.filter(r=>!r.fields||r.fields.includes(field)).forEach(add);
 (referenceData.overrides[String(item.id)]?.[field]||[]).forEach(add);
 const regex=new RegExp([...terms.keys()].sort((a,b)=>b.length-a.length).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 let output='',last=0;
 for(const match of text.matchAll(regex)){
  const term=match[0],index=match.index;let ref=terms.get(term);
  output+=esc(text.slice(last,index));last=index+term.length;
  if(field==='unlockZh'&&referenceData.contextualBosses[term]&&text.slice(0,index).endsWith('击败'))ref={page:referenceData.contextualBosses[term],category:'Boss'};
  const key=ref.itemId?'item:'+ref.itemId:ref.page?'page:'+ref.page:'search:'+ref.search;
  if(ref.skip||ref.itemId===item.id||used.has(key)){output+=esc(term);continue;}
  used.add(key);
  if(ref.itemId){
   const target=byId.get(ref.itemId);
   output+=`<button type="button" class="inline-reference item-reference" data-open="${target.id}" data-reference="${esc(key)}" title="查看${esc(target.cn)}的道具说明" aria-label="查看 ${esc(target.cn)} 详情">${esc(term)}</button>`;
  }else{
   const url=ref.page?'https://isaac.huijiwiki.com/wiki/'+ref.page.split('#').map(part=>part.split('/').map(encodeURIComponent).join('/')).join('#'):'https://isaac.huijiwiki.com/index.php?title=Special:Search&search='+encodeURIComponent(ref.search);
   const label=`${ref.category||'词条'} · ${ref.page?'查看':'查找'}${term} · 中文 Wiki（新标签页）`;
   output+=`<a class="inline-reference wiki-reference" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(label)}" aria-label="${esc(label)}">${esc(term)}</a>`;
  }
 }
 return output+esc(text.slice(last));
}
const detailHistory=[];
function backDetail(){
 const previous=detailHistory.pop();if(!previous)return;
 openItem(previous.id,{remember:false,restore:previous});
}

const norm=s=>String(s??'').toLowerCase().replace(/[\s·•'’._\-—]/g,'');
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem('isaac:'+k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem('isaac:'+k,JSON.stringify(v))}catch{}};
const state={view:'all',query:'',poolQuery:'',spinTask:'sources',target:105,pool:'all',q:'all',types:new Set(['Passive','Activated']),sort:'id-asc',page:0,pageSize:24,filtered:[],favorites:new Set(read('favorites',[])),recent:read('recent',[])};
state.version=read('version','repentance')==='repentance-plus'?'repentance-plus':'repentance';
loadEdition(state.version);
let detailId=null, returnFocus=null, returnScroll=0, toastTimer, undoFavorite=null;
let selectUI, drawerClosing=false, drawerVersion=0;
let drawerGesture=null, suppressSwipeClickUntil=0;
const animations=new WeakMap(), renderKeys=new WeakMap();
function motion(node,frames,duration=220){
 animations.get(node)?.cancel();
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!node.animate)return null;
 const animation=node.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
 animations.set(node,animation);return animation;
}
function reveal(node,key){
 if(node.hidden||renderKeys.get(node)===key)return;
 renderKeys.set(node,key);motion(node,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}]);
}
const viewStates=new Map();
const scroller=$('#contentScroll');
function renderEdition(){
 $('#versionSelect').value=state.version;
 $('#sourceStatus').textContent=`${items.length} 个条目 · ${catalog.pools.length} 个道具池`;
 $('.version-label').textContent=catalog.label+' · '+catalog.patch;
 $('#editionNote').textContent=`当前：${catalog.label} ${catalog.patch}。品质、充能与道具池对应此补丁；效果提供中文摘要。`;
 $('#sourceDate').textContent='非官方道具手册 · 数据检索于 '+catalog.retrieved;
 $('#editionSource').href=catalog.sourceUrl||'https://github.com/Derugon/TBoIR-resources/tree/master/1.7.9b.J835/resources-dlc3';
 $('#poolSelect').innerHTML='<option value="all">全部道具池</option>'+catalog.pools.map(p=>`<option value="${p.key}">${esc(p.name)} (${p.count})</option>`).join('');
 $('#itemOptions').innerHTML=usable.map(x=>`<option value="${x.id} · ${esc(x.cn)}">${esc(x.en)}</option>`).join('');
 selectUI?.sync();
}
function switchEdition(key){
 if(!['repentance','repentance-plus'].includes(key)||key===state.version)return;
 selectUI?.close();const opened=detailId;
 state.version=key;write('version',key);loadEdition(key);
 hideSuggestions();renderEdition();
 renderKeys.delete($('#itemGrid'));renderKeys.delete($('#poolGrid'));
 // Keep the user's query, filters and favorites; re-evaluate them in this edition.
 apply(false);
 $('#calcResult').classList.remove('invalid');
 $('#calcResult').textContent='版本已切换，点击计算查看当前版本的结果。';
 if(opened!==null){detailHistory.length=0;openItem(opened,{remember:false});}
 toast(`已切换至${catalog.label} ${catalog.patch}`);
}
const filterDefaults=()=>({query:'',pool:'all',q:'all',types:new Set(['Passive','Activated']),sort:'id-asc',page:0});
function snapshotView(){return {query:state.query,pool:state.pool,q:state.q,types:new Set(state.types),sort:state.sort,page:state.page,scroll:scroller.scrollTop};}
function syncFilters(){
 $('#poolSelect').value=state.pool;$('#sortSelect').value=state.sort;
 $$('[data-type]').forEach(c=>c.checked=state.types.has(c.dataset.type));
 $('#qualitySelect').value=state.q;
 $('#sortSelect').disabled=state.view==='recent';selectUI?.sync();
}
let filterVersion=0;
function setFiltersOpen(open,immediate=false){
 const filters=$('.filters'),changed=filters.classList.contains('is-expanded')!==open,version=++filterVersion;
 animations.get(filters)?.cancel();selectUI?.close();
 $('#filterToggle').setAttribute('aria-expanded',String(open));
 const mobile=window.matchMedia?.('(max-width: 800px)').matches;
 if(!changed||!mobile||immediate){filters.classList.toggle('is-expanded',open);return;}
 if(open)filters.classList.add('is-expanded');
 const height=filters.getBoundingClientRect().height;
 const frames=[{height:'0px',opacity:0,paddingTop:0,paddingBottom:0,overflow:'hidden'}, {height:height+'px',opacity:1,paddingTop:'16px',paddingBottom:'16px',overflow:'hidden'}];
 const animation=motion(filters,open?frames:frames.reverse());
 if(!open){const finish=()=>{if(version===filterVersion)filters.classList.remove('is-expanded');};if(animation)animation.finished.then(finish,()=>{});else finish();}
}
function switchView(view){
 if(state.view===view)return;
 renderKeys.delete($('#itemGrid'));renderKeys.delete($('#poolGrid'));renderKeys.delete($('#calculator'));
 viewStates.set(state.view,snapshotView());
 const saved=viewStates.get(view)||filterDefaults();
 Object.assign(state,saved,{view});syncFilters();setFiltersOpen(false,true);hideSuggestions();
 $('#searchInput').value=view==='pools'?state.poolQuery:view==='spindown'?byId.get(state.target).cn:state.query;
 apply(false);scroller.scrollTop=saved.scroll||0;
}
function showResults(){
 setFiltersOpen(false,true);
 $('.result-head').scrollIntoView?.({block:'start'});
 $('.result-head').focus?.({preventScroll:true});
}
function goPage(page){state.page=page;render();showResults();}
function hideSuggestions(){ $('#targetSuggestions').hidden=true;$('#searchInput').setAttribute('aria-expanded','false'); }

const searchValues=x=>[String(x.id),'c'+x.id,x.cn,x.en,x.pinyin,x.initials,...(aliases[x.id]||[])];
const exact=q=>items.find(x=>searchValues(x).some(v=>norm(v)===norm(q)));
const match=(x,q)=>!q||[...searchValues(x),x.descriptionZh,x.description,x.quote,x.acquisition?.label,x.acquisition?.description].some(v=>norm(v).includes(norm(q)));
const icon=x=>x.icon?`<img loading="lazy" src="${esc(x.icon)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="no-icon" hidden>#${x.id}</span>`:`<span class="no-icon">#${x.id}</span>`;
const poolBadges=(x,limit=2)=>x.pools.slice(0,limit).map(p=>`<span class="pool-tag">${esc(pools.get(p.key)?.name||p.key)}</span>`).join('')+(x.pools.length>limit?`<span class="pool-more">+${x.pools.length-limit}</span>`:'');
function spinInfo(id,target=state.target){
 const x=byId.get(id),t=byId.get(target);
 if(!x||!t)return {steps:null,label:'未知道具'};
 if(x.hidden||t.hidden)return {steps:null,label:'隐藏条目 · 自动跳过'};
 if(id===target)return {steps:0,label:'目标道具'};
 if(id<target)return {steps:null,label:'ID 小于目标'};
 if(id>=668&&target<668)return {steps:null,label:'爸爸的便条截断路线'};
 const steps=ranks.get(id)-ranks.get(target);
 return {steps,label:`${steps} 次倒转`};
}
function apply(reset=true){
 if(reset){state.page=0;if(!$('.filters').classList.contains('is-expanded'))scroller.scrollTop=0;}
 let arr;
 if(state.view==='spindown'){
  // This mode changes only the start of the ordered catalog. Pool/quality/search filters do not apply.
  arr=items.filter(x=>x.id>=state.target);
 }else{
  arr=items.filter(x=>match(x,state.query));
  if(state.pool!=='all')arr=arr.filter(x=>x.pools.some(p=>p.key===state.pool));
  if(state.q!=='all')arr=arr.filter(x=>String(x.quality)===state.q);
  arr=arr.filter(x=>state.types.has(x.type));
  if(state.view==='favorites')arr=arr.filter(x=>state.favorites.has(x.id));
  if(state.view==='recent'){
   const rank=new Map(state.recent.map((id,i)=>[id,i]));
   arr=arr.filter(x=>rank.has(x.id)).sort((a,b)=>rank.get(a.id)-rank.get(b.id));
  }else {
   const preferred=state.query?exact(state.query)?.id:null;
   arr.sort((a,b)=>{if(preferred&&(a.id===preferred||b.id===preferred))return a.id===preferred?-1:1;return state.sort==='id-desc'?b.id-a.id:state.sort==='quality-desc'?b.quality-a.quality||a.id-b.id:state.sort==='name'?a.en.localeCompare(b.en):a.id-b.id;});
  }
 }
 state.filtered=arr;
 render();
}
function render(){
 const isSpin=state.view==='spindown', isPools=state.view==='pools', isCalc=isSpin&&state.spinTask==='calculate';
 root.classList.toggle('spin-mode',isSpin);
 $('.workspace').hidden=isPools;$('#poolDirectory').hidden=!isPools;
 $('.filters').hidden=isSpin;$('#filterToggle').hidden=isSpin||isPools;
 $('#spinSummary').hidden=!isSpin;$('#activeFilters').hidden=isSpin;
 $('#spinSources').hidden=isCalc;$('#calculator').hidden=!isCalc;$('#catalogResults').hidden=isCalc;
 $('.command-deck').hidden=isCalc;
 $('#searchInput').placeholder=isPools?'搜索道具池，如隐藏、Boss、贪婪':isSpin?'想获得哪个道具？输入名称或 ID':'搜索名称、ID、拼音或效果';
 $('#searchInput').setAttribute('aria-label',isPools?'搜索道具池':isSpin?'搜索想获得的道具':'搜索道具');
 $('#searchInput').setAttribute('aria-controls',isSpin?'targetSuggestions':isPools?'poolGrid':'itemGrid');
 $('#clearSearch').hidden=!$('#searchInput').value;
 $$('.quick-actions [data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $$('[data-spin-task]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spinTask===state.spinTask)));
 $('#favoriteCount').textContent=state.favorites.size;
 $('#viewTitle').textContent=({all:state.pool==='all'?'全部道具':pools.get(state.pool).name+' · 道具',favorites:'我的收藏',recent:'最近查看',pools:'道具池',spindown:'倒转骰子'})[state.view];
 $('#viewDescription').textContent=({all:'按名称查找，或通过品质和道具池缩小范围。',favorites:'点亮星标，把常用道具放在这里。收藏保存在当前浏览器。',recent:'按最近查看顺序排列，保留最近 60 件道具。',pools:'先找房间或获取方式，再查看其中的道具。',spindown:isCalc?'输入当前道具和目标，确认能否到达及所需次数。':'先选想获得的目标，再看哪些道具可以倒转成它。'})[state.view];
 $('#backPools').hidden=state.view!=='all'||state.pool==='all';
 syncFilters();
 if(isPools){renderPools();return;}
 const total=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));
 state.page=Math.max(0,Math.min(state.page,total-1));
 $('#resultCount').textContent=state.filtered.length;
 $('#resultRange').textContent=state.filtered.length?`显示 ${state.page*state.pageSize+1}–${Math.min((state.page+1)*state.pageSize,state.filtered.length)}`:'';
 $('#pageLabel').textContent=`${state.page+1} / ${total}`;
 $('#pagePrev').disabled=state.page===0;$('#pageNext').disabled=state.page===total-1;
 $('#pageJump').max=total;$('#pageJump').value=state.page+1;
 $('.preview-pages').hidden=total===1;
 $('#emptyState').hidden=state.filtered.length>0;
 if(!state.filtered.length){
  const noFavorites=state.view==='favorites'&&!state.favorites.size, noRecent=state.view==='recent'&&!state.recent.length;
  $('#emptyState').innerHTML=`<h2>${noFavorites?'还没有收藏道具':noRecent?'还没有浏览记录':'没有找到匹配道具'}</h2><p>${noFavorites?'点击道具卡片上的星标，即可在这里快速找到它。':noRecent?'打开一个道具查看详情后，它就会出现在这里。':'试试名称或 ID，或清除筛选条件后重新查找。'}</p><button type="button" class="primary-action" ${noFavorites||noRecent?'data-browse="all"':'data-clear-filter="all"'}>${noFavorites||noRecent?'去逛道具图鉴':'清除搜索和筛选'}</button>`;
 }
 $('#itemGrid').innerHTML=state.filtered.slice(state.page*state.pageSize,(state.page+1)*state.pageSize).map(card).join('');
 if(!isCalc)reveal($('#itemGrid'),state.view+':'+state.spinTask+':'+state.page+':'+state.filtered.map(x=>x.id).join(','));
 if(isCalc)reveal($('#calculator'),state.view+':'+state.spinTask);else renderKeys.delete($('#calculator'));
 if(isSpin){const t=byId.get(state.target);$('#spinTarget').innerHTML=`${icon(t)}<div><span>想获得的目标</span><h2>${esc(t.cn)} <small>${esc(t.en)} · #${t.id}</small></h2></div>`;}
 const labels=[];
 if(state.pool!=='all')labels.push(['pool',pools.get(state.pool).name]);
 if(state.q!=='all')labels.push(['q','品质 '+state.q]);
 if(state.query)labels.push(['query','“'+state.query+'”']);
 if(state.types.size!==2)labels.push(['types',[...state.types].map(t=>t==='Passive'?'被动':'主动').join('、')||'未选择类型']);
 $('#filterSummary').textContent=labels.length?'':'全部道具池 · 全部品质';
 $('#filterChips').innerHTML=labels.map(([key,label])=>`<button type="button" class="filter-chip" data-clear-filter="${key}" aria-label="清除 ${esc(label)}">${esc(label)} ×</button>`).join('');
 $('#activeFilters').hidden=isSpin||!labels.length;
 $('#filterToggle').textContent=labels.length?`筛选 · ${labels.length}`:'筛选';
 $('#filterDone').textContent=`查看 ${state.filtered.length} 个结果`;
}
function card(x){
 const isSpin=state.view==='spindown', s=spinInfo(x.id);
 const foot=isSpin?`<div class="spin-card-meta"><b>${x.id===state.target?'目标道具':s.steps===null?'不能到达':`${s.steps} 次 → 目标`}</b><span class="${s.steps===null?'muted-warning':''}">${esc(s.steps===null?s.label:x.id===state.target?'无需倒转':byId.get(state.target).cn)}</span></div>`:`<div class="card-pools">${poolBadges(x,2)||`<span class="pool-more">${esc(x.acquisition?.label||(x.hidden?'隐藏条目':'获取方式待补充'))}</span>`}</div>`;
 return `<article class="item-card ${isSpin&&x.id===state.target?'is-target':''} ${x.hidden?'hidden-item':''}" data-id="${x.id}"><button type="button" class="item-open" data-open="${x.id}" aria-label="查看 ${esc(x.cn)} 详情"><div class="card-top"><span class="item-id">#${x.id}</span><span class="qbadge q${x.quality}">Q${x.quality}</span></div><div class="item-icon-wrap">${icon(x)}</div><div class="item-cn">${esc(x.cn)}</div><div class="item-en">${esc(x.en)}</div>${x.hidden?'<span class="hidden-label">隐藏条目</span>':''}${foot}</button><div class="card-actions"><span>${x.type==='Activated'?'主动道具':'被动道具'}</span><button type="button" class="fav ${state.favorites.has(x.id)?'on':''}" data-favorite="${x.id}" aria-label="${state.favorites.has(x.id)?'取消收藏':'收藏'} ${esc(x.cn)}" aria-pressed="${state.favorites.has(x.id)}">${state.favorites.has(x.id)?'★':'☆'}</button></div></article>`;
}
function renderPools(){
 selectUI?.sync();
 const q=norm(state.poolQuery);
 const arr=catalog.pools.filter(p=>norm(p.name+' '+p.key).includes(q)&&($('#poolMode').value==='all'||p.mode===$('#poolMode').value));
 $('#poolGrid').innerHTML=arr.map(p=>`<button class="pool-card" type="button" data-pool="${p.key}"><span class="pool-card-head"><b>${esc(p.name)}</b><strong>${p.count}<small> 道具</small></strong></span><span class="pool-card-icons">${p.entries.slice(0,6).map(e=>byId.has(e.id)?icon(byId.get(e.id)):'').join('')}</span><span class="pool-card-foot">${p.mode==='greed'?'贪婪模式':'普通局'} <span>查看道具 →</span></span></button>`).join('')||'<div class="empty-state"><h2>没有匹配的道具池</h2><p>尝试搜索房间名称，或恢复全部模式。</p><button type="button" class="primary-action" id="resetPoolSearch">清除条件</button></div>';
 reveal($('#poolGrid'),arr.map(p=>p.key).join(','));
}
function setPool(key){
 closeDrawer(true);if(state.view!=='all')viewStates.set(state.view,snapshotView());
 Object.assign(state,filterDefaults(),{pool:key,view:'all'});syncFilters();
 $('#searchInput').value='';hideSuggestions();setFiltersOpen(false);apply();scroller.scrollTop=0;
}
function setTarget(id){
 if(!byId.has(id))return;
 closeDrawer(true);if(state.view!=='spindown')viewStates.set(state.view,snapshotView());
 state.target=id;state.view='spindown';state.spinTask='sources';state.query='';
 $('#searchInput').value=byId.get(id).cn;hideSuggestions();apply();scroller.scrollTop=0;
}
function suggestions(q){
 if(!q){hideSuggestions();return;}
 const found=items.filter(x=>match(x,q)).slice(0,8);
 $('#targetSuggestions').innerHTML=found.length?found.map(x=>`<button type="button" data-target="${x.id}">${icon(x)}<span>${esc(x.cn)}<small>${esc(x.en)}</small></span><code>#${x.id}</code></button>`).join(''):'<div class="suggest-empty">没有匹配道具，请输入名称或有效 ID。</div>';
 $('#targetSuggestions').hidden=false;motion($('#targetSuggestions'),[{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],160);$('#searchInput').setAttribute('aria-expanded','true');
}
function onSearch(){
 const q=$('#searchInput').value.trim();
 if(state.view==='spindown'){
  if(!q){hideSuggestions();$('#clearSearch').hidden=true;return;}
  const target=exact(q);
  if(target){state.target=target.id;hideSuggestions();apply();scroller.scrollTop=0;}else suggestions(q);
 }else if(state.view==='pools'){state.poolQuery=q;renderPools();}else{state.query=q;apply();scroller.scrollTop=0;}
 $('#clearSearch').hidden=!q;
}
function acquisitionSection(x){
 if(x.pools.length){
  return `<section class="d-section"><h3>出现的道具池 <small>初始权重</small></h3><div class="detail-pools">${x.pools.map(p=>`<button type="button" data-pool="${p.key}"><span>${esc(pools.get(p.key).name)}</span><b>${p.weight}</b></button>`).join('')}</div><p class="detail-note">权重不是掉落概率；实际生成还受解锁、道具池消耗和角色机制影响。</p></section>`;
 }
 const a=x.acquisition;
 return `<section class="d-section acquisition-section"><h3>获取方式${a?` <small>${esc(a.label)}</small>`:''}</h3>${a?`<p>${referenceText(a.description,x,'acquisition')}</p>${a.note?`<p class="detail-note">${referenceText(a.note,x,'acquisitionNote')}</p>`:''}<p class="detail-note"><a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.sourceLabel)} ↗</a></p>`:'<p>当前数据未收录该道具的道具池，具体获取方式待补充。</p>'}</section>`;
}
function openItem(id,options={}){
 const x=byId.get(id);if(!x)return;
 resetDrawerGesture();
 if(detailId===null)detailHistory.length=0;
 else if(detailId!==id&&options.remember!==false){
  const active=document.activeElement;
  detailHistory.push({id:detailId,scroll:$('#drawerContent').scrollTop,originalOpen:!!$('#drawerContent .original-text')?.open,reference:active?.dataset?.reference,openId:active?.dataset?.open});
 }
 selectUI?.close();const entering=detailId===null||drawerClosing;drawerClosing=false;++drawerVersion;
 if(detailId===null){
  const active=document.activeElement;
  returnFocus=active?.dataset?.favorite?`[data-favorite="${active.dataset.favorite}"]`:`[data-open="${id}"]`;
  returnScroll=scroller.scrollTop;
 }
 detailId=id;
 state.recent=[id,...state.recent.filter(v=>v!==id)].slice(0,60);write('recent',state.recent);
 const index=items.findIndex(i=>i.id===id), neighbors=[items[index-1],items[index+1]].filter(Boolean);
 const forward=[];let at=id;
 if(id!==668&&!x.hidden){for(let i=0;i<5;i++){const n=[...usable].reverse().find(x=>x.id<at);if(!n)break;forward.push(n);at=n.id;if(at===668)break;}}
 const unlock=x.unlockZh?x.unlockZh:x.unlock==='Unlocked by default (Available from the start)'?'默认解锁':x.unlock||'此数据源未提供解锁说明';
 const duration=x.charge===null?'':x.charge==='0'?'无充能 / 一次性':x.chargeType==='timed'?`${Number(x.charge)/30} 秒充能`:`${x.charge} 格充能`;
 $('#drawerContent').innerHTML=`<div class="d-identity"><div class="d-art">${icon(x)}</div><div class="d-names"><h2 class="d-name" id="detailTitle">${esc(x.cn)}</h2><div class="d-en">${esc(x.en)}</div><div class="d-type"><code>#${id}</code> · ${x.type==='Activated'?'主动道具':'被动道具'}${duration?' · '+duration:''}${x.hidden?' · 隐藏条目':''}</div></div></div><div class="d-quality-row"><span>品质</span><b>Q${x.quality}</b><span class="d-quote">${esc(x.quote)}</span></div><div class="d-body"><div class="detail-edition">${esc(catalog.label)} · ${esc(catalog.patch)}</div><section class="d-section"><h3>道具效果 <small>${x.descriptionStatus==='unavailable'?'资料缺失':x.descriptionZh?'中文摘要':'英文原文'}</small></h3><p>${referenceText(x.descriptionZh||x.description||'此数据源未提供效果说明。',x,'descriptionZh')}</p>${x.descriptionSource?`<p class="detail-note"><a href="${esc(x.descriptionSource)}" target="_blank" rel="noopener noreferrer">查看版本更新依据 ↗</a></p>`:''}${x.descriptionZh&&x.description?`<details class="original-text"><summary>查看英文原文</summary><p>${esc(x.description)}</p></details>`:''}</section><div class="d-unlock"><span>解锁条件</span><div>${referenceText(unlock,x,'unlockZh')}</div></div>${acquisitionSection(x)}<section class="d-section"><h3>把这件道具倒转后</h3><div class="spin-preview">${forward.length?forward.map((n,i)=>`<button type="button" data-open="${n.id}">${icon(n)}<span>${i+1} 次<br>${esc(n.cn)}</span></button>`).join(''):`<span>${id===668?'爸爸的便条不能继续倒转':x.hidden?'隐藏条目会被跳过':'已到道具列表起点'}</span>`}</div><p class="detail-note">从当前道具向更小 ID 倒转；按全解锁、普通局、无车载电池计算。</p><button class="primary-action" type="button" data-target="${id}">想获得它？查看可倒转的来源 →</button></section><section class="d-section"><h3>控制台指令</h3><div class="d-command"><code>g c${id}</code><button type="button" class="d-copy" data-copy="g c${id}">复制指令</button></div></section><section class="d-related"><div class="d-related-head"><span>相邻道具</span><a href="https://isaac.huijiwiki.com/wiki/${encodeURIComponent(x.cn)}" target="_blank" rel="noopener noreferrer">查看中文 Wiki ↗</a></div><div class="d-neighbors">${neighbors.map(n=>`<button type="button" class="d-neighbor" data-open="${n.id}">${icon(n)}<span><small>${n.id<id?'←':'→'} #${n.id}</small>${esc(n.cn)}</span></button>`).join('')}</div></section></div>`;
 $('#drawer').hidden=false;$('#drawerBackdrop').hidden=false;
 $('#drawer').classList.add('open');$('#drawerBackdrop').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');
 $('.app-shell').setAttribute('inert','');
 scroller.style.overflow='hidden';
 $('#drawerBack').hidden=!detailHistory.length;
 $('#swipeHint').textContent=detailHistory.length?'右滑返回上一件':'右滑返回列表';
 $('#drawerBack').setAttribute('aria-label',detailHistory.length?'返回上一件道具：'+byId.get(detailHistory.at(-1).id).cn:'返回上一件道具');
 $('#drawerContent').scrollTop=0;updateDetailFavorite();$('#drawerClose').focus?.({preventScroll:true});
 if(options.restore){
  const previous=options.restore,original=$('#drawerContent .original-text');if(original)original.open=previous.originalOpen;
  $('#drawerContent').scrollTop=previous.scroll;
  const link=previous.reference?$$('#drawerContent [data-reference]').find(b=>b.dataset.reference===previous.reference):previous.openId?$$('#drawerContent [data-open]').find(b=>b.dataset.open===previous.openId):null;
  (link||$('#drawerClose')).focus?.({preventScroll:true});
 }
 if(entering){
  motion($('#drawer'),[{opacity:0,transform:'translateX(48px)'},{opacity:1,transform:'translateX(0)'}],280);
  motion($('#drawerBackdrop'),[{opacity:0},{opacity:1}],220);
 }else motion($('#drawerContent'),[{opacity:0,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}],180);
}
function updateDetailFavorite(){
 const b=$('#detailFavorite');b.dataset.detailFavorite=detailId;
 b.textContent=state.favorites.has(detailId)?'★ 已收藏':'☆ 收藏';b.setAttribute('aria-pressed',String(state.favorites.has(detailId)));
}
function closeDrawer(immediate=false,swipeOffset=0){
 if(detailId===null||drawerClosing&&!immediate)return;
 resetDrawerGesture();
 drawerClosing=true;const version=++drawerVersion;
 const finish=()=>{
  if(version!==drawerVersion)return;
  detailId=null;detailHistory.length=0;$('#drawerBack').hidden=true;drawerClosing=false;$('.app-shell').removeAttribute('inert');scroller.style.overflow='';
  $('#drawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');
  $('#drawer').hidden=true;$('#drawerBackdrop').hidden=true;
  // Keep the visible recent list stable until the user re-enters the view.
  scroller.scrollTop=returnScroll;
  (returnFocus&&$(returnFocus)||$('.result-head')).focus?.({preventScroll:true});
 };
 if(immediate){animations.get($('#drawer'))?.cancel();animations.get($('#drawerBackdrop'))?.cancel();finish();return;}
 const animation=motion($('#drawer'),[{opacity:1,transform:`translateX(${swipeOffset}px)`},{opacity:0,transform:swipeOffset?'translateX(100%)':'translateX(40px)'}],180);
 motion($('#drawerBackdrop'),[{opacity:1},{opacity:0}],180);
 if(animation)animation.finished.then(finish,()=>{});else finish();
}
function toggleFav(id){
 const added=!state.favorites.has(id);added?state.favorites.add(id):state.favorites.delete(id);
 write('favorites',[...state.favorites]);apply(false);
 if(detailId!==null)updateDetailFavorite();else ($(`[data-favorite="${id}"]`)||$('.result-head')).focus?.({preventScroll:true});
 motion(detailId!==null?$('#detailFavorite'):$(`[data-favorite="${id}"]`)||$('#favoriteCount'),[{transform:'scale(.8)'},{transform:'scale(1.16)',offset:.6},{transform:'scale(1)'}],240);
 undoFavorite={id,added};toast(added?'已收藏 '+byId.get(id).cn:'已取消收藏 '+byId.get(id).cn,true);
}
function resetFilters(){Object.assign(state,filterDefaults());syncFilters();$('#searchInput').value='';apply();}
function clearFilter(key){
 if(key==='all')resetFilters();
 else {const defaults=filterDefaults();state[key]=defaults[key];syncFilters();$('#searchInput').value=state.query;apply();}
}
function toast(t,undo=false){
 $('#toast').innerHTML=`<span>${esc(t)}</span>${undo?'<button type="button" id="undoFavorite">撤销</button>':''}`;
 $('#toast').classList.add('show');motion($('#toast'),[{opacity:0,transform:'translate(-50%, 10px)'},{opacity:1,transform:'translate(-50%, 0)'}],180);clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.browse){switchView('all');resetFilters();}
 else if(b.dataset.view)switchView(b.dataset.view);
 else if(b.dataset.spinTask){state.spinTask=b.dataset.spinTask;hideSuggestions();render();scroller.scrollTop=0;if(state.spinTask==='calculate')calculate();}
 else if(b.dataset.clearFilter)clearFilter(b.dataset.clearFilter);
 else if(b.id==='resetPoolSearch'){state.poolQuery='';$('#searchInput').value='';$('#poolMode').value='all';render();}
 else if(b.id==='undoFavorite'&&undoFavorite){const {id,added}=undoFavorite;added?state.favorites.delete(id):state.favorites.add(id);write('favorites',[...state.favorites]);undoFavorite=null;apply(false);if(detailId!==null)updateDetailFavorite();toast('已撤销');}

 else if(b.dataset.target)setTarget(Number(b.dataset.target));
 else if(b.dataset.open)openItem(Number(b.dataset.open));
 else if(b.dataset.pool)setPool(b.dataset.pool);
 else if(b.dataset.favorite)toggleFav(Number(b.dataset.favorite));
 else if(b.dataset.detailFavorite)toggleFav(Number(b.dataset.detailFavorite));
 else if(b.dataset.copy){try{await navigator.clipboard.writeText(b.dataset.copy);toast('已复制 '+b.dataset.copy)}catch{toast('复制不可用，请手动复制：'+b.dataset.copy)}}
});
$('#searchInput').addEventListener('input',onSearch);
$('#searchInput').addEventListener('keydown',e=>{
 if(state.view!=='spindown')return;
 if(e.key==='ArrowDown'&&!$('#targetSuggestions').hidden){e.preventDefault();$('#targetSuggestions button')?.focus();}
 if(e.key==='Enter'){
  const x=exact(e.target.value);if(x)setTarget(x.id);else suggestions(e.target.value);
 }
});
$('#targetSuggestions').addEventListener('keydown',e=>{
 const buttons=$$('#targetSuggestions button'), i=buttons.indexOf(e.target.closest('button'));
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=i+(e.key==='ArrowDown'?1:-1);if(next<0)$('#searchInput').focus();else buttons[Math.min(next,buttons.length-1)]?.focus();}
 if(e.key==='Escape'){e.stopPropagation();hideSuggestions();$('#searchInput').focus();}
});
document.addEventListener('click',e=>{if(!$('.command-deck').contains(e.target))hideSuggestions();});
$('#poolMode').addEventListener('change',renderPools);
$('#backPools').addEventListener('click',()=>switchView('pools'));
$('#clearSearch').addEventListener('click',()=>{$('#searchInput').value='';onSearch();$('#searchInput').focus();});
$('#filterToggle').addEventListener('click',()=>{setFiltersOpen($('#filterToggle').getAttribute('aria-expanded')!=='true');scroller.scrollTop=0;});
$('#filterDone').addEventListener('click',showResults);
$('#poolSelect').addEventListener('change',e=>{state.pool=e.target.value;apply()});
$('#versionSelect').addEventListener('change',e=>switchEdition(e.target.value));
$('#qualitySelect').addEventListener('change',e=>{state.q=e.target.value;apply()});
$('#sortSelect').addEventListener('change',e=>{state.sort=e.target.value;apply()});
$$('[data-type]').forEach(c=>c.addEventListener('change',()=>{c.checked?state.types.add(c.dataset.type):state.types.delete(c.dataset.type);apply()}));
$('#resetFilters').addEventListener('click',resetFilters);
$('#pagePrev').addEventListener('click',()=>goPage(state.page-1));
$('#pageNext').addEventListener('click',()=>goPage(state.page+1));
$('#pageJump').addEventListener('change',e=>goPage(Math.floor(Number(e.target.value)||1)-1));
$('#pageSize').addEventListener('change',e=>{state.pageSize=Number(e.target.value);state.page=0;render();showResults()});
// Claim only deliberate, single-finger horizontal gestures. Native vertical
// scrolling and pinch zoom keep control until the direction is established.
function resetDrawerGesture(snapBack=false){
 const dx=drawerGesture?.dx||0;
 drawerGesture=null;
 $('#drawer').style.transform='';$('#drawerBackdrop').style.opacity='';
 if(snapBack&&dx)motion($('#drawer'),[{transform:`translateX(${dx}px)`},{transform:'translateX(0)'}],180);
}
$('#drawer').addEventListener('touchstart',e=>{
 resetDrawerGesture(true);
 if(detailId===null||drawerClosing||e.touches.length!==1||!window.matchMedia?.('(max-width: 560px)').matches)return;
 if(e.target.closest('button,a,input,select,textarea,summary,[contenteditable]')||window.getSelection?.().toString())return;
 const t=e.touches[0];
 drawerGesture={id:t.identifier,x:t.clientX,y:t.clientY,dx:0,active:false,width:$('#drawer').getBoundingClientRect().width};
},{passive:true});
$('#drawer').addEventListener('touchmove',e=>{
 const g=drawerGesture;if(!g)return;
 if(e.touches.length!==1){resetDrawerGesture(true);return;}
 const t=e.touches[0];if(t.identifier!==g.id){resetDrawerGesture(true);return;}
 const dx=t.clientX-g.x,dy=Math.abs(t.clientY-g.y);
 if(!g.active){
  if(Math.max(Math.abs(dx),dy)<12)return;
  if(dx<=0||dy>=dx/1.3){resetDrawerGesture();return;}
  if(!e.cancelable){resetDrawerGesture();return;}
  g.active=true;animations.get($('#drawer'))?.cancel();animations.get($('#drawerBackdrop'))?.cancel();
 }
 if(!e.cancelable){resetDrawerGesture(true);return;}
 e.preventDefault();g.dx=Math.max(0,Math.min(dx,g.width));
 suppressSwipeClickUntil=Date.now()+450;
 $('#drawer').style.transform=`translateX(${g.dx}px)`;
 // Keep the overlay in place when returning to an earlier detail.
 if(!detailHistory.length)$('#drawerBackdrop').style.opacity=String(1-g.dx/g.width*.7);
},{passive:false});
$('#drawer').addEventListener('touchend',e=>{
 const g=drawerGesture;if(!g)return;
 if(!g.active||e.touches.length){resetDrawerGesture(true);return;}
 const end=[...e.changedTouches].find(t=>t.identifier===g.id);
 if(!end){resetDrawerGesture(true);return;}
 g.dx=Math.max(0,Math.min(end.clientX-g.x,g.width));
 suppressSwipeClickUntil=Date.now()+450;
 if(g.dx<Math.max(80,Math.min(120,g.width*.25))){resetDrawerGesture(true);return;}
 const dx=g.dx;resetDrawerGesture();
 if(detailHistory.length){
  backDetail();
  motion($('#drawer'),[{transform:`translateX(${dx}px)`},{transform:'translateX(0)'}],180);
 }else closeDrawer(false,dx);
},{passive:true});
$('#drawer').addEventListener('touchcancel',()=>resetDrawerGesture(true),{passive:true});
window.addEventListener('resize',()=>resetDrawerGesture(true));
root.addEventListener('click',e=>{
 if(Date.now()<suppressSwipeClickUntil&&e.detail>0){e.preventDefault();e.stopImmediatePropagation();}
},true);
$('#drawerBack').addEventListener('click',backDetail);
$('#drawerClose').addEventListener('click',()=>closeDrawer());$('#drawerBackdrop').addEventListener('click',()=>closeDrawer());
root.addEventListener('keydown',e=>{
 if(e.defaultPrevented)return;
 if(e.key==='Escape'){
  if(detailId!==null)closeDrawer();else if(!$('#targetSuggestions').hidden)hideSuggestions();else if($('.filters').classList.contains('is-expanded')){setFiltersOpen(false);$('#filterToggle').focus();}
  return;
 }
 if(detailId!==null){
  if(e.key==='Tab'){
   const focusable=$$('#drawer button,#drawer a,#drawer input,#drawer summary').filter(x=>!x.disabled&&!x.hidden);
   const first=focusable[0],last=focusable.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
  return;
 }
 if((e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')){
  if($('.command-deck').hidden)return;
  e.preventDefault();$('#searchInput').focus();
 }
});

function resolveInput(value){
 const withId=value.match(/^\s*(\d+)\s*[·|]/);
 return withId?byId.get(Number(withId[1])):exact(value);
}
function calculate(){
 motion($('#calcResult'),[{opacity:.25,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],200);
 const from=resolveInput($('#calcFrom').value.trim()),to=resolveInput($('#calcTo').value.trim());
 const result=$('#calcResult');result.classList.remove('invalid');$('#calcFrom').setAttribute('aria-invalid',String(!from));$('#calcTo').setAttribute('aria-invalid',String(!to));
 if(!from||!to){result.classList.add('invalid');result.textContent='请检查标红的输入：填写完整道具名称或有效 ID，也可以从建议中选择。';return;}
 const info=spinInfo(from.id,to.id);
 if(info.steps===null){result.classList.add('invalid');result.innerHTML=`${esc(from.cn)} #${from.id} → ${esc(to.cn)} #${to.id}：<b>不能到达</b><small>${esc(info.label)}${from.id<to.id?'；倒转只会减少 ID。':'。'}</small>`;return;}
 result.innerHTML=`${esc(from.cn)} #${from.id} → ${esc(to.cn)} #${to.id}：<strong>${info.steps} 次</strong><small>${info.steps===0?'两个输入是同一道具。':`ID 相差 ${from.id-to.id}；已跳过 ${from.id-to.id-info.steps} 个空编号 / 隐藏条目。`} 全解锁、普通局、无车载电池。</small>`;
}
$('#calcRun').addEventListener('click',calculate);
$('#calcSwap').addEventListener('click',()=>{const v=$('#calcFrom').value;$('#calcFrom').value=$('#calcTo').value;$('#calcTo').value=v;calculate();});
['#calcFrom','#calcTo'].forEach(s=>{
 $(s).addEventListener('keydown',e=>{if(e.key==='Enter')calculate();});
 $(s).addEventListener('input',()=>{$(s).removeAttribute('aria-invalid');$('#calcResult').classList.remove('invalid');$('#calcResult').textContent='输入已更新，点击计算或按 Enter 查看结果。';});
});
renderEdition();
selectUI=window.IsaacSelect.enhance(root,{beforeOpen:native=>{
 // Settle the filter panel before measuring a popup anchored inside it.
 if(native.closest('.filters')&&$('.filters').classList.contains('is-expanded'))setFiltersOpen(true,true);
}});
apply();
})();
