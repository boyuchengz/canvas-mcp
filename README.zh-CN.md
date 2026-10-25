# canvas-mcp

[![CI](https://github.com/boyuchengz/canvas-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/boyuchengz/canvas-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)

[English](README.md) | 简体中文

一个**只读**的 [Canvas LMS](https://www.instructure.com/canvas) [MCP](https://modelcontextprotocol.io) 服务器。部署一次，在 Claude 或 ChatGPT 里添加为自定义连接器，就可以直接用自然语言问课程相关的问题：

> *这周有哪些作业要交？哪些已经交了？*
> *期末要考多少分才能保住 A？*
> *总结一下最近两周的课程公告。*
> *助教在我上次实验报告里留了什么评语？*

26 个工具全部只发送 `GET` 请求。服务器无法提交作业、发帖、删除内容或把消息标为已读，所以即使连接器地址泄露，别人也只能看到你本来就能看到的内容。

## 特性

- 所有工具都是只读的，不封装任何写接口；读取收件箱和讨论区时也不会把内容标为已读。
- 工具围绕学生最常问的问题设计：跨课程截止日期、缺交作业、成绩权重、老师反馈、教学大纲政策。
- Canvas 的 HTML 会转成纯文本，只保留模型需要的字段，节省 token。
- 基于 Streamable HTTP 远程运行，网页版和手机端也能用，不局限于桌面应用。
- 每个请求独立创建服务实例，不缓存、不存储任何数据。
- 只有 3 个运行时依赖，无构建步骤，无数据库。

## 工具一览

| 分类 | 工具 | 说明 |
| --- | --- | --- |
| 课程 | `list_courses` | 当前课程列表及 ID |
| | `get_syllabus` | 教学大纲 |
| | `get_front_page` | 课程主页 |
| | `list_modules` | 模块及其中的内容 |
| | `list_pages` / `get_page` | Wiki 页面列表与正文 |
| | `list_course_staff` | 教师与助教 |
| | `list_groups` | 所在小组 |
| 课业 | `get_upcoming` | 未来 N 天内所有截止项及提交状态 |
| | `get_todo` | Canvas 待办列表 |
| | `get_missing` | 已过期且未提交的作业 |
| | `list_assignments` / `get_assignment` | 作业、要求、评分标准、得分与评语 |
| | `list_quizzes` / `get_quiz` | 经典测验、设置及答题记录 |
| | `get_calendar_events` | 日历上的课程、考试、答疑时间 |
| 成绩 | `get_grades` | 各课程当前总成绩 |
| | `get_grade_breakdown` | 作业分组、权重、去最低分规则及每项得分 |
| 文件 | `list_files` / `get_file` | 课程文件；文本类文件直接返回内容 |
| 交流 | `get_announcements` | 近期公告 |
| | `list_discussions` / `get_discussion` | 讨论主题及完整回复 |
| | `list_inbox` / `get_inbox_message` | 收件箱会话与消息 |
| | `get_recent_activity` | 最新动态：新成绩、评语、回复 |

每个工具的参数和返回字段见 [docs/tools.md](docs/tools.md)。

## 快速开始

### 1. 生成 Canvas 访问令牌

在 Canvas 中打开 **Account → Settings**，找到 **Approved Integrations**，点击 **+ New Access Token**，填写用途和过期时间后复制令牌（只显示一次）。

> 部分学校限制个人访问令牌的使用，部署前请先确认学校的相关规定。

### 2. 生成连接器密钥

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 3. 部署到 Railway

```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

在 Railway 控制台中：

1. **Variables**：添加 `CANVAS_BASE_URL`、`CANVAS_API_TOKEN`、`MCP_SECRET`。
2. **Settings → Networking**：点击 **Generate Domain** 获取公网域名。

连接器地址为：

```
https://<你的域名>/<MCP_SECRET>/mcp
```

其他平台（Render、Fly.io、自有服务器、本地）的部署方式见 [docs/deployment.md](docs/deployment.md)。

### 4. 连接客户端

- **Claude**：**Settings → Connectors → Add custom connector**，粘贴连接器地址，OAuth 留空。
- **ChatGPT**：开启连接器开发者模式，新建连接器，粘贴地址，认证方式选 **No authentication**。
- **Claude Code**：`claude mcp add --transport http canvas https://<你的域名>/<MCP_SECRET>/mcp`

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `CANVAS_BASE_URL` | 是 | Canvas 地址，如 `https://canvas.<学校>.edu` |
| `CANVAS_API_TOKEN` | 是 | Canvas 个人访问令牌 |
| `MCP_SECRET` | 是 | 至少 24 位的随机字符串（仅限字母、数字、`-`、`_`），会成为连接器地址的一部分 |
| `PORT` | 否 | 监听端口，默认 `8080`，多数平台会自动设置 |

## 安全说明

- 连接器地址等同于密码，拿到地址的人可以读取你的 Canvas 数据。泄露后请更换 `MCP_SECRET` 并重新部署。
- Canvas 令牌只会发往 `CANVAS_BASE_URL`；指向其他域名的分页链接会被忽略，文件下载使用 Canvas 预签名链接，不携带令牌。
- 密钥错误的请求与不存在的路径返回完全相同的 `404`，比较过程为常数时间。

漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 已知限制

- 一个部署只对应一个用户（令牌持有者）。
- 不解析 PDF、幻灯片和 Office 文件，`get_file` 会返回临时下载链接。
- New Quizzes 出现在 `list_assignments` 而不是 `list_quizzes` 中。
- 单次列表最多返回 500 条，单段文本最多 20,000 字符。

## 本地开发

```bash
git clone https://github.com/boyuchengz/canvas-mcp.git
cd canvas-mcp
npm install
cp .env.example .env
npm run dev
npm test
```

## 参与贡献

欢迎提交 Issue 和 Pull Request，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。新增工具必须保持只读。

## 许可证

[MIT](LICENSE) © Boyucheng Zhang

本项目与 Instructure, Inc. 无关联。Canvas 是 Instructure, Inc. 的商标。
