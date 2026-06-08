---
title: 我的家庭网络架构：IPv6 + NAS + 智能家居 + Cloudflare
published: 2026-06-08
description: 记录家庭网络布局：光猫双交换机分流、IPv6 DDNS 公网访问、NAS 自托管 Gitea、Cloudflare CI/CD 部署博客、Zero Trust 隧道，以及米家智能家居整合。
tags: ["家庭网络", "IPv6", "DDNS", "NAS", "Cloudflare", "Gitea", "智能家居", "FNOS"]
category: 技术架构
pinned: false
---

## 概述

家庭网络的终极目标：**内网无感、外网可控、服务自托管、家居智能化**。本文记录我家目前的网络布局——不算复杂，但够用。

```
      光猫（ONT）
      /        \
  交换机1      交换机2
  /  |  \      /  |  |  \
NAS PC  手机  摄像头 天猫精灵 小爱同学 宠物喂食机
```

---

## 一、网络拓扑

### 硬件结构

光猫出来接两台交换机，按用途做了物理分流：

| 交换机 | 接入设备 | 定位 |
|--------|---------|------|
| **交换机 1** | NAS、台式机、手机/平板 | 高带宽、低延迟，数据密集型 |
| **交换机 2** | 摄像头、天猫精灵、小爱同学、宠物喂食机 | IoT 设备，带宽需求小但数量多 |

物理分离的好处：IoT 设备的广播风暴不会影响主网络，摄像头持续上传也不会抢占 NAS 的带宽。

### 交换机 1 — 数据网络

```
交换机1
 ├── NAS（飞牛 FNOS）
 │    ├── Gitea（Git 服务）
 │    ├── 博客源码/构建
 │    ├── 方案文档版本管理
 │    └── 其他 Docker 服务
 ├── 台式机（开发/办公）
 └── 手机/平板（WiFi）
```

### 交换机 2 — 智能家居

```
交换机2
 ├── 摄像头（监控，持续上传）
 ├── 天猫精灵（语音控制）
 ├── 小爱同学（米家入口）
 └── 宠物喂食机（定时任务）
```

---

## 二、外网访问方案

由于没有公网 IPv4，外网访问走 **IPv6 + DDNS + Cloudflare** 组合。

### IPv6 + DDNS

光猫开启 IPv6，NAS 上跑 DDNS 客户端，将域名解析到 NAS 的 IPv6 地址。

```
用户 → 域名（AAAA 记录）→ NAS IPv6 → 服务
```

这样通过域名就能从外网直接访问 NAS 上的服务，无需中转。

### FNOS 公网（备用通道）

飞牛系统自带穿透功能，提供了一条公网访问通道，但速度较慢，仅限于 NAS 管理界面，作为备用入口。

### Cloudflare Zero Trust Tunnel

Cloudflare 端部署了 Zero Trust Tunnel，映射 NAS 中的网站服务。流量路径：

```
用户 → Cloudflare → Tunnel → NAS 内网服务
```

好处：
- 不需要开放防火墙端口
- Cloudflare 提供 WAF 和安全防护
- 同时支持 IPv4 用户访问（自己没有 IPv4 的用户也能访问）

两个外网通道各有分工：

| 方案 | 用途 | 速度 |
|------|------|------|
| IPv6 DDNS（直连） | NAS 服务、大文件传输 | 快，取决于宽带上行 |
| FNOS 穿透 | NAS 管理后台（备用） | 较慢 |
| Cloudflare Tunnel | Web 服务（博客、应用） | 中等，全球加速 |

---

## 三、版本管理与博客 CI/CD

NAS 上部署了 **Gitea** 作为自托管 Git 服务，所有代码、博客文章、项目方案都推送到 Gitea 做版本管理。

### 资产流向

```
本地编辑
   ↓  git push
Gitea（NAS 内）
   ↓  webhook
Cloudflare Pages / Workers
   ↓
博客站点（公网可访问）
```

### 博客 CI/CD

博客（SelfStack）流程：

```
本地写文章（Markdown）
       ↓ git push
Gitea 仓库
       ↓ webhook 触发
Cloudflare 自动构建部署
       ↓
blog.selfstack.xxx（全球 CDN）
```

Gitea → Cloudflare 的 CI/CD 链路实现了"推送即发布"，写完文章推上去，Cloudflare 自动构建，几分钟后全球生效。

### 方案文档管理

除了博客，所有项目方案也托管在 Gitea：

```
Gitea
 ├── selfstack-blog/        # 博客源码
 ├── proposals/             # 建设方案
 ├── project-plans/         # 项目计划
 └── notes/                 # 技术笔记
```

方案在本地 Obsidian 编写 → 推送到 Gitea → 需要时通过 NAS 外网访问或下载。

---

## 四、智能家居

智能家居走米家生态，尚未完全自动化，目前状态：

| 设备 | 连接方式 | 状态 |
|------|---------|------|
| 摄像头 | 交换机 2（有线） | ✅ 正常运行 |
| 天猫精灵 | WiFi | ✅ 语音控制 |
| 小爱同学 | WiFi | ✅ 米家联动 |
| 宠物喂食机 | WiFi | ✅ 定时投喂 |

### Home Assistant

NAS 上装了 Home Assistant，但目前还没真正用起来。计划中：

- [ ] 接入米家设备，统一管理
- [ ] 摄像头接入 HA，做动作检测
- [ ] 自动化场景（离家关灯、宠物喂食提醒等）
- [ ] 通过 Cloudflare Tunnel 开放 HA 外网访问

---

## 五、网络安全

### 分层防护

```
互联网
   ↓  Cloudflare WAF + Zero Trust
   ↓  NAS 防火墙
   ↓  交换机 ACL（未来）
内网设备
```

### 当前措施

- **IPv6 防火墙**：NAS 仅开放必要端口（HTTPS、Gitea SSH）
- **Cloudflare WAF**：拦截恶意流量，隐藏真实 IP
- **Zero Trust 策略**：Tunnel 层面做访问控制
- **物理隔离**：IoT 设备与主数据网络通过不同交换机分离

---

## 六、完整拓扑图

```
                        🌐 互联网
                           │
                     Cloudflare
                   ┌───────┴───────┐
                   │   WAF / Tunnel │
                   └───────┬───────┘
                           │
                       光猫（ONT）
                   IPv4 + IPv6 / DDNS
                           │
               ┌───────────┴───────────┐
               │                       │
         交换机 1                  交换机 2
      （数据网络）               （智能家居）
               │                       │
      ┌────┬───┴───┬────┐    ┌────┬───┴───┬────┐
      │    │       │    │    │    │       │    │
     NAS   PC    手机  ...  摄像头 天猫精灵 小爱 喂食机
      │
  ┌───┴───┐
 Gitea   Docker 服务
      │
  Cloudflare CI/CD
      │
   博客站点
```

---

## 七、待优化

- **Home Assistant 落地**：把米家设备统一接入，做自动化场景
- **网络监控**：部署 uptime-kuma 或类似工具，监控各服务状态
- **备份策略**：NAS 数据定期备份到异地
- **UPS**：给 NAS 和交换机配不间断电源
- **IPv4 备选**：通过 Cloudflare Tunnel 解决纯 IPv4 用户的访问问题（已部分实现）

---

这套架构不算完美，但在现有条件下做到了"内网稳定、外网可达、服务自助化"。每次迭代一点，慢慢完善。
