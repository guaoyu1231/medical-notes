const KEY = "medical-notes.workbench.v1";
export const chapter = {id:"diabetes", subject:"内科学", system:"内分泌系统", title:"糖尿病"};
// Reading order is independent of source table order and of the knowledge tree.
export const readingUnits = [
  ["病因与血糖调节", ["disease-definition","etiology-types","crisis-triggers","physiology","beta-damage","insulin-resistance"]],
  ["临床表现与诊断", ["symptoms","glucose-tests","cutoffs","confirmation","confirmation-limits","prediabetes","type-differential"]],
  ["急性并发症", ["crisis","ketoacidosis","hyperosmolar","crisis-differential","crisis-labs","hypoglycemia","emergency-care"]],
  ["长期治疗", ["management","drug-choice","drug-classes","oral-drugs","incretins","cardiorenal","basal-bolus","intensification","injection"]],
  ["慢性并发症与随访", ["microvascular","macrovascular","chronic-tests","repeat-screening","chronic-care","monitoring","special-settings"]],
  ["常用术语", ["glossary"]]
];
export const levels = ["", "基础记忆", "机制理解", "知识应用", "综合分析"];
export const layers = ["", "基础提取", "理解与辨析", "局部应用", "综合迁移"];
export const state = {
  node:"glossary", folded:[], filters:{level:"", importance:"", status:"", review:""},
  attemptLog:[], runs:{}, active:null, review:{}, notes:{}, reading:null, showReadingToc:true, mapView:"tree", closedText:{}
};

async function read(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(path);
  return response.json();
}

export async function load() {
  const [nodes, contents, questions, tasks] = await Promise.all([
    ...["nodes","contents","questions"].map(name=>read("./data/"+name+".json")),
    read("./data/tasks.json")
  ]);
  const index = rows=>new Map(rows.map(row=>[row.id,row]));
  const byNode = index(nodes), byContent = index(contents), byQuestion = index(questions);
  const byTask = index(tasks);
  const children = new Map();
  for (const node of nodes) {
    if (!children.has(node.parent)) children.set(node.parent,[]);
    children.get(node.parent).push(node);
  }
  for (const task of tasks) {
    task.chapter = chapter.id;
    task.nodes = byContent.get(task.content).nodes;
    task.primary = questions.filter(q=>q.primary.some(id=>task.nodes.includes(id))).map(q=>q.id);
    task.secondary = questions.filter(q=>!task.primary.includes(q.id)&&q.secondary.some(id=>task.nodes.includes(id))).map(q=>q.id);
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch {
    document.querySelector("#storage-status").textContent="学习记录读取失败，当前可以继续浏览。";
  }
  return {nodes, contents, questions, tasks, byNode, byContent, byQuestion, byTask, children};
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { document.querySelector("#storage-status").textContent="存储不可用，当前记录仅留在此页面。"; }
}

export function assessment(task) {
  const all = state.attemptLog.filter(a=>task.primary.includes(a.question)||task.secondary.includes(a.question));
  const latest = new Map(all.map(a=>[a.question,a]));
  const direct = [...latest.values()].filter(a=>task.primary.includes(a.question));
  const correct = direct.filter(a=>a.correct).length;
  let status = "尚未评估";
  if (all.length) status = "证据不足";
  if (direct.some(a=>!a.correct)) status = "需要巩固";
  else if (correct>=2 && correct>=task.primary.length/2) status = "初步掌握";
  return {all, latest:[...latest.values()], correct, status, last:all.at(-1)?.at};
}

export function coverageReport(data) {
  const latest=new Map(state.attemptLog.map(a=>[a.question,a]));
  const groups={review:[], partial:[], checked:[], untested:[], uncovered:[]};
  for(const node of data.nodes){
    const direct=data.questions.filter(q=>q.primary.includes(node.id));
    const attempted=direct.filter(q=>latest.has(q.id));
    const wrong=attempted.filter(q=>!latest.get(q.id).correct);
    const indirect=data.questions.filter(q=>q.secondary.includes(node.id)&&latest.has(q.id));
    let key="checked";
    if(!direct.length)key="uncovered";
    else if(!attempted.length)key="untested";
    else if(wrong.length)key="review";
    else if(attempted.length<direct.length)key="partial";
    groups[key].push({node,wrong,attempted,total:direct.length,indirect});
  }
  return groups;
}

export function startRun(order, title) {
  const id = crypto.randomUUID();
  const run = {id, order, title, current:order[0], answers:{}};
  state.runs[id] = run;
  state.active = id;
  save();
  return run;
}

export function submit(run, question, chosen) {
  if (run.answers[question.id]?.submitted || chosen.length!==question.answer.length) return false;
  const picked = [...chosen].sort();
  const correct = picked.join("")===[...question.answer].sort().join("");
  const result = {question:question.id,picked,correct,at:new Date().toISOString(),submitted:true};
  run.answers[question.id] = result;
  state.attemptLog.push(result);
  save();
  return true;
}

