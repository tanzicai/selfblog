---
title: 个人工作效率系统：Obsidian + opencode + 滴答清单
published: 2026-06-08
description: 记录我的个人效率系统搭建方案：以 Obsidian 为知识中枢，opencode 为 AI 助手，滴答清单为任务管道，专注高校信息化建设方案编写与项目任务管理。
tags:
  - 效率
  - opencode
  - Obsidian
  - 滴答清单
  - 工作流
  - 方案编写
category: 效率
pinned: true
---

## 概述

我的工作围绕高校信息化建设方案编写与项目管理，这套系统以 **Obsidian** 为中控，串联 **opencode**（AI 写作/分析）和 **滴答清单**（任务收集与跟踪），核心不是写代码，而是**管方案、管任务、管知识**。

```
Obsidian（知识库 + 任务看板）
    ↕  dida-sync 插件双向同步
滴答清单（微信/手机/PC 多渠道收集）
    ↕  MCP 协议
opencode（AI 辅助写方案、分析需求）
```

---

## 一、Obsidian 知识库（CX 工作区）

整个工作区就是 Obsidian 仓库，根目录在 `~/CX/`，按编号前缀分类：

### 📁 目录结构

```
CX/
├── -1、Agents/              # opencode 智能体配置 + 方案模板
│   ├── AGENTS.md            # opencode 行为指令
│   └── templete/            # 建设方案格式模板 (.docx)
├── -2、SELFSTACK/           # 个人博客（selfstack）
├── 0、公司产品/              # 公司产品方案库
│   ├── 1、公司方案/          # 通用方案
│   ├── 6、AI能力中心/        # AI 产品方案
│   ├── 7、智能体/            # 智能体产品
│   ├── 9、大模型/            # 垂类大模型方案
│   ├── 11、智慧课程/
│   ├── 12、教师档案袋/
│   ├── 13、数字教材/
│   ├── 15、实验室管理平台/
│   └── ...                  # 共 20+ 产品线
├── 1~21、*/                 # 21 所高校客户项目
│   ├── 1、重庆电子科技职业大学/
│   ├── 2、重庆交通大学/
│   ├── 6、重庆医科大学/
│   └── ...
├── 其他/
│   └── 1、模板/              # 滴答清单模板、日记模板等
├── 任务.md                   # 按 PARA 分类的任务总看板
├── 任务看板.md               # 今日/本周任务统计看板
└── .obsidian/                # Obsidian 配置和插件
```

### 🔌 关键插件

| 插件 | 用途 |
|------|------|
| **Tasks** | 全文任务管理，支持日期、优先级、标签等属性 |
| **Dida Sync** | Obsidian ↔ 滴答清单双向同步 |
| **Dataview** | 查询笔记元数据，生成汇总视图 |
| **Templater** | 笔记模板引擎 |
| **Periodic PARA** | 周期性笔记（日/周/月回顾） |
| **opencode** | 在 Obsidian 中直接调用 AI |
| **Copilot** | Obsidian 内 AI 聊天 |
| **Day Planner** | 日计划时间线 |

---

## 二、任务管理体系

任务管理走"双轨制"：**Obsidian Tasks** + **滴答清单**，通过 `Dida Sync` 插件双向同步。

### 任务收集渠道

```
微信 → 滴答清单公众号（语音/文字创建任务）
手机 → 滴答清单桌面小工具
电脑 → 滴答清单 PC 端 / Obsidian
```

### 任务看板

**`任务看板.md`** 是每日任务驾驶舱，用 Tasks 插件查询渲染：

- **今日待办** — 到期日 = 今天的任务
- **本周待办** — 本周内到期的任务
- **快速添加** — 随时记录新任务

**`任务.md`** 按 PARA 分类展示：

```
📋 值得关注 — 高优/进行中/七天内到期
📋 项目（1. 项目）— 各项目任务
📋 领域（2. 领域）— 持续积累领域
📋 资源（3. 资源）— 参考资料
📋 周期笔记（0. 周期笔记）— 周期性回顾任务
```

### 滴答清单同步

通过 `obsidian-dida-sync` 插件，Obsidian 中的任务和滴答清单双向同步。手机上用滴答清单添加任务 → 自动同步到 Obsidian，反之亦然。

模板示例（`其他/1、模板/dida模板.md`）：

```yaml
---
dida:
  projectId: 5b6u5L-h6YeH6ZuG
  status: all
---
```

---

## 三、opencode 配置

### 配置文件

`~/.config/opencode/opencode.jsonc`：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ticktick": {
      "type": "local",
      "command": ["npx", "-y", "@ticktick/mcp-server"],
      "environment": {
        "API_TOKEN": "your_token",
        "API_DOMAIN": "api.dida365.com"
      }
    }
  }
}
```

通过 MCP 接入滴答清单后，可以在 opencode 中自然语言操作任务：

> "我今天有哪些任务？"
> "帮我建一个任务：下周五前完成 XX 学校的方案初稿"

### 智能体（Agent）

存放在 `-1、Agents/` 目录，`AGENTS.md` 定义了工作区的上下文和 opencode 行为指令。配合已安装的技能使用：

| 技能 | 用途 |
|------|------|
| **proposal-writer** | 写建设方案、可行性报告 |
| **solution-architect** | 技术架构设计 |
| **project-plan** | 项目计划、WBS |
| **doc-generator** | 会议纪要、验收文档、PPT 大纲 |
| **tech-review** | 方案评审 |
| **humanizer-zh** | 方案去 AI 味，更像人写的 |

---

## 四、方案编写流程

这是我的核心工作流，围绕"写建设方案"展开：

### 流程

```
1. 需求收集
   客户/领导提需求 → 滴答清单（微信/手机添加）
       ↓
2. 方案启动
   opencode → "帮我把 XX 学校的需求整理成方案大纲"
   参考 0、公司产品/ 中对应产品线已有方案
       ↓
3. 方案编写
   使用 proposal-writer 技能生成初稿
   参考 -1、Agents/templetes/ 中的 docx 排版格式
   用 python-docx 直接生成 Word（保留模板样式）
       ↓
4. 去 AI 味
   使用 humanizer-zh 技能润色，让文字更自然
       ↓
5. 输出交付
   生成最终版 Word/PDF，归档到对应客户目录
   更新任务状态，记录完成日志
```

### 方案模板

建设方案模板存放在 `-1、Agents/templetes/建设方案（格式排版例子）.docx`，是标准 docx 格式，用 `python-docx` 操作填充内容，避免样式丢失。

### 产品方案库

`0、公司产品/` 下 20+ 产品线目录就是方案知识库，写新方案时优先参考已有内容，确保一致性和专业性。

---

## 五、信息流转全景

```
┌──────────────────────────────────────────────────────┐
│                    输入渠道                            │
│   微信  ·  手机  ·  PC  ·  客户会议  ·  领导安排       │
└──────────────────────┬───────────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────────┐
│              滴答清单（任务收集与跟踪）                  │
│   收件箱 → 项目清单 → 今日待办 → 完成任务归档          │
└──────────┬──────────────────────────────────┬────────┘
           │ obsidian-dida-sync 双向同步       │ MCP
           ↓                                  ↓
┌──────────────────────────┐   ┌────────────────────────┐
│     Obsidian（CX 仓库）   │   │      opencode           │
│                          │   │                        │
│  任务看板.md ← Tasks 查询 │   │  @proposal-writer      │
│  任务.md ← PARA 分类     │   │  @solution-architect   │
│  0、公司产品/ → 方案库    │   │  滴答清单 MCP 操作      │
│  1~21、*/ → 客户项目      │   │  Word/文档生成          │
│  -1、Agents/ → AI 配置   │   │                        │
└──────────────────────────┘   └────────────────────────┘
```

---

## 六、每日工作流示例

```
早上
  ├─ 打开 Obsidian → 任务看板.md → 查看今日待办
  ├─ 滴答清单同步今日任务
  └─ opencode → "列出我本周的待办"

白天
  ├─ 写方案 → opencode "帮我把 XX 需求写成建设方案"
  │          先用 proposal-writer 出初稿
  │          再 humanizer-zh 去 AI 味
  ├─ 客户沟通 → 滴答清单添加新任务
  ├─ 方案评审 → opencode "帮我审一下这份方案"
  └─ 归档 → 完成后的文档放入对应客户目录

晚上/下班前
  ├─ 更新任务看板状态
  ├─ 滴答清单整理收件箱
  └─ 回顾今日完成，规划明日任务
```

---

## 七、快速开始

1. **安装 Obsidian**，打开 `~/CX/` 作为仓库
2. **安装插件**：Tasks、Dida Sync、Dataview、Templater、Periodic PARA
3. **配置滴答清单** → 公众号/手机添加任务 → Dida Sync 同步到 Obsidian
4. **安装 opencode**：`brew install opencode`
5. **配置 TickTick MCP**：获取 API Token，写入 `~/.config/opencode/opencode.jsonc`
6. **配置智能体**：在 `-1、Agents/` 中定义
7. **开始使用**：方案用 proposal-writer，任务用滴答清单，知识存 Obsidian
