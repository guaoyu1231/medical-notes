const main = document.querySelector("main");
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[ch]));
const ico = (name, cls = "") => '<svg class="icon '+cls+'" aria-hidden="true"><use href="assets/icons.svg#'+esc(name)+'"></use></svg>';
const link = (url, label) => '<a href="#'+url+'">'+esc(label)+'</a>';
const sample = note => note.kind === "sample" ? '<span class="sample">示例</span>' : '';
const noteHref = n => '#note/'+n.id;
let catalog, byNode, byNote, roots, searchData, sequence = 0;

async function resource(url, json = true) {
  const response = await fetch(url);
  if (!response.ok) throw Error('加载失败');
  return json ? response.json() : response.text();
}

function ancestors(id) {
  const result = [];
  for (let n = byNode.get(id); n; n = byNode.get(n.parent)) result.unshift(n);
  return result;
}
function under(id) { return catalog.notes.filter(n => ancestors(n.node).some(a => a.id === id)); }
function children(id) { return catalog.nodes.filter(n => n.parent === id); }
function crumb(items) {
  return '<div class="crumb">'+[link("home","首页"), ...items].join(ico("chevron"))+'</div>';
}
function badge(root) {
  return '<span class="subject-icon '+esc(root.icon || "book")+'">'+ico(root.icon || "book")+'</span>';
}
function subjectCards() {
  return '<div class="subjects">'+roots.map(r =>
    '<a class="subject" href="#node/'+r.id+'">'+badge(r)+'<div><h3>'+esc(r.title)+'</h3><span>'+children(r.id).length+' 个系统 · '+under(r.id).length+' 篇笔记</span></div>'+ico("chevron","end")+'</a>'
  ).join("")+'</div>';
}
function noteRows(notes) {
  return notes.length ? '<div class="rows">'+notes.map(n => {
    const path = ancestors(n.node);
    return '<a class="note-row" href="'+noteHref(n)+'"><span class="paper">'+ico("file")+'</span><div class="row-main"><strong>'+esc(n.title)+'</strong>'+sample(n)+'<small>'+esc(path.map(p=>p.title).join(" / "))+'</small></div><time datetime="'+esc(n.updated)+'">'+esc(n.updated)+'</time>'+ico("chevron","end")+'</a>';
  }).join("")+'</div>' : '<p class="empty">这个目录还没有笔记。</p>';
}
function sectionHead(icon,title,action="") {
  return '<div class="section-head"><h2>'+ico(icon)+esc(title)+'</h2>'+action+'</div>';
}
function searchForm(value="") {
  return '<form class="search-form" role="search">'+ico("search")+'<input type="search" name="q" aria-label="搜索笔记与知识点" placeholder="搜索笔记、知识点或关键词…" value="'+esc(value)+'"><button>搜索</button></form>';
}
function home() {
  const ecg = byNote.get("ecg-waves");
  const caption = ecg ? link("note/"+ecg.id,"心电图波形示意") : '心电图波形示意';
  return '<section class="hero"><div class="hero-copy"><h1>医学笔记知识库</h1><p>按学科、系统与章节整理的医学学习笔记。</p>'+searchForm()+'<div class="stats"><span>'+ico("layers")+roots.length+' 门学科</span><span>'+ico("book")+catalog.notes.length+' 篇笔记</span></div></div><div class="plate"><img alt="P 波、QRS 波群与 T 波示意" src="assets/ecg.webp" width="960" height="320"><span>'+ico("pulse")+caption+'</span></div></section>'+
    '<section>'+sectionHead("grid","学科目录",link("catalog","查看完整目录"))+subjectCards()+'</section>'+
    '<section>'+sectionHead("clock","最近更新",link("updates","查看全部"))+noteRows(catalog.notes.slice(0,5))+'</section>';
}
function branch(n, selected) {
  const active = n.id === selected;
  const dest = '<a '+(active?'aria-current="page" ':'')+'href="#node/'+n.id+'">'+esc(n.title)+'</a>';
  const sub = children(n.id);
  if (!sub.length) return '<li class="leaf">'+dest+'</li>';
  const expand = !selected ? !n.parent : ancestors(selected).some(item=>item.id===n.id);
  return '<li><details '+(expand?'open':'')+'><summary>'+ico("chevron")+'<span>'+esc(n.title)+'</span></summary><ul><li class="all-node">'+dest+'总览</li>'+sub.map(x=>branch(x,selected)).join("")+'</ul></details></li>';
}
function tree(selected) {
  return '<aside class="tree"><h2>'+ico("layers")+'知识导航</h2><ul>'+roots.map(n=>branch(n,selected)).join("")+'</ul></aside>';
}
function directory(n) {
  const path = n ? ancestors(n.id) : [];
  const trail = n ? [link("catalog","学科目录"), ...path.map(a=>link("node/"+a.id,a.title))] : ["学科目录"];
  const scope = n ? under(n.id) : catalog.notes;
  const sub = n ? children(n.id) : roots;
  return crumb(trail)+'<div class="layout">'+tree(n?.id)+'<section class="panel"><h1>'+esc(n?.title || "学科目录")+'</h1><p class="subline">'+(n?scope.length+' 篇笔记':'按学科、系统、章节逐级浏览。')+'</p>'+
    (sub.length?'<div class="node-links">'+sub.map(x=>'<a href="#node/'+x.id+'">'+ico("folder")+esc(x.title)+ico("chevron")+'</a>').join("")+'</div>':'')+
    sectionHead("book","目录笔记")+noteRows(scope)+'</section></div>';
}
function updates() {
  return crumb(["最近更新"])+'<section class="panel"><h1>最近更新</h1><p class="subline">按笔记的最后修订日期排列。</p><label class="filter">学科 <select id="filter"><option value="">全部学科</option>'+roots.map(r=>'<option value="'+r.id+'">'+esc(r.title)+'</option>').join("")+'</select></label><div id="filtered">'+noteRows(catalog.notes)+'</div></section>';
}
function results(query,index) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/u);
  const match = value => terms.every(t=>value.toLocaleLowerCase().includes(t));
  const nodes = catalog.nodes.filter(n=>match(n.title));
  const found = [];
  for (const n of catalog.notes) {
    const meta = n.title+' '+n.summary+' '+n.keywords;
    const hit = index.find(p=>p.id===n.id && match(meta+' '+p.text));
    if (!hit && !match(meta)) continue;
    const section = match(meta)?null:hit.section;
    const content = section?hit.text:n.summary;
    const start = Math.max(0,content.toLocaleLowerCase().indexOf(terms[0])-20);
    found.push('<a class="result" href="'+noteHref(n)+(section?'/'+section:'')+'"><strong>'+esc(n.title)+(section?' · '+esc(n.sections[section]):'')+'</strong>'+sample(n)+'<p>'+esc((start?'…':'')+content.slice(start,start+110)+(content.length>start+110?'…':''))+'</p></a>');
  }
  return '<p class="subline" role="status">找到 '+found.length+' 篇笔记、'+nodes.length+' 个目录节点</p>'+
    (nodes.length?'<div class="node-links">'+nodes.map(n=>link("node/"+n.id,n.title)).join("")+'</div>':'')+
    (found.join("") || (nodes.length?'':'<p class="empty">没有匹配结果。可以缩短搜索词，或试试“心室”“ECG”。</p>'));
}

async function reader(n,section) {
  const source = await resource("notes/"+n.id+".html",false);
  const parsed = new DOMParser().parseFromString(source,"text/html");
  const article = parsed.querySelector("article");
  const group = document.createElement("div");
  let current;
  for (const el of Array.from(article.children).slice(2)) {
    if (el.tagName === "H2") {
      current = document.createElement("details");
      current.className = "reading-section";
      current.id = 'sec-'+el.id;
      current.open = true;
      const heading = document.createElement("summary");
      heading.append(el);
      current.append(heading);
      group.append(current);
    } else current.append(el);
  }
  const path = ancestors(n.node);
  const toc = '<aside class="toc"><h2>'+ico("layers")+'本篇目录</h2>'+Object.entries(n.sections).map(([id,title])=>link("note/"+n.id+"/"+id,title)).join("")+'</aside>';
  const missing = section && !Object.hasOwn(n.sections,section) ? '<p role="status" class="notice">原链接的小节已移除，可从本篇目录重新定位。</p>':'';
  return crumb(path.map(p=>link("node/"+p.id,p.title)))+'<div class="reader-layout"><article class="reading"><div class="read-meta">'+sample(n)+'<time>'+esc(n.updated)+' 更新</time></div><h1>'+esc(n.title)+'</h1><p class="intro">'+esc(n.summary)+'</p><button type="button" class="share">'+ico("link")+'复制分享链接</button><span id="share-status" role="status"></span>'+missing+group.innerHTML+(parsed.querySelector(".questions")?.outerHTML || '')+'</article>'+toc+'</div>';
}
function missing() { return '<section class="panel"><h1>未找到这个条目</h1><p>它可能已被移除。'+link("catalog","打开学科目录")+'查找其他笔记。</p></section>'; }
function setHeader(page) {
  for (const a of document.querySelectorAll("nav a")) {
    if (a.hash === "#"+page) a.setAttribute("aria-current","page");
    else a.removeAttribute("aria-current");
  }
}
async function render() {
  const ticket = ++sequence;
  const [page="home", id, section] = (location.hash.slice(1)||"home").split("/");
  let html, title;
  try {
    setHeader(["node","note"].includes(page)?"catalog":page);
    switch(page) {
      case "home": html=home(); title="知识库首页"; break;
      case "updates": html=updates(); title="最近更新"; break;
      case "node":
      case "catalog": {
        const n = byNode.get(id);
        html = page==="node"&&!n ? missing():directory(n);
        title=n?.title || "学科目录"; break;
      }
      case "note": {
        const n=byNote.get(id);
        html=n?await reader(n,section):missing();
        title=n?.title || "未找到笔记"; break;
      }
      case "search": {
        const q=decodeURIComponent(id||"").trim();
        if (q && !searchData) searchData=await resource("search-index.json");
        title="全站搜索";
        html=crumb([title])+'<section class="panel"><h1>全站搜索</h1>'+searchForm(q)+(q?results(q,searchData):'<p class="subline">输入标题、正文中的词语或英文缩写。</p>')+'</section>'; break;
      }
      case "about":
        title="关于知识库";
        html=crumb([title])+'<section class="panel"><h1>关于医学手记</h1><p>医学手记是面向医学生的个人笔记知识库。可以按学科浏览，也可以用中文关键词或英文缩写搜索。每篇笔记和每个小节都有独立分享链接。</p><p>带有“示例”标记的条目用于演示网站功能。笔记末尾附有参考阅读，供学习时对照。</p></section>'; break;
      default: title="未找到条目"; html=missing();
    }
    if(ticket!==sequence) return;
    main.innerHTML=html;
    document.title=title+" · 医学手记";
    window.scrollTo(0,0);
    if(page==="note" && section) document.getElementById("sec-"+section)?.scrollIntoView();
    if(page==="search" && !id) main.querySelector("input")?.focus();
  } catch {
    if(ticket===sequence) main.innerHTML='<p class="notice" role="alert">内容加载失败。请检查网络后<a href="">刷新页面</a>，或'+link("home","返回首页")+'。</p>';
  }
}
document.addEventListener("submit", e=>{
  if (!e.target.matches(".search-form")) return;
  e.preventDefault();
  const input=e.target.elements.q;
  location.hash="search/"+encodeURIComponent(input.value.trim());
});
document.addEventListener("change", e=>{
  if(e.target.id==="filter") document.querySelector("#filtered").innerHTML=noteRows(e.target.value?under(e.target.value):catalog.notes);
});
document.addEventListener("click", async e=>{
  if(e.target.closest(".skip")) { e.preventDefault(); main.focus(); }
  if(!e.target.closest(".share")) return;
  const status=document.querySelector("#share-status");
  try { await navigator.clipboard.writeText(location.href); status.textContent="链接已复制"; }
  catch { status.textContent="可复制浏览器地址栏中的完整链接"; }
});
document.addEventListener("keydown", e=>{
  if(e.key==="/" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.matches("input,textarea,select")) {
    e.preventDefault();
    const input=main.querySelector("input[type=search]");
    if(input) input.focus(); else location.hash="search";
  }
});
try {
  catalog=await resource("catalog.json");
  byNode=new Map(catalog.nodes.map(n=>[n.id,n]));
  byNote=new Map(catalog.notes.map(n=>[n.id,n]));
  roots=children(null);
  window.addEventListener("hashchange",render);
  await render();
} catch {
  main.innerHTML='<p role="alert" class="notice">无法读取目录。请检查网络；本地预览请按 README 启动静态服务器。</p>';
}

