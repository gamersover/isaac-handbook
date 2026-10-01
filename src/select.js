/* Styled single-selects retain the native control as the source of truth. */
(() => {
'use strict';
window.IsaacSelect = {
 enhance(root,options={}) {
  const controls=[];
  let opened=null;
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const animate=(node,frames,duration=160)=>reduced()?null:node.animate?.(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
  function close(restore=false){
   if(!opened)return;
   const c=opened;opened=null;c.trigger.setAttribute('aria-expanded','false');c.trigger.removeAttribute('aria-activedescendant');
   c.search?.removeAttribute('aria-activedescendant');c.search?.setAttribute('aria-expanded','false');
   c.motion?.cancel();c.trigger.classList.remove('is-open');
   c.popup.setAttribute('inert','');c.popup.style.pointerEvents='none';
   const animation=animate(c.popup,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-3px)'}],100);
   c.motion=animation;
   const finish=()=>{if(c.motion===animation)c.popup.hidden=true;};
   if(animation)animation.finished.then(finish,()=>{});else finish();
   if(restore)c.trigger.focus({preventScroll:true});
  }
  function position(c){
   const r=c.trigger.getBoundingClientRect();c.anchor={top:r.top,left:r.left};
   const visual=window.visualViewport;
   const top=visual?.offsetTop||0,left=visual?.offsetLeft||0;
   const width=visual?.width||window.innerWidth,height=visual?.height||window.innerHeight;
   const popupWidth=Math.min(Math.max(r.width,c.search?280:210),width-24);
   const below=top+height-r.bottom-12,above=r.top-top-12;
   const up=below<220&&above>below;
   c.popup.style.width=popupWidth+'px';
   c.popup.style.left=Math.max(left+12,Math.min(r.left,left+width-popupWidth-12))+'px';
   c.popup.style.maxHeight=Math.max(120,Math.min(360,up?above:below))+'px';
   c.popup.style.top='';c.popup.style.bottom='';
   c.popup.style.transformOrigin=up?'bottom left':'top left';
   // Using top for both directions also works when the soft keyboard is visible.
   c.popup.style.top=(up?Math.max(top+12,r.top-c.popup.offsetHeight-6):r.bottom+6)+'px';
  }
  function highlight(c,index){
   if(!c.visible.length){c.active=-1;c.trigger.removeAttribute('aria-activedescendant');c.search?.removeAttribute('aria-activedescendant');return;}
   c.active=Math.max(0,Math.min(index,c.visible.length-1));
   c.options.forEach(option=>option.classList.remove('is-active'));c.visible[c.active].classList.add('is-active');
   const option=c.visible[c.active];
   c.trigger.setAttribute('aria-activedescendant',option.id);c.search?.setAttribute('aria-activedescendant',option.id);
   const top=option.offsetTop-c.list.offsetTop,bottom=top+option.offsetHeight;
   if(top<c.list.scrollTop)c.list.scrollTop=top;else if(bottom>c.list.scrollTop+c.list.clientHeight)c.list.scrollTop=bottom-c.list.clientHeight;
  }
  function filter(c){
   const query=(c.search?.value||'').trim().toLowerCase();
   c.visible=c.options.filter(option=>{
    const show=option.textContent.toLowerCase().includes(query);
    option.hidden=!show;return show&&!option.hasAttribute('aria-disabled');
   });
   c.empty.hidden=!!c.visible.length;
   highlight(c,Math.max(0,c.visible.findIndex(o=>o.dataset.value===c.native.value)));
   if(opened===c)position(c);
  }
  function open(c,edge){
   if(c.native.disabled)return;
   options.beforeOpen?.(c.native);
   close();opened=c;c.motion?.cancel();c.popup.removeAttribute('inert');c.popup.style.pointerEvents='';
   c.popup.hidden=false;c.trigger.setAttribute('aria-expanded','true');c.trigger.classList.add('is-open');
   if(c.search){c.search.value='';c.search.setAttribute('aria-expanded','true');}
   filter(c);position(c);
   if(edge==='first')highlight(c,0);if(edge==='last')highlight(c,c.visible.length-1);
   c.motion=animate(c.popup,[{opacity:0,transform:'translateY(-5px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}]);
   if(c.search)c.search.focus({preventScroll:true});
  }
  function choose(c,option){
   if(!option||option.hasAttribute('aria-disabled'))return;
   c.native.value=option.dataset.value;close(true);sync();
   c.native.dispatchEvent(new window.Event('change',{bubbles:true}));
  }
  function keyboard(c,event){
   if(event.isComposing)return;
   const key=event.key,isOpen=opened===c;
   if(key==='Escape'&&isOpen){event.preventDefault();event.stopPropagation();close(true);return;}
   if(key==='Tab'){close(event.target===c.search);return;}
   if(key==='ArrowDown'||key==='ArrowUp'){
    event.preventDefault();
    if(!isOpen)open(c);else highlight(c,c.active+(key==='ArrowDown'?1:-1));return;
   }
   if(isOpen&&(key==='Home'||key==='End')&&event.target!==c.search){event.preventDefault();highlight(c,key==='Home'?0:c.visible.length-1);return;}
   if(key==='Enter'||(key===' '&&event.target!==c.search)){
    event.preventDefault();if(isOpen)choose(c,c.visible[c.active]);else open(c);return;
   }
   // Short lists support type-ahead while focus stays on the trigger.
   if(!c.search&&key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();if(!isOpen)open(c);
    const now=Date.now();c.typed=now-c.typedAt>700?key:c.typed+key;c.typedAt=now;
    const index=c.visible.findIndex(o=>o.textContent.toLowerCase().startsWith(c.typed.toLowerCase()));
    if(index>=0)highlight(c,index);
   }
  }
  function rebuildOptions(c,nativeOptions){
   c.list.replaceChildren();
   c.options=nativeOptions.map((option,i)=>{
    const row=document.createElement('div');row.id=c.native.id+'-option-'+i;row.className='select-option';row.dataset.value=option.value;
    row.setAttribute('role','option');row.setAttribute('aria-selected',String(option.value===c.native.value));
    if(option.disabled)row.setAttribute('aria-disabled','true');
    // Counts are secondary information; keep them out of the item name column.
    const match=option.textContent.match(/^(.*?)\s*\((\d+)\)$/);
    const text=document.createElement('span');text.textContent=match?match[1]:option.textContent;row.append(text);
    if(match){const count=document.createElement('small');count.textContent=match[2];row.append(count);}
    const check=document.createElement('span');check.className='select-check';check.textContent='✓';check.setAttribute('aria-hidden','true');row.append(check);
    c.list.append(row);return row;
   });
   c.visible=c.options;
   c.optionSignature=JSON.stringify(nativeOptions.map(o=>[o.value,o.textContent,o.disabled]));
  }
  function sync(){
   controls.forEach(c=>{
    const nativeOptions=[...c.native.querySelectorAll('option')];
    if(c.optionSignature!==JSON.stringify(nativeOptions.map(o=>[o.value,o.textContent,o.disabled])))rebuildOptions(c,nativeOptions);
    const selected=nativeOptions.find(o=>o.value===c.native.value);
    c.value.textContent=selected?.textContent||'请选择';c.trigger.disabled=c.native.disabled;
    c.trigger.setAttribute('aria-disabled',String(c.native.disabled));
    c.options.forEach(o=>o.setAttribute('aria-selected',String(o.dataset.value===c.native.value)));
    if(opened===c)filter(c);
    if(c.native.disabled&&opened===c)close();
   });
  }
  root.querySelectorAll('select').forEach(native=>{
   const label=root.querySelector(`label[for="${native.id}"]`);
   const name=native.getAttribute('aria-label')||label?.textContent.trim()||native.parentElement.textContent.trim();
   const wrapper=document.createElement('span');wrapper.className='select-control';
   const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';trigger.id=native.id+'-trigger';
   trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label',name);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   const value=document.createElement('span');value.className='select-value';trigger.append(value);
   const chevron=document.createElement('span');chevron.className='select-chevron';chevron.setAttribute('aria-hidden','true');trigger.append(chevron);
   native.parentNode.insertBefore(wrapper,native);wrapper.append(native,trigger);
   native.hidden=true;native.setAttribute('aria-hidden','true');native.tabIndex=-1;
   if(label)label.setAttribute('for',trigger.id);
   const popup=document.createElement('div');popup.className='select-popup';popup.hidden=true;
   const list=document.createElement('div');list.className='select-options';list.id=native.id+'-listbox';list.setAttribute('role','listbox');list.setAttribute('aria-label',name);
   trigger.setAttribute('aria-controls',list.id);
   const nativeOptions=[...native.querySelectorAll('option')];
   const search=nativeOptions.length>10?document.createElement('input'):null;
   if(search){
    search.type='search';search.className='select-search';search.placeholder='搜索道具池…';search.autocomplete='off';
    search.setAttribute('role','combobox');search.setAttribute('aria-label','筛选'+name+'选项');search.setAttribute('aria-controls',list.id);search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-expanded','false');popup.append(search);
   }

   const empty=document.createElement('p');empty.className='select-empty';empty.textContent='没有匹配选项';empty.hidden=true;empty.setAttribute('role','status');
   popup.append(list,empty);root.append(popup);
   const c={native,trigger,value,popup,list,options:[],search,empty,visible:[],active:0,typed:'',typedAt:0};rebuildOptions(c,nativeOptions);controls.push(c);
   trigger.addEventListener('click',()=>opened===c?close(true):open(c));
   trigger.addEventListener('keydown',e=>keyboard(c,e));
   if(search){search.addEventListener('input',()=>filter(c));search.addEventListener('keydown',e=>keyboard(c,e));}
   list.addEventListener('pointermove',e=>{const row=e.target.closest('[role=option]');const i=c.visible.indexOf(row);if(i>=0&&i!==c.active)highlight(c,i);});
   list.addEventListener('click',e=>choose(c,e.target.closest('[role=option]')));
   native.addEventListener('change',sync);
  });
  document.addEventListener('pointerdown',e=>{if(opened&&!opened.popup.contains(e.target)&&!opened.trigger.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(opened&&!opened.popup.contains(e.target)&&!opened.trigger.contains(e.target))close();});
  root.addEventListener('scroll',e=>{
   if(!opened||opened.popup.contains(e.target))return;
   const r=opened.trigger.getBoundingClientRect();
   // Ignore queued scroll events from a panel that just finished expanding.
   if(Math.abs(r.top-opened.anchor.top)>1||Math.abs(r.left-opened.anchor.left)>1)close();
  },true);
  window.addEventListener?.('resize',()=>close());
  window.visualViewport?.addEventListener('resize',()=>{if(opened)position(opened);});
  window.visualViewport?.addEventListener('scroll',()=>{if(opened)position(opened);});
  sync();return {sync,close};
 }
};
})();
