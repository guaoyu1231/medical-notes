import {readingUnits, chapter, levels, layers, state, load, save, assessment, coverageReport, startRun, submit} from "./model.js";

const main = document.querySelector("main");
const searchBox = document.querySelector("#search-box");
const number = q => String(q.number).padStart(2,"0");
const escape = value => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const link = (path,text,cls="") => '<a class="'+cls+'" href="#'+escape(path)+'">'+escape(text)+'</a>';
const btn = (action,text,value="",cls="") => '<button type="button" class="'+cls+'" data-action="'+action+'" data-value="'+escape(value)+'">'+escape(text)+'</button>';
const empty = text => '<p class="empty">'+escape(text)+'</p>';
const nodeName = n => n.code+" "+n.title;
const date = value => new Date(value).toLocaleDateString("zh-CN");
const goalLabels = {核心:"核心考点",边界:"深度边界",线索:"检索线索",易错:"易错点"};
const emphasis = {
  "text-cutoffs":"标准化 HbA1c ≥6.5%",
  "text-crisis-differential":"显著酮血症合并代谢性酸中毒"
};
const filters = [["level","认知层级"],["importance","重要程度"],["status","评估状态"],["review","复习"]];
let data, route, chapterView="read", frame;

function go(path) {
  if(location.hash==="#"+path) render();
  else location.hash=path;
}

function getNode(id) { return data.byNode.get(id)||data.nodes[0]; }
function groupNode(group) { return group.nodes.at(-1); }
function taskFor(node) { return data.tasks.find(task=>task.nodes.includes(node.id)); }
function taskQuestions(task) { return [...task.primary,...task.secondary]; }
function readPath(id) { return "read/"+id; }
function quizPath(run,qid=run.current) { return "quiz/"+run.id+"/"+qid; }
function options(key, value, choices) {
  return '<select name="'+key+'">'+choices.map(([id,label])=>'<option value="'+escape(id)+'"'+(String(id)===String(value)?' selected':'')+'>'+escape(label)+'</option>').join("")+'</select>';
}
function prefs() {
  return '<p class="muted">学习记录保存在当前浏览器。</p>';
}

function treeNode(node) {
  const kids = data.children.get(node.id)||[];
  const open = !state.folded.includes(node.id);
  const toggle = kids.length ? '<button class="fold" data-action="fold" data-value="'+node.id+'" aria-label="'+(open?'折叠':'展开')+escape(node.title)+'" aria-expanded="'+open+'">'+(open?'▾':'▸')+'</button>' : '<span class="twig"></span>';
  return '<li><div class="tree-line">'+toggle+'<a href="#map/'+node.id+'"'+(node.id===state.node?' aria-current="location"':'')+'><span>'+escape(node.code)+'</span> '+escape(node.title)+'</a></div>'+
    (open&&kids.length?'<ul>'+kids.map(treeNode).join("")+'</ul>':'')+'</li>';
}

function pageHead(title,meta,actions=""){
  return '<header class="page-head"><div><p class="eyeline">内科学　/　糖尿病</p><h1>'+title+'</h1></div><div class="head-actions">'+actions+'</div></header>'+(meta?'<p class="section-meta">'+meta+'</p>':'');
}
function mapPage() {
  const chosen=getNode(state.node), mind=state.mapView==="mind";
  const modes='<div class="segments" aria-label="地图视图">'+["tree","mind"].map((v,i)=>'<button type="button" data-action="map-mode" data-value="'+v+'" aria-pressed="'+(v===state.mapView)+'">'+["树状目录","思维导图"][i]+'</button>').join("")+'</div>';
  return '<section class="atlas">'+pageHead("知识地图","",modes+btn("map-tools","地图工具"))+
    '<div class="map-scroll'+(mind?' canvas':'')+'" tabindex="0" aria-label="知识地图工作区"><div class="map-sheet" style="--map-scale:'+(state.mapZoom||100)/100+'">'+
    (mind?'<div class="mind-root">糖尿病</div>':'')+'<ul class="map-tree'+(mind?' mind':' forest')+'">'+data.children.get(null).map(treeNode).join("")+'</ul></div></div>'+
    '<footer class="context"><div><small>当前节点</small><h2>'+escape(nodeName(chosen))+'</h2></div><div class="head-actions">'+
    link(readPath(chosen.id),"阅读正文","primary")+btn("map-detail","节点详情")+'</div></footer></section>';
}
const filterChoices = {
  level:levels.slice(1).map((s,i)=>[i+1,"L"+(i+1)+" "+s]),
  importance:["核心","常规","了解"].map(x=>[x,x]),
  status:["尚未评估","证据不足","需要巩固","初步掌握"].map(x=>[x,x]),
  review:[["yes","已加入复习"],["no","未加入复习"]]
};
function taskPage(id) {
  const f=state.filters;
  const tasks=data.tasks.filter(matchesFilters);
  const pinned = data.byTask.get(id);
  if(pinned&&!tasks.includes(pinned)) tasks.unshift(pinned);
  const active=filters.filter(([key])=>f[key]).length;
  return pageHead("认知目标",tasks.length+" 项任务"+(active?" · 已筛选":"")+" · 层级与重要程度为原型标注",'<label class="level-pick">学习程度 '+options("quick-level",f.level,[["","全部层级"],...filterChoices.level])+'</label>'+btn("task-filters",active?"筛选 · "+active:"筛选"))+
    (tasks.length?'<div class="task-list"><div class="task-columns" aria-hidden="true"><span>学习任务</span><span>认知层级</span><span>评估状态</span></div>'+tasks.map(t=>taskRow(t,t.id===id)).join("")+'</div>':empty("没有符合条件的任务。可打开筛选修改范围。"));
}
function matchesFilters(t) {
  const f=state.filters;
  return (!f.level||+f.level===t.level)&&(!f.importance||f.importance===t.importance)&&
    (!f.status||f.status===assessment(t).status)&&(!f.review||(f.review==="yes")===!!state.review[t.id]);
}
function taskRow(task, selected) {
  const a=assessment(task), group=data.byContent.get(task.content), count=taskQuestions(task).length;
  const latest=a.last?"最近评估 "+date(a.last):"暂无作答记录";
  return '<details class="task" id="'+task.id+'"'+(selected?' open':'')+'><summary><span class="task-name">'+escape(task.description)+'</span><span class="task-level">L'+task.level+' '+levels[task.level]+'</span><span class="task-status">'+escape(a.status)+'</span></summary>'+
    '<div class="task-body"><p class="muted">'+escape(group.title)+' · L'+task.level+' '+levels[task.level]+' · '+task.importance+' · '+latest+'</p><dl>'+
    Object.entries(group.goals).map(([key,value])=>'<dt>'+goalLabels[key]+'</dt><dd>'+escape(value)+'</dd>').join("")+'</dl>'+
    '<p>主关联正确 '+a.correct+' / '+task.primary.length+' 道，独立题目作答 '+a.latest.length+' 道。</p>'+
    (a.latest.length?'<ul>'+a.latest.map(item=>'<li>第 '+number(data.byQuestion.get(item.question))+' 题 · '+(task.primary.includes(item.question)?'主关联':'次关联')+' · '+(item.correct?'正确':'错误')+' · '+date(item.at)+'</li>').join("")+'</ul>':'')+
    '<p class="muted">不同主关联题的作答可积累证据。只做对一道题时显示证据不足。</p>'+
    '<div class="row-actions">'+link(readPath(task.nodes.at(-1)),"学习","quiet")+
    (count?btn("task-drill","练习",task.id):'<span class="muted">暂无关联题</span>')+
    btn("review",state.review[task.id]?"移出复习":"加入复习",task.id)+'</div></div></details>';
}

function readingPage(from) {
  const suffix=from?"/from/"+from.run.id+"/"+from.question:"";
  const sections=readingUnits.map(([title,ids])=>{
    const passages=ids.map(id=>{
      const g=data.byContent.get("text-"+id), term=emphasis[g.id];
      const body=g.body.map(p=>{
        const text=escape(p);
        return "<p>"+(term?text.replace(escape(term),"<mark>"+escape(term)+"</mark>"):text)+"</p>";
      }).join("");
      return '<div class="passage prose" id="'+g.id+'" data-node="'+groupNode(g)+'" data-unit="'+ids[0]+'" tabindex="0" aria-controls="companion" title="打开本段目标与笔记">'+body+'</div>';
    }).join("");
    return '<details class="reading-unit" data-unit="'+ids[0]+'"'+(state.closedText["unit-"+ids[0]]?'':' open')+'><summary><h2>'+escape(title)+'</h2></summary>'+passages+'</details>';
  }).join("");
  const toc=readingUnits.map(([title,ids])=>'<a data-outline="'+ids[0]+'" href="#'+readPath(groupNode(data.byContent.get("text-"+ids[0])))+suffix+'">'+escape(title)+'</a>').join("");
  return '<div class="read-layout"><article class="chapter"><header class="book-head"><p class="eyeline">'+chapter.subject+'　/　'+chapter.system+'</p><h1>'+chapter.title+'</h1></header>'+sections+'</article>'+
    '<aside class="reading-outline" aria-label="章内目录"><details class="toc-box"'+((state.tocOpen?.[narrow.matches?'narrow':'wide']??!narrow.matches)?' open':'')+'><summary>本章目录</summary><nav>'+toc+'</nav></details></aside></div>'+
    '<div class="reading-dock">'+(from?'<span class="return">'+link(quizPath(from.run,from.question),"返回第 "+number(data.byQuestion.get(from.question))+" 题","primary")+'</span>':'')+
    '<button data-action="margin" aria-controls="companion">段旁笔记<span class="current-passage"></span></button></div>';
}

const pane=document.querySelector("#companion");
const paneBody=document.querySelector("#pane-body");
const compareToggle=document.querySelector("#compare-toggle");
let paneTab="goals", paneNode, paneRun=null, paneReturn=null;

function goalsContent(g,task) {
  return '<h3>认知目标</h3><p>'+escape(task.description)+'</p>'+(route.page==="read"?btn("recall","遮住正文回忆"):'')+'<dl>'+
    Object.entries(g.goals).map(([k,v])=>'<dt>'+escape(goalLabels[k])+'</dt><dd>'+escape(v)+'</dd>').join("")+'</dl>'+
    '<label>我的笔记<textarea data-note="'+g.id+'" placeholder="记下自己的理解或疑问">'+escape(state.notes[g.id])+'</textarea></label><div class="actions">'+
    (taskQuestions(task).length?btn("pane-drill","关联练习 · "+taskQuestions(task).length+" 题",task.id,"primary"):empty("本段暂无关联题"))+
    btn("margin-review",state.review[task.id]?"移出复习":"加入复习",task.id)+link("tasks/"+task.id,"查看评估记录")+'</div>';
}

function drawPane() {
  for(const tab of pane.querySelectorAll("[data-pane]"))tab.setAttribute("aria-pressed",String(tab.dataset.pane===paneTab));
  const n=getNode(paneNode), g=data.byContent.get(n.content), task=taskFor(n);
  const title='<h2>'+escape(g.title)+'</h2>';
  if(paneTab==="goals")paneBody.innerHTML=title+goalsContent(g,task);
  if(paneTab==="text")paneBody.innerHTML=title+g.body.map(p=>'<p class="excerpt">'+escape(p)+'</p>').join("")+
    '<div class="actions">'+link(readPath(n.id),"在整章中阅读")+(paneReturn?btn("pane-resume","返回原题"):'')+'</div>';
  if(paneTab==="map"){
    const branch=node=>{
      const children=data.children.get(node.id)||[];
      const line=btn("pane-node",nodeName(node),node.id,node.id===n.id?"chosen-node":"");
      return children.length?'<details open><summary>'+escape(node.code+" "+node.title)+'</summary>'+line+children.map(branch).join("")+'</details>':line;
    };
    paneBody.innerHTML='<h2>糖尿病知识地图</h2><div class="pane-tree">'+data.children.get(null).map(branch).join("")+'</div>';
  }
  if(paneTab==="quiz"){
    if(paneRun){
      const q=data.byQuestion.get(paneRun.current);
      paneBody.innerHTML=quizPage(paneRun,q,true);
    }else{
      const qs=taskQuestions(task);
      paneBody.innerHTML=title+'<h3>关联题目</h3>'+(qs.length?'<div class="actions">'+qs.map(id=>btn("pane-one","第 "+number(data.byQuestion.get(id))+" 题",id)).join("")+'</div>':empty("本段暂无关联题"))+
        '<div class="actions">'+btn("pane-chapter","练习整章")+'</div>';
    }
  }
  paneBody.scrollTop=0;
  state.companion={open:!pane.hidden,tab:paneTab,node:paneNode,run:paneRun?.id,returnRun:paneReturn?.id};save();
}
function layoutPane(){
  const floating=state.paneMode==="float";
  document.body.classList.toggle("pane-visible",!pane.hidden);
  document.body.classList.toggle("pane-floating",floating);
  document.querySelector("#pane-mode").textContent=floating?"吸附":"悬浮";
  compareToggle.setAttribute("aria-expanded",String(!pane.hidden));
}
function openPane(tab,node) {
  const changed=node!==paneNode;
  if(changed){paneRun=null;paneReturn=null;}
  clearRecall();paneNode=node;paneTab=tab;pane.hidden=false;
  layoutPane();drawPane();
}
function openMargin(id) {
  const group=data.byContent.get(id);
  const node=group.nodes.includes(state.node)?state.node:groupNode(group);
  openPane("goals",node);
  const passage=document.getElementById(id);
  if(passage)passage.scrollIntoView({block:matchMedia("(max-width:900px)").matches?"start":"nearest"});
  pane.querySelector('[data-pane="goals"]').focus({preventScroll:true});
}
function clearRecall(){document.body.classList.remove("recall-reading");}
function closePane() {
  clearRecall();
  pane.hidden=true;if(state.companion)state.companion.open=false;save();layoutPane();compareToggle.focus({preventScroll:true});
}
function beginPaneQuiz(order,title){
  if(!order.length)return;
  clearRecall();paneRun=startRun(order,title);paneTab="quiz";paneReturn=null;drawPane();
}
compareToggle.onclick=()=>{
  if(!pane.hidden){closePane();return;}
  openPane(route.page==="read"?"goals":"text",state.node);
};
document.querySelector("#pane-close").onclick=closePane;
document.querySelector("#pane-mode").onclick=()=>{state.paneMode=state.paneMode==="float"?"dock":"float";layoutPane();save();};
pane.addEventListener("click",event=>{
  const tab=event.target.closest("[data-pane]");
  if(tab){clearRecall();paneTab=tab.dataset.pane;drawPane();return;}
  const ref=event.target.closest('a[href*="/from/"]');
  if(ref){
    event.preventDefault();paneReturn=paneRun;paneNode=ref.hash.split("/")[1];paneTab="text";drawPane();return;
  }
  const action=event.target.closest("[data-action]");
  if(!action){if(event.target.closest("a[href^='#']"))closePane();return;}
  const value=action.dataset.value;
  switch(action.dataset.action){
    case "recall":{const hidden=document.body.classList.toggle("recall-reading");action.textContent=hidden?"显示正文":"遮住正文回忆";action.setAttribute("aria-pressed",String(hidden));break;}
    case "pane-node":openPane("text",value);break;
    case "margin-review":state.review[value]=!state.review[value];save();action.textContent=state.review[value]?"移出复习":"加入复习";break;
    case "pane-drill":{const t=data.byTask.get(value);beginPaneQuiz(taskQuestions(t),t.description);break;}
    case "pane-one":beginPaneQuiz([value],"段落练习");break;
    case "pane-chapter":beginPaneQuiz(data.questions.map(q=>q.id),"整章练习");break;
    case "pane-range":paneRun=null;paneReturn=null;drawPane();break;
    case "pane-question":paneRun.current=value;save();drawPane();break;
    case "pane-resume":paneRun=paneReturn;paneTab="quiz";drawPane();break;
  }
});
pane.addEventListener("input",event=>{
  const key=event.target.dataset.note;
  if(key){state.notes[key]=event.target.value;save();}
});
pane.addEventListener("change",event=>{
  if(event.target.name!=="answer"||!paneRun||paneRun.answers[paneRun.current]?.submitted)return;
  paneRun.answers[paneRun.current]={picked:new FormData(event.target.form).getAll("answer")};save();
});
pane.addEventListener("submit",event=>{
  event.preventDefault();
  if(event.target.id!=="pane-answer"||!paneRun)return;
  const q=data.byQuestion.get(paneRun.current);
  if(!submit(paneRun,q,new FormData(event.target).getAll("answer"))){
    const message=paneBody.querySelector(".pane-validation");message.textContent="请选择 "+q.answer.length+" 项。";message.scrollIntoView({block:"nearest"});return;
  }
  if(route.run===paneRun&&route.question.id===q.id)main.innerHTML=quizPage(paneRun,q);
  drawPane();paneBody.querySelector(".result").scrollIntoView({block:"nearest"});
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!e.defaultPrevented&&!pane.hidden&&!document.querySelector("dialog:modal")){closePane();}});
function captureReading() {
  if(route?.page!=="read")return;
  const passages=[...main.querySelectorAll(".reading-unit[open] .passage")];
  const y=document.querySelector(".bar").offsetHeight+document.querySelector("#tabs").offsetHeight+25;
  const group=passages.findLast(p=>p.getBoundingClientRect().top<=y+1)||passages[0];
  const dock=main.querySelector('[data-action="margin"]');
  if(!dock)return;
  dock.hidden=!group;
  if(!group)return;
  if(getNode(state.node).content!==group.id)state.node=group.dataset.node;
  document.querySelector('[data-page="map"]').href="#map/"+state.node;
  state.reading={node:state.node,offset:Math.round(y-group.getBoundingClientRect().top)};
  if(dock.dataset.value!==group.id){
    dock.dataset.value=group.id;
    dock.querySelector("span").textContent=data.byContent.get(group.id).title;
  }
  const active=main.querySelector('[data-outline="'+group.dataset.unit+'"]');
  if(active&&!active.hasAttribute("aria-current")){
    main.querySelector("[data-outline][aria-current]")?.removeAttribute("aria-current");
    active.setAttribute("aria-current","location");
  }
}
function quizSetup() {
  const active=state.runs[state.active], f=state.quizFilter||{};
  const levelsList=layers.slice(1).map((s,i)=>[i+1,s]);
  const available=quizSelection(f);
  return pageHead("题库","共 "+data.questions.length+" 道原题")+
    (active?'<p class="resume">'+link(quizPath(active),"继续第 "+number(data.byQuestion.get(active.current))+" 题","primary")+'</p>':'')+
    '<form id="quiz-setup"><div class="tools filters"><label>知识点'+options("node",f.node||"",[["","整章"],...data.nodes.map(n=>[n.id,nodeName(n)])])+'</label>'+
    '<label>题目层级'+options("layer",f.layer||"",[["","全部"],...levelsList])+'</label>'+
    '<label>预计难度'+options("difficulty",f.difficulty||"",[["","全部"],...[...new Set(data.questions.map(q=>q.difficulty))].map(x=>[x,x])])+'</label></div>'+
    '<div class="actions"><button class="primary"'+(available.length?'':' disabled')+'>开始练习 · '+available.length+' 题</button></div></form>'+
    '<details class="pick-question"><summary>按题号选择</summary><div class="question-list">'+available.map(q=>btn("start-one","第 "+number(q)+" 题",q.id)).join("")+'</div></details>'+coveragePanel();
}
function quizSelection(f) {
  return data.questions.filter(q=>(!f.node||[...q.primary,...q.secondary].includes(f.node))&&
    (!f.layer||q.layer===+f.layer)&&(!f.difficulty||q.difficulty===f.difficulty));
}
function quizPage(run,q,inPane=false) {
  const answer=run.answers[q.id], submitted=answer?.submitted, at=run.order.indexOf(q.id);
  const jump=id=>link(readPath(id)+"/from/"+run.id+"/"+q.id,nodeName(getNode(id)),"quiet");
  const feedback=submitted?'<section class="quiz-feedback"><p class="result '+(answer.correct?'ok':'miss')+'">'+(answer.correct?'回答正确':'回答有误')+' · 原答案 '+escape(q.answer.join("、"))+'</p>'+
    '<h2>解析</h2><p>'+escape(q.analysis)+'</p><details><summary>解题路径与评分来源</summary><p>'+escape(q.path)+'</p><p>'+escape(q.purpose)+'</p><p>'+escape(q.rationale)+'</p><p>'+escape(q.source)+' · '+escape(q.difficulty)+'</p>'+
    '<dl>'+Object.entries(q.scores).map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+v+'</dd>').join("")+'</dl><p>原文综合评分 '+q.total.toFixed(2)+'</p>'+
    q.links.map(x=>'<a href="'+escape(x.url)+'" target="_blank" rel="noreferrer">'+escape(x.label)+'</a> ').join("")+'</details>'+
    '<h3>关联正文</h3><div class="actions"><span>主关联</span>'+q.primary.map(jump).join("")+'</div>'+
    (q.secondary.length?'<div class="actions"><span>次关联</span>'+q.secondary.map(jump).join("")+'</div>':'')+
    '<div class="actions">'+link("tasks/"+taskFor(getNode(q.primary[0])).id,"查看认知任务的作答证据","quiet")+'</div></section>':'';
  const form=inPane?"pane-answer":"answer-form";
  const step=(target,label,style="quiet")=>target?(inPane?btn("pane-question",label,target,style):link(quizPath(run,target),label,style)):'<button disabled>'+label+'</button>';
  const next=at===run.order.length-1?btn("run-result","本轮结果",run.id,submitted?"primary":"quiet"):step(run.order[at+1],"下一题",submitted?"primary":"quiet");
  return '<section class="quiz-paper"><header class="quiz-head">'+(inPane?btn("pane-range","返回"):link("quiz","返回","quiet"))+
    '<div><strong>'+escape(run.title)+'</strong><span>第 '+(at+1)+' / '+run.order.length+' 题</span></div>'+btn("answer-card","答题卡",run.id)+'</header>'+
    '<div class="quiz-scroll" tabindex="0" aria-label="题目与解析"><div class="quiz-copy"><p class="eyeline">'+escape(q.kind)+'</p><h1>第 '+number(q)+' 题</h1><p class="stem">'+escape(q.stem)+'</p>'+
    '<form id="'+form+'"><fieldset aria-label="答题选项"'+(submitted?' disabled':'')+'>'+
    Object.entries(q.options).map(([key,value])=>'<label class="answer"><input name="answer" type="'+(q.answer.length>1?'checkbox':'radio')+'" value="'+key+'"'+(answer?.picked.includes(key)?' checked':'')+'><b>'+key+'</b><span>'+escape(value)+'</span></label>').join("")+
    '</fieldset><span '+(inPane?'class="pane-validation"':'id="validation"')+' role="status"></span></form>'+feedback+'</div></div>'+
    '<footer class="quiz-nav">'+step(run.order[at-1],"上一题")+(submitted?'<button data-action="feedback-toggle" aria-expanded="true">收起解析</button>':'<button class="primary" form="'+form+'">提交答案</button>')+next+'</footer></section>';
}
function resultsPage(run){
  const done=run.order.map(id=>run.answers[id]).filter(a=>a?.submitted);
  const remaining=run.order.find(id=>!run.answers[id]?.submitted);
  return pageHead("本轮结果",escape(run.title))+'<section class="run-summary"><h2>已提交 '+done.length+' / '+run.order.length+' 道</h2><p>答对 '+done.filter(a=>a.correct).length+' 道，答错 '+done.filter(a=>!a.correct).length+' 道。</p><div class="actions">'+
    link(quizPath(run,remaining||run.current),remaining?"继续未答题":"回看作答","primary")+btn("answer-card","答题卡",run.id)+link("quiz","返回题库","quiet")+'</div></section>'+coveragePanel();
}
const shelfBooks=[
  ["medicine","内科学","糖尿病 · 示例","pine"],
  ["gynecology","妇科学","待收录","clay"],
  ["pediatrics","儿科学","待收录","indigo"]
];
function bookSlot(book){
  if(!book)return '<div class="shelf-slot" aria-hidden="true"></div>';
  const [id,title,status,color]=book;
  return '<div class="shelf-slot"><a class="bound-book '+color+'" href="#book/'+id+'"><strong>'+title+'</strong><small>'+status+'</small></a></div>';
}
function bookPage(id){
  const book=shelfBooks.find(b=>b[0]===id);
  if(!book)return dashboard();
  return '<section class="volume">'+link("home","‹ 返回书柜")+'<h1>'+book[1]+'</h1>'+
    (id==="medicine"?'<h2>内分泌系统</h2><a class="chapter-entry" href="#read"><strong>糖尿病</strong><span>示例章节　→</span></a>':empty("这本书尚未收录章节。"))+'</section>';
}
const studyPath=[
  ["map","知识地图","搭建知识框架","从全章定位到知识点","M5 20h10m0-12v24m0-24h10m-10 12h10m-10 12h10 M25 5h10v6H25z M25 17h10v6H25z M25 29h10v6H25z"],
  ["tasks","认知目标","选择学习程度","从基础记忆到综合分析","M5 33h30M8 29v-7h6v7m3 0V15h6v14m3 0V8h6v21"],
  ["read","知识正文","学习与查证","连续阅读，回到原段找依据","M20 11Q13 7 5 9v22q8-2 15 2 7-4 15-2V9q-8-2-15 2v22M9 15l7 1m8 0 7-1"],
  ["quiz","题库","筛查知识漏洞","检查错题和还未检验的节点","M26 17a10 10 0 1 1-20 0 10 10 0 1 1 20 0m-2 8 10 10M11 17l4 4 7-9"]
];
function shelf(){
  return '<section class="cabinet" aria-labelledby="shelf-title"><header><h1 id="shelf-title">医学书柜</h1></header><div class="case-frame" role="group" aria-label="八个书位，已上架三册">'+
    Array.from({length:8},(_,i)=>bookSlot(shelfBooks[i])).join("")+'</div><footer>'+btn("show-flow","向下查看学习示意图 ↓")+'</footer></section>';
}
function flowDiagram(){
  return '<p class="eyeline">内科学　/　糖尿病示例</p><h2>学习工作台</h2><ol class="learning-flow" aria-label="学习流程示意图">'+
    studyPath.map(([page,label,title,detail,path])=>'<li><a href="#'+page+'"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="'+path+'"/></svg><span>'+label+'</span><strong>'+title+'</strong><small>'+detail+'</small></a></li>').join("")+'</ol>';
}
function coveragePanel(){
  const groups=coverageReport(data);
  const labels={review:"需回看错题",partial:"已做部分主关联题",untested:"主关联题尚未作答",uncovered:"暂无主关联题",checked:"主关联题已做完且最近均答对"};
  return '<section class="coverage"><h2>全章查漏</h2><p class="muted">按每道题最近一次提交，逐一检查 '+data.nodes.length+' 个节点。次关联作答只作参考。</p>'+
    Object.entries(labels).map(([key,label])=>'<details data-coverage="'+key+'"><summary>'+label+' <b>'+groups[key].length+'</b></summary>'+
      (groups[key].length?'<ul>'+groups[key].map(({node,wrong,attempted,total,indirect})=>'<li>'+link(readPath(node.id),nodeName(node))+'<small>主关联已做 '+attempted.length+' / '+total+(indirect.length?' · 次关联已做 '+indirect.length:'')+'</small>'+
        wrong.map(q=>btn("start-one","重做第 "+number(q)+" 题",q.id)).join("")+'</li>').join("")+'</ul>':empty("此项暂无节点。"))+'</details>').join("")+'</section>';
}

function dashboard() {
  const active=state.runs[state.active], due=data.tasks.filter(t=>state.review[t.id]||assessment(t).status==="需要巩固");
  const firsts=new Map();
  for(const a of state.attemptLog) if(!firsts.has(a.question)) firsts.set(a.question,a);
  const awaiting=data.tasks.find(t=>t.primary.length&&assessment(t).status==="尚未评估");
  const last=getNode(state.reading?.node);
  return shelf()+'<section class="dashboard study-guide" id="study-guide">'+flowDiagram()+'<div class="actions">'+link("read",state.reading?"继续阅读 · "+last.title:"开始阅读","primary")+
    (active?link(quizPath(active),"继续练习","quiet"):link("quiz","开始练习","quiet"))+'</div>'+
    '<div class="desktop-grid"><section><h2>待复习</h2>'+(due.length?'<ul class="desk-list">'+due.map(t=>'<li>'+link("tasks/"+t.id,t.description)+'</li>').join("")+'</ul>':empty("暂无待复习任务。可在认知目标页加入复习。"))+'</section>'+
    '<section><h2>下一步</h2>'+(awaiting?'<p>'+link("tasks/"+awaiting.id,awaiting.description)+'</p>':empty("已练习所有有主关联题的任务。"))+
    '<h2>本地记录</h2><p>已练习 '+firsts.size+' / '+data.questions.length+' 道题</p>'+
    '<p>首次作答正确 '+[...firsts.values()].filter(x=>x.correct).length+' / '+firsts.size+' 道</p>'+prefs()+'</section></div></section>';
}

function render() {
  if(!data)return;
  cancelAnimationFrame(frame);
  rememberMap(main.querySelector(".map-scroll"));
  const prior=route, parts=(location.hash.slice(1)||"home").split("/");
  const [page,id,x,runId,qid]=parts;
  route={page,id};clearRecall();
  if(!pane.hidden&&prior?.page!==page&&paneTab==="goals")drawPane();
  const chapterPage=["map","tasks","read","quiz","result"].includes(page);
  if(!chapterPage&&!pane.hidden){pane.hidden=true;layoutPane();}
  if(chapterPage&&pane.hidden&&state.companion?.open&&data.byNode.has(state.companion.node)){
    const saved=state.companion;paneTab=saved.tab;paneNode=saved.node;paneRun=state.runs[saved.run];paneReturn=state.runs[saved.returnRun];
    pane.hidden=false;layoutPane();drawPane();
  }
  document.querySelector("#tabs").hidden=!chapterPage;
  for(const tab of document.querySelectorAll("#tabs a")){
    const p=tab.dataset.page;
    tab.href="#"+(p==="map"?"map/"+state.node:p==="tasks"?"tasks":p==="read"?"read":"quiz");
    if(p===page||(page==="result"&&p==="quiz"))tab.setAttribute("aria-current","page");else tab.removeAttribute("aria-current");
  }
  document.querySelector("#library a").setAttribute("aria-current",chapterPage?"location":"false");
  if(chapterPage)chapterView=page;
  if(page==="book")main.innerHTML=bookPage(id);
  else if(page==="map"){
    if(data.byNode.has(id)) state.node=id;
    if(id!==prior?.id&&data.byNode.has(id)){
      const lineage=new Set();
      let parent=data.byNode.get(id).parent;
      while(parent){lineage.add(parent);parent=data.byNode.get(parent).parent;}
      state.folded=state.folded.filter(node=>!lineage.has(node));
    }
    main.innerHTML=mapPage();
  }else if(page==="tasks"){
    const task=data.byTask.get(id);
    if(task&&!task.nodes.includes(state.node))state.node=task.nodes.at(-1);
    main.innerHTML=taskPage(id);
  }else if(page==="read"){
    if(data.byNode.has(id))state.node=id;
    const run=state.runs[runId];
    const from=x==="from"&&run?.order.includes(qid)?{run,question:qid}:null;
    main.innerHTML=readingPage(from);
  }else if(page==="quiz"){
    const run=state.runs[id], q=data.byQuestion.get(x);
    if(run?.order.includes(x)&&q){
      state.active=id;run.current=x;
      route.run=run;route.question=q;
      main.innerHTML=quizPage(run,q);
    }else main.innerHTML=quizSetup();
  }else if(page==="result"&&state.runs[id]) main.innerHTML=resultsPage(state.runs[id]);
  else main.innerHTML=dashboard();
  window.scrollTo(0,0);
  if(page==="read"){
    const target=data.byNode.get(id)||(state.reading&&getNode(state.reading.node));
    if(target){
      const passage=document.getElementById(target.content);
      if(passage){passage.closest("details").open=true;passage.scrollIntoView();}
      if(!id&&state.reading?.offset) window.scrollBy(0,state.reading.offset);
    }
    captureReading();
  }else if(page==="tasks"&&id) document.getElementById(id)?.scrollIntoView();
  else if(page==="map"){
    const box=main.querySelector(".map-scroll"), pos=state.mapPositions?.[state.mapView];
    if(pos)box.scrollTo(pos);
    if(id&&((prior?.id!==id&&prior?.page==="map")||!pos)){
      const item=box.querySelector('[aria-current="location"]');
      if(item){
        const r=item.getBoundingClientRect(),v=box.getBoundingClientRect();
        if(r.bottom>v.bottom||r.top<v.top||r.right>v.right||r.left<v.left)box.scrollBy(r.left-v.left-box.clientWidth/3,r.top-v.top-box.clientHeight/3);
      }
    }
  }
  save();
}

function launch(order,title) {
  if(order.length)go(quizPath(startRun(order,title)));
}
function setLibrary(open) {
  document.body.classList.toggle("library-open",open);
  document.querySelector("#library-toggle").setAttribute("aria-expanded",String(open));
}
const narrow = matchMedia("(max-width: 760px)");
document.querySelector("#tabs").addEventListener("click",e=>{
  const tab=e.target.closest("[data-page]");
  if(!tab||tab.dataset.page===route?.page)return;
  if(tab.dataset.page==="map")tab.href="#map/"+state.node;
  if(tab.dataset.page==="tasks"&&state.node!=="glossary")tab.href="#tasks/"+taskFor(getNode(state.node)).id;
  if(tab.dataset.page==="read"&&["map","tasks"].includes(route?.page)&&state.reading?.node!==state.node){
    tab.href="#"+readPath(state.node);
  }
});
setLibrary(false);
narrow.addEventListener("change",e=>{setLibrary(false);const toc=main.querySelector(".toc-box");if(toc)toc.open=state.tocOpen?.[e.matches?"narrow":"wide"]??!e.matches;});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&document.body.classList.contains("library-open")&&!document.querySelector("dialog:modal")){
    setLibrary(false);document.querySelector("#library-toggle").focus();
  }
});
document.querySelector("#library-toggle").onclick=()=>setLibrary(!document.body.classList.contains("library-open"));
document.querySelector("#library a").addEventListener("click",e=>{
  e.currentTarget.href="#"+(chapterView==="map"?"map/"+state.node:chapterView);
  if(narrow.matches)setLibrary(false);
});

const sheet=document.querySelector("#tools-sheet");
const sheetBody=document.querySelector("#sheet-body");
let cardRun, cardInPane=false;
function showSheet(title,html){
  document.querySelector("#sheet-title").textContent=title;
  sheetBody.innerHTML=html;
  if(!sheet.open)sheet.showModal();
}
function mapTools(){
  const mind=state.mapView==="mind";
  showSheet("地图工具",'<label>定位节点'+options("map-node",state.node,data.nodes.map(n=>[n.id,nodeName(n)]))+'</label><div class="actions">'+
    btn("expand","展开全部")+btn("collapse","折叠全部")+btn("fullscreen",document.fullscreenElement?"退出全屏":"全屏查看")+'</div>'+
    (mind?'<h3>画布 · '+(state.mapZoom||100)+'%</h3><div class="actions">'+btn("zoom","缩小","-15")+btn("zoom","放大","15")+btn("center","居中")+btn("fit","适应画布")+'</div>':''));
}
function showFilters(){
  showSheet("筛选认知目标",'<form id="filter-form">'+filters.map(([k,label])=>'<label>'+label+options(k,state.filters[k],[["","全部"],...filterChoices[k]])+'</label>').join("")+
    '<div class="actions"><button class="primary">应用筛选</button>'+btn("reset","清空筛选")+'</div></form>');
}
function showCard(id,inPane){
  cardRun=state.runs[id];cardInPane=inPane;
  showSheet("答题卡",'<div class="card-grid">'+cardRun.order.map(qid=>{
    const ans=cardRun.answers[qid];
    const status=ans?.submitted?(ans.correct?"正确":"错误"):ans?.picked?.length?"草稿":"未答";
    return '<button data-action="card-go" data-value="'+qid+'"'+(qid===cardRun.current?' aria-current="step"':'')+'>'+number(data.byQuestion.get(qid))+'<small>'+status+'</small></button>';
  }).join("")+'</div>');
}
function rememberMap(box){
  if(!box)return;
  state.mapPositions??={};
  state.mapPositions[box.classList.contains("canvas")?"mind":"tree"]={left:box.scrollLeft,top:box.scrollTop};
}
function scaleMap(action,value){
  const box=main.querySelector(".canvas"), paper=box?.firstElementChild;
  if(!paper)return;
  const previous=state.mapZoom||100;
  const x=(box.scrollLeft+box.clientWidth/2)/previous, y=(box.scrollTop+box.clientHeight/2)/previous;
  let next=previous;
  if(action==="fit")next=Math.floor(100*Math.min((box.clientWidth-4)/paper.offsetWidth,(box.clientHeight-4)/paper.offsetHeight,1));
  if(action==="zoom")next=previous+Number(value);
  state.mapZoom=Math.max(2,Math.min(200,next));
  paper.style.setProperty("--map-scale",state.mapZoom/100);
  // At small scales browser font rounding can wrap a label onto an extra line.
  if(action==="fit"){
    while(state.mapZoom>2&&(paper.getBoundingClientRect().height>box.clientHeight||paper.getBoundingClientRect().width>box.clientWidth)){
      state.mapZoom--;paper.style.setProperty("--map-scale",state.mapZoom/100);
    }
  }
  if(action==="center"||action==="fit")box.scrollTo((box.scrollWidth-box.clientWidth)/2,(box.scrollHeight-box.clientHeight)/2);
  else box.scrollTo(x*state.mapZoom-box.clientWidth/2,y*state.mapZoom-box.clientHeight/2);
  rememberMap(box);save();
}
sheet.querySelector("[data-dismiss]").onclick=()=>sheet.close();
sheet.addEventListener("change",e=>{
  if(e.target.name==="map-node"){sheet.close();go("map/"+e.target.value);}
});
sheet.addEventListener("submit",e=>{
  e.preventDefault();state.filters=Object.fromEntries(new FormData(e.target));sheet.close();go("tasks");
});
sheet.addEventListener("click",async e=>{
  const button=e.target.closest("[data-action]"), target=e.target.closest("a");
  if(target){sheet.close();return;}
  if(!button)return;
  const {action,value}=button.dataset;
  sheet.close();
  if(action==="card-go"){
    if(cardInPane){paneRun.current=value;save();drawPane();}else go(quizPath(cardRun,value));
  }else if(action==="reset"){for(const [k] of filters)state.filters[k]="";go("tasks");}
  else if(action==="expand"||action==="collapse"){state.folded=action==="expand"?[]:[...data.children.keys()].filter(Boolean);render();}
  else if(["center","fit","zoom"].includes(action))scaleMap(action,value);
  else if(action==="fullscreen"){
    try {if(document.fullscreenElement)await document.exitFullscreen();else await main.requestFullscreen();}
    catch {showSheet("全屏查看",empty("浏览器限制了全屏显示。可使用浏览器的全屏命令。"));}
  }else if(action==="task-drill"){const t=data.byTask.get(value);launch(taskQuestions(t),t.description);}
});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-action]");
  if(!b||sheet.contains(b))return;
  const {action,value}=b.dataset;
  if(action==="map-tools")mapTools();
  if(action==="map-detail"){
    const n=getNode(state.node),t=taskFor(n),count=taskQuestions(t).length;
    showSheet(nodeName(n),'<p>'+escape(t.description)+'</p><div class="actions">'+link("tasks/"+t.id,"认知任务","quiet")+(count?btn("task-drill","关联题 "+count,t.id):empty("暂无关联题"))+'</div>');
  }
  if(action==="task-filters")showFilters();
  if(action==="answer-card")showCard(value,pane.contains(b));
  if(action==="run-result"){if(pane.contains(b))closePane();go("result/"+value);}
  if(action==="feedback-toggle"){
    const feedback=b.closest(".quiz-paper").querySelector(".quiz-feedback");
    feedback.hidden=!feedback.hidden;b.textContent=feedback.hidden?"查看解析":"收起解析";b.setAttribute("aria-expanded",String(!feedback.hidden));
    if(!feedback.hidden)feedback.scrollIntoView({block:"nearest"});
  }
  if(action==="reload")location.reload();
});
let drag=null;
main.addEventListener("pointerdown",e=>{
  const box=e.target.closest(".canvas");
  if(box&&e.pointerType==="mouse"&&e.button===0)drag={box,x:e.clientX,y:e.clientY,left:box.scrollLeft,top:box.scrollTop};
});
main.addEventListener("pointermove",e=>{
  if(!drag)return;
  if(!e.buttons){drag=null;return;}
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.active&&Math.hypot(dx,dy)<5)return;
  drag.active=true;drag.box.setPointerCapture(e.pointerId);
  drag.box.scrollTo(drag.left-dx,drag.top-dy);
});
main.addEventListener("pointerup",()=>{if(drag?.active)main.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();},{capture:true,once:true});drag=null;});
main.addEventListener("pointercancel",()=>{drag=null;});
main.addEventListener("scroll",e=>{if(e.target.matches?.(".map-scroll"))rememberMap(e.target);},true);
function handleSearch() {
  const raw=document.querySelector("#query").value.trim(), terms=raw.toLowerCase().split(/\s+/);
  const find=text=>terms.every(t=>text.toLowerCase().includes(t));
  const pane=document.querySelector("#results");
  if(!raw){pane.innerHTML=empty("可搜索章节、知识节点、正文、认知目标、题目或个人笔记。");return;}
  if(!data)return;
  const rows=(label,hits)=>hits.length?'<section><h3>'+label+'</h3>'+hits.slice(0,8).map(([path,text])=>link(path,text)).join("")+'</section>':'';
  const results=[
    rows("章节",find(chapter.subject+" "+chapter.system+" "+chapter.title)?[["read",chapter.title+" · "+chapter.subject]]:[]),
    rows("知识节点",data.nodes.filter(n=>find(nodeName(n))).map(n=>["map/"+n.id,nodeName(n)])),
    rows("知识正文",data.contents.filter(g=>find(g.title+" "+g.body.join(" "))).map(g=>[readPath(groupNode(g)),g.title])),
    rows("认知任务",data.tasks.filter(t=>find(t.description+" "+data.byContent.get(t.content).title+" "+Object.values(data.byContent.get(t.content).goals).join(" "))).map(t=>["tasks/"+t.id,t.description])),
    rows("题目",data.questions.filter(q=>find("第 "+number(q)+" 题 "+q.number+" "+q.stem)).map(q=>["question/"+q.id,"第 "+number(q)+" 题 · "+q.stem.slice(0,50)])),
    rows("个人笔记",data.contents.filter(g=>state.notes[g.id]&&find(state.notes[g.id])).map(g=>[readPath(groupNode(g)),g.title+" · "+state.notes[g.id].slice(0,38)]))
  ].join("");
  pane.innerHTML=results||empty("没有匹配的结果。");
}
function openSearch() {
  if(!searchBox.open)searchBox.showModal();
  handleSearch();
  document.querySelector("#query").focus();
}
document.querySelector("#search-open").onclick=openSearch;
document.querySelector("#search-close").onclick=()=>searchBox.close();
document.querySelector("#query").addEventListener("input",handleSearch);
document.addEventListener("keydown",event=>{
  if(event.key==="/"&&!event.target.matches("input,textarea,select")&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();openSearch();
  }
});
searchBox.addEventListener("click",event=>{
  const a=event.target.closest("a");
  if(!a)return;
  searchBox.close();
  if(a.hash.startsWith("#question/")){
    event.preventDefault();
    const id=a.hash.split("/")[1];
    launch([id],"搜索定位");
  }else if(a.hash===location.hash){event.preventDefault();render();}
});
main.addEventListener("click",event=>{
  const a=event.target.closest("[data-action]");
  if(!a){
    const passage=event.target.closest(".passage");
    if(passage&&!window.getSelection()?.toString()){openMargin(passage.id);return;}
    const outline=event.target.closest("[data-outline]");
    if(outline?.hash===location.hash){event.preventDefault();render();}
    return;
  }
  const {action,value}=a.dataset, y=window.scrollY;
  const map=main.querySelector(".map-scroll");
  const mapPosition=map&&{top:map.scrollTop,left:map.scrollLeft};
  switch(action){
    case "show-flow":main.querySelector("#study-guide").scrollIntoView();main.querySelector(".learning-flow a").focus({preventScroll:true});return;
    case "fold":state.folded=state.folded.includes(value)?state.folded.filter(x=>x!==value):[...state.folded,value];break;
    case "map-mode":state.mapView=value;break;

    case "review":
      state.review[value]=!state.review[value];save();a.textContent=state.review[value]?"移出复习":"加入复习";return;
    case "margin":openMargin(value);return;
    case "task-drill":{const t=data.byTask.get(value);launch(taskQuestions(t),t.description);return;}
    case "start-one":launch([value],"单题练习");return;
    default:return;
  }
  render();window.scrollTo(0,y);
  if(mapPosition&&action!=="map-mode")main.querySelector(".map-scroll")?.scrollTo(mapPosition);
  if(action==="fold"||action==="map-mode")main.querySelector('[data-action="'+action+'"][data-value="'+CSS.escape(value)+'"]')?.focus({preventScroll:true});
});
main.addEventListener("change",event=>{
  const el=event.target;
  if(el.name==="quick-level"){state.filters.level=el.value;go("tasks");return;}
  if(el.closest("#quiz-setup")){
    state.quizFilter=Object.fromEntries(new FormData(el.form));
    render();return;
  }
  if(el.name==="answer"&&route.run&&!route.run.answers[route.question.id]?.submitted){
    route.run.answers[route.question.id]={picked:new FormData(el.form).getAll("answer")};
    save();
  }
});
main.addEventListener("keydown",event=>{
  if(event.target.matches(".passage")&&["Enter"," "].includes(event.key)){event.preventDefault();openMargin(event.target.id);}
});
main.addEventListener("input",event=>{
  if(event.target.matches("[data-note]")){state.notes[event.target.dataset.note]=event.target.value;save();}
});
main.addEventListener("toggle",event=>{
  const el=event.target;
  if(el.matches(".toc-box")&&el.isConnected){state.tocOpen??={};state.tocOpen[narrow.matches?"narrow":"wide"]=el.open;save();return;}
  if(!el.matches(".reading-unit")||!el.isConnected)return;
  state.closedText["unit-"+el.dataset.unit]=!el.open;
  captureReading();
  save();
},true);
main.addEventListener("submit",event=>{
  event.preventDefault();
  const fields=new FormData(event.target);
  if(event.target.id==="quiz-setup"){
    const f=Object.fromEntries(fields);
    launch(quizSelection(f).map(q=>q.id),f.node?nodeName(getNode(f.node)):"糖尿病章节练习");
  }else if(event.target.id==="answer-form"){
    const {run,question}=route;
    if(!submit(run,question,fields.getAll("answer"))){
      const message=main.querySelector("#validation");message.textContent="请选择 "+question.answer.length+" 项。";message.scrollIntoView({block:"nearest"});
      return;
    }
    render();if(!pane.hidden&&paneTab==="quiz"&&paneRun===run)drawPane();main.querySelector(".result").scrollIntoView({block:"nearest"});
  }
});
window.addEventListener("hashchange",()=>{
  if(route?.page==="read")captureReading();
  render();
});
window.addEventListener("scroll",()=>{
  if(route?.page!=="read")return;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(captureReading);
},{passive:true});
window.addEventListener("pagehide",()=>{rememberMap(main.querySelector(".map-scroll"));captureReading();save();});
document.querySelector(".skip").addEventListener("click",e=>{e.preventDefault();main.focus();});
try {
  data=await load();
  history.scrollRestoration="manual";
  if(!data.nodes.length||!data.contents.length){data=null;main.innerHTML=empty("本章尚未收录知识内容。");document.querySelector("#tabs").hidden=true;}else render();
} catch (error) {
  console.error(error);
  main.innerHTML=empty("章节加载失败，请检查网络后重试。")+btn("reload","重新加载");
}

