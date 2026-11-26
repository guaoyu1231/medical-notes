# 医学手记

[打开医学笔记知识库](https://guaoyu1231.github.io/medical-notes/) · [GitHub Actions 部署记录](https://github.com/guaoyu1231/medical-notes/actions)

医学手记按学科、系统和章节组织笔记。首版含 3 门学科、4 篇原创示例、1 道关联练习。所有示例均有标记，笔记末尾附参考阅读；心电图为原创波形示意。

## 在网页上新增一篇笔记

1. 在仓库打开 `notes/heart.html`，点击文件工具栏里的复制原文按钮，复制整份示例。
2. 回到 `notes/`，选择 **Add file → Create new file**，填写文件名，例如 `my-heart-note.html`，粘贴刚复制的内容。
3. 替换标题、摘要、正文和参考来源。给笔记一个新的稳定 ID，例如 `heart-review`，从 `data/nodes.json` 中选一个第三级节点填入 `data-node`。正式笔记用 `data-kind="note"`。
4. 填写实际修订日期和关键词，点击 **Commit changes** 提交到 `main`。已有本地 HTML 文件也可以直接通过 **Add file → Upload files** 上传到 `notes/`。
5. 打开 **Actions → Publish medical notes**。构建和部署都显示绿色勾后，访问网站，在首页或搜索中查找标题。

一个已有章节只需添加一份笔记文件。只有引入新分类、插图或练习时，才需要相应的附属文件。上传前确认来源允许公开分享，移除患者身份信息、个人资料和密钥。仓库本身是公开的，提交历史也可被查看。

### 可复制的最小笔记

```html
<article data-id="heart-review" data-node="heart" data-kind="note"
         data-updated="2026-11-26" data-keywords="心脏,解剖">
  <h1>在此填写笔记标题</h1>
  <p>在此写一段摘要。</p>
  <h2 id="overview">知识梳理</h2>
  <p>在此保留原文的段落和术语，用 <mark>高亮</mark> 标记重点。</p>
  <details><summary>拓展阅读</summary><p>拓展内容。</p></details>
</article>
```

每份 HTML 使用 UTF-8 和配对标签。笔记须从一个 `article`、一个 `h1` 和一个摘要 `p` 开始；其后每个直属 `h2` 开启一个可折叠小节。ID 用小写英文字母开头，可含数字和短横线。小节 ID 在同一篇内唯一。关键词用逗号分隔。正文里的 & 和 < 分别写成 `&amp;` 和 `&lt;`。

- **图片**放进 `assets/`，优先压缩为 WebP。文件名使用字母、数字、短横线或下划线。以站点根目录为基准填写 `<img src="assets/my-diagram.webp" alt="图中表达的内容" loading="lazy" width="800" height="400" />`。发布脚本仅复制笔记引用的图片和界面内置资源。
- **公式**支持上下标和浏览器原生 MathML。示例见 `notes/output.html`。列表、表格、图注、引用、重点、隐藏拓展分别使用标准 HTML 标签。图片等空元素需用 `/>` 自闭合。不支持的格式会报出源文件名，构建脚本不会改写医学正文。
- **练习**放进 `questions/`，一题一个 JSON。参照 `questions/ecg-p.json` 设置唯一 `id`、目标笔记 `note`、题干 `prompt`、答案解析 `answer`、标记 `kind`。阅读页自动显示关联练习，点击题干查看解析。

## 修改、删除和调整目录

| 操作 | 修改位置及关联处理 |
| --- | --- |
| 修订正文或改标题 | 在 GitHub 打开对应笔记，点击铅笔编辑并更新日期。保留 `data-id` 和已有小节 ID，原分享链接继续有效。 |
| 移动笔记到其他章节 | 只改 `data-node`。笔记文件改名或移入 `notes/` 子目录也可保留原链接。 |
| 删除笔记 | 删除对应 HTML，同次提交删除关联题目或把题目指向其他笔记。下次构建会从目录、索引与发布目录移除旧内容。已发出的链接会显示条目已移除。 |
| 增加学科、系统、章节 | 编辑 `data/nodes.json`。每条记录有独立 `id`、名称 `title`、上级 `parent`。学科的上级填 `null`，系统填学科 ID，章节填系统 ID。数组顺序决定同级显示顺序。 |
| 移动或重命名目录节点 | 修改 `parent` 或 `title`，保留 ID。移动后仍须满足三级层次，笔记关联与分享地址自动沿用。 |
| 删除目录节点 | 先迁移或删除下属笔记、子节点，再移除该节点。可在本地或 GitHub 网页编辑器一次提交多文件变更。 |

关联错误、重复 ID、越级目录、缺图、无效日期都会使构建失败，已发布版本继续可用。先看 Actions 中失败的构建步骤并修正，再提交。删除作者内容前可经 Git 历史复查原文。

## 本地运行

需要 Python 3.9 及以上版本，构建仅使用标准库。在**本项目目录**运行：

```sh
python tools/build.py
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

打开 [本地预览](http://127.0.0.1:8000/)。修改源文件后重新执行第一条命令并刷新网页；用 Ctrl+C 关闭服务。Windows 如使用 Python Launcher，可把 `python` 换成 `py -3`。页面通过 HTTP 读取 JSON，直接双击 HTML 无法完成加载。

## GitHub Pages 部署与迁移

这份项目应作为独立仓库，`index.html`、`tools/` 和 `.github/` 均在仓库根目录。使用现有站点时，日常维护只需提交笔记。新建同构站点可按以下步骤操作。

1. 创建 GitHub 仓库，默认分支使用 `main`。上传本项目的源文件，包括隐藏目录 `.github/workflows/`。若使用另一分支，同步调整 `pages.yml` 的 `on.push.branches`。
2. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
3. 推送到 `main`，或从 **Actions → Publish medical notes → Run workflow** 手动运行。构建任务执行索引脚本并上传 `dist/`；部署任务使用 GitHub 提供的临时身份发布。无需自行配置发布令牌。
4. 从成功运行的 **deploy** 环境链接或 **Settings → Pages → Visit site** 打开网站。项目站点地址通常为 `https://账号.github.io/仓库名/`。
5. 如第一次推送早于 Pages 启用，先完成第 2 步，然后重新运行失败的工作流。

迁移到其他静态托管商时，将构建命令设为 `python tools/build.py`，发布目录设为 `dist`，也可直接上传其内容。所有站内资源使用相对路径，分享地址使用哈希路由，无需服务器重写。访问速度取决于实际托管网络，本地资源可随站迁移。

[GitHub Pages 发布源设置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [自定义部署工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 架构与维护约定

| 模块 | 职责 |
| --- | --- |
| `index.html`、`styles/`、`scripts/` | 站点外壳、独立样式、导航与搜索交互。无前端依赖安装步骤。 |
| `data/nodes.json` | 目录的唯一编辑入口。父 ID 描述树结构，名称与路径可变。 |
| `notes/`、`questions/`、`assets/` | 按篇维护正文和元数据，题目通过笔记 ID 关联，图像保存在项目内。 |
| `tools/build.py` | 校验节点与内容，按笔记 ID 输出阅读文件，生成静态 JSON。先在暂存目录完整构建，成功后替换本地 `dist/`。 |
| `dist/catalog.json` | 生成的目录索引。包含节点、笔记标题、摘要、小节 ID 与日期。首页仅加载这份索引及界面资源。 |
| `dist/search-index.json` | 按小节生成的正文索引，提交搜索时加载。笔记正文按篇请求。两个生成索引均无需手改。 |
| `.github/workflows/pages.yml` | 推送后校验、打包与部署，只发布构建产物。 |

**分享协议。** `#node/节点ID` 定位目录，`#note/笔记ID` 定位笔记，`#note/笔记ID/小节ID` 定位段落。先点击阅读页的本篇目录，再复制分享链接即可分享小节。发布后的 ID 不宜重复分配给其他内容。

**内容格式。** 首版选择 HTML 片段，让图片、表格、MathML 和折叠内容由浏览器原生显示，构建端无需安装 Markdown 或公式插件。构建器校验内容标签与本地图片路径。引用教材时保留出处。导入 Word 或 Markdown 前应人工核对原文、公式与图注。

**扩展顺序。** 首版完成查阅、搜索与分享。后续如加入答题记录，可用题目 ID 作为键；学习进度可用笔记 ID 或小节 ID 作为键。待有明确的跨设备同步需求时再决定账号和存储方案。

