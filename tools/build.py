"""Build a portable static site from the curated source directory (Python 3.9+)."""
import json
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
IDENT = re.compile(r"[a-z][a-z0-9-]*")
ALLOWED = set("article h1 h2 h3 p strong em b i ol ul li img figure figcaption table thead tbody tr th td mark details summary blockquote sup sub a br code pre math mrow mi mo mn mtext mfrac msup msub msqrt".split())
ATTRS = {"article": {"data-id", "data-node", "data-kind", "data-updated", "data-keywords"},
         "h2": {"id"}, "a": {"href"}, "img": {"src", "alt", "loading", "width", "height"},
         "td": {"colspan", "rowspan"}, "th": {"colspan", "rowspan", "scope"}}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def content(element):
    return " ".join("".join(element.itertext()).split())


def identifier(value):
    require(isinstance(value, str) and IDENT.fullmatch(value), f"无效 ID：{value}")
    return value


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def hierarchy(nodes):
    by_id = {identifier(n["id"]): n for n in nodes}
    require(len(by_id) == len(nodes), "目录节点 ID 重复")
    depths = {}
    for n in nodes:
        require(isinstance(n["title"], str) and n["title"].strip(), f"缺少节点名称：{n['id']}")
        path = [n["id"]]
        parent = n["parent"]
        while parent is not None:
            require(parent in by_id and parent not in path, f"无效父节点或循环：{path}")
            path.append(parent)
            parent = by_id[parent]["parent"]
        require(len(path) <= 3, f"目录超过三级：{path}")
        depths[n["id"]] = len(path)
    return depths


def read_note(path, depths, assets):
    source = path.read_text(encoding="utf-8")
    require("<!" not in source and "<?" not in source, "正文只接受 HTML 元素")
    root = ET.fromstring(source)
    require(root.tag == "article", "根元素应为 article")
    key = identifier(root.get("data-id"))
    node = root.get("data-node")
    require(depths.get(node) == 3, "笔记须关联第三级章节")
    kind = root.get("data-kind")
    require(kind in ("sample", "note"), "data-kind 应为 sample 或 note")
    updated = date.fromisoformat(root.attrib["data-updated"]).isoformat()
    require(len(root) >= 3 and root[0].tag == "h1" and root[1].tag == "p", "开头须为标题和摘要")
    require(len(list(root.iter("h1"))) == 1 and content(root[0]) and content(root[1]), "标题或摘要无效")
    sections = {}
    for el in root.iter():
        tag = el.tag.removeprefix("{http://www.w3.org/1998/Math/MathML}")
        require(tag in ALLOWED and set(el.attrib) <= ATTRS.get(tag, set()), f"不支持的元素或属性：{tag}")
        if tag == "img":
            name = el.get("src", "")
            require(re.fullmatch(r"assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.(?:webp|png|jpg|jpeg|gif)", name)
                    and (ROOT / name).is_file() and el.get("alt"), f"图片路径、文件或替代文字无效：{name}")
            require(el.get("loading") == "lazy", f"图片请设置 loading=\"lazy\"：{name}")
            assets.add(name)
        if tag == "a":
            href = el.get("href", "")
            require(urlsplit(href).scheme == "https" and urlsplit(href).hostname, f"参考链接应使用 HTTPS：{href}")
        if tag == "h2":
            anchor = identifier(el.get("id"))
            require(el in list(root) and anchor not in sections and content(el), "小节标题须直属 article 且 ID 唯一")
            sections[anchor] = content(el)
    require(sections, "至少需要一个带稳定 ID 的 h2")
    meta = dict(id=key, node=node, title=content(root[0]), summary=content(root[1]), updated=updated,
                kind=kind, keywords=root.get("data-keywords", ""), sections=sections)
    passages = []
    for el in list(root)[2:]:
        if el.tag == "h2":
            passages.append({"section": el.attrib["id"], "text": content(el)})
        elif passages:
            passages[-1]["text"] += " " + content(el)
        else:
            raise ValueError("摘要之后须以 h2 开始")
    return meta, passages, source


def build(out):
    nodes = read_json(ROOT / "data/nodes.json")
    depths = hierarchy(nodes)
    notes, bodies, search, questions = {}, {}, [], {}
    assets = {"assets/ecg.webp", "assets/icons.svg", "assets/favicon.svg"}
    for path in sorted((ROOT / "notes").rglob("*.html")):
        try:
            note, passages, source = read_note(path, depths, assets)
            key = note["id"]
            require(key not in notes, f"笔记 ID 重复：{key}")
            notes[key], bodies[key] = note, source
            search.extend(dict(id=key, **part) for part in passages)
        except (ValueError, KeyError, ET.ParseError) as exc:
            raise ValueError(f"{path.relative_to(ROOT)}：{exc}") from exc
    for path in sorted((ROOT / "questions").rglob("*.json")):
        q = read_json(path)
        key = identifier(q["id"])
        require(key not in questions and q["note"] in notes, f"重复题目或笔记不存在：{path.name}")
        require(q["kind"] in ("sample", "note") and all(isinstance(q[k], str) and q[k].strip()
                for k in ("prompt", "answer")), f"题目字段无效：{path.name}")
        questions[key] = q
    (out / "notes").mkdir()
    for key, source in bodies.items():
        related = [q for q in questions.values() if q["note"] == key]
        extra = ""
        if related:
            extra = '<aside class="questions"><h2>关联练习</h2>'
            for q in related:
                label = "示例题 · " if q["kind"] == "sample" else ""
                extra += f'<details><summary>{label}{escape(q["prompt"])}</summary><p>{escape(q["answer"])}</p></details>'
            extra += "</aside>"
        (out / "notes" / f"{key}.html").write_text(source + extra, encoding="utf-8")
    dump(out / "catalog.json", {"nodes": nodes, "notes": sorted(notes.values(), key=lambda n: n["updated"], reverse=True)})
    dump(out / "search-index.json", search)
    learning_files = {
        "learning/entry.js", "learning/app.js", "learning/model.js", "learning/ui.css",
        *(f"learning/data/{key}.json" for key in ("nodes", "contents", "questions", "tasks")),
    }
    for name in sorted(assets | learning_files | {"index.html", "library.html", "styles/site.css", "scripts/app.js"}):
        src = ROOT / name
        require(src.resolve().is_relative_to(ROOT), f"资源超出项目目录：{name}")
        target = out / name
        target.parent.mkdir(exist_ok=True, parents=True)
        shutil.copyfile(src, target)
    (out / ".nojekyll").touch()
    return len(nodes), len(notes), len(questions)


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(dir=ROOT, prefix=".build-") as tmp:
        stage = Path(tmp) / "site"
        stage.mkdir()
        counts = build(stage)
        destination = ROOT / "dist"
        backup = Path(tmp) / "previous"
        if destination.exists():
            require((destination / ".nojekyll").is_file() and (destination / "catalog.json").is_file(), "dist 已存在且无法确认为本站构建产物")
            destination.rename(backup)
        try:
            stage.rename(destination)
        except OSError:
            if backup.exists():
                backup.rename(destination)
            raise
    print("构建完成：%d 个知识节点，%d 篇笔记，%d 道关联练习。" % counts)

