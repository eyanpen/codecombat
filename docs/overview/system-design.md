# CodeCombat 系统设计概览

## 项目简介

CodeCombat 是一个多人在线编程学习游戏平台，玩家通过编写代码来操控角色完成关卡。项目同时包含两个产品：**CodeCombat**（面向个人/竞技）和 **Ozaria**（面向课堂教学），共享同一代码库。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 运行时 | Node.js 14+ |
| 服务端框架 | Express.js |
| 前端框架 | Backbone.js (legacy) + Vue.js 2 (新页面) |
| 状态管理 | Vuex |
| 前端路由 | Backbone.Router + Vue Router (混合) |
| 构建工具 | Webpack |
| 样式 | Sass / SCSS |
| 模板引擎 | Pug (Jade) / Vue SFC |
| 代码编辑器 | ACE Editor / Blockly |
| 游戏引擎 | CreateJS (EaselJS) + 自定义 World 模拟引擎 |
| 数据验证 | tv4 (JSON Schema) / Treema |
| 历史语言 | CoffeeScript (逐步迁移为 JS) |
| 容器化 | Docker Compose |
| CI | GitHub Actions |

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      客户端 (Browser)                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Backbone Views│  │  Vue Pages   │  │ Game Surface  │ │
│  │ (legacy)     │  │  (新功能)     │  │ (CreateJS)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                  │                  │         │
│  ┌──────┴──────────────────┴──────────────────┴───────┐ │
│  │              Core Layer (Router, Auth, Store)       │ │
│  └──────────────────────┬─────────────────────────────┘ │
│                         │ HTTP/WebSocket                 │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────┐
│                    服务端 (Node.js/Express)               │
│                         │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │  server_setup.js (中间件: 压缩, 日志, 静态文件)     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────┐  ┌──────────────┐                  │
│  │   REST API      │  │  WebSocket   │                  │
│  │  (代理或本地)    │  │  (实时通信)   │                  │
│  └─────────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │  MongoDB  │
                    └───────────┘
```

---

## 目录结构与模块职责

```
codecombat/
├── index.js              # 入口: 注册 CoffeeScript, 启动 server
├── server.js             # 创建 Express app, 绑定 HTTP 端口
├── server_setup.js       # Express 中间件配置 (压缩/日志/路由/静态文件)
├── server_config.js      # 服务端配置 (端口/域名/环境变量)
├── app/                  # 客户端源码
│   ├── core/             # 核心框架层
│   │   ├── initialize.js   # Vue/Vuex/Router 初始化, Datadog RUM
│   │   ├── application.js  # 全局应用对象, i18n 初始化
│   │   ├── Router.js       # Backbone Router (所有路由定义)
│   │   ├── vueRouter.js    # Vue Router 路由定义
│   │   ├── auth.js         # 用户认证 (me 对象)
│   │   ├── store/          # Vuex Store 模块
│   │   ├── api/            # REST API 客户端封装
│   │   └── services/       # 第三方服务 (Stripe/Zendesk/PayPal)
│   ├── models/           # Backbone Models (数据层)
│   ├── collections/      # Backbone Collections
│   ├── views/            # Backbone Views + Vue 页面
│   ├── components/       # Vue 组件
│   ├── templates/        # Pug 模板
│   ├── schemas/          # JSON Schema 定义 (数据校验)
│   ├── lib/              # 游戏引擎与工具库
│   │   ├── world/          # World 模拟引擎 (Thang/系统/帧)
│   │   ├── surface/        # 渲染层 (Lank/Camera/Surface)
│   │   ├── aether/         # 代码沙箱 (用户代码编译/执行)
│   │   ├── God.coffee      # Web Worker 调度器
│   │   └── Angel.coffee    # Worker 线程执行逻辑
│   ├── locale/           # i18n 国际化文件
│   ├── styles/           # 全局样式
│   └── assets/           # 静态资源
├── ozaria/               # Ozaria 产品特有代码
│   ├── engine/             # 过场动画引擎
│   ├── site/               # Ozaria 页面/组件/Store
│   └── ...
├── vendor/               # 第三方库 (esper 语言插件等)
├── scripts/              # 构建/运维脚本
├── spec/                 # Aether 单元测试
├── test/                 # Karma 前端测试
└── development/          # 开发环境配置 (Docker/Vagrant)
```

---

## 核心子系统

### 1. 游戏模拟引擎 (`app/lib/world/`)

游戏的核心是一个确定性的 **ECS (Entity-Component-System)** 风格世界模拟：

- **World** — 管理所有帧(frame)的模拟循环
- **Thang** — 游戏实体 (英雄、怪物、地形)
- **Component** — 附加在 Thang 上的行为逻辑
- **System** — 全局系统 (碰撞检测、移动)
- **GoalManager** — 关卡目标判定

模拟在 **Web Worker** 中运行（通过 God → Angel 调度），与 UI 线程隔离，保证流畅渲染。

### 2. 代码沙箱 (`app/lib/aether/` + `vendor/esper-*`)

玩家编写的代码（Python/JavaScript/CoffeeScript/Java/C++）通过 **Aether/Esper** 框架：
1. 编译为统一 AST
2. 在沙箱中逐步执行
3. 产生 Thang 动作指令反馈到 World

### 3. 渲染层 (`app/lib/surface/`)

基于 **CreateJS (EaselJS)**：
- **Surface** — 主画布管理、帧播放
- **LankBoss** — Sprite 实体管理
- **Lank** — 单个角色的动画/渲染
- **Camera** — 视口控制
- **LayerAdapter** — 图层管理与 SpriteSheet 生成

### 4. 路由与页面 (`app/core/Router.js` + `app/core/vueRouter.js`)

采用 **Backbone Router + Vue Router** 混合模式：
- 遗留页面: Backbone View 通过 `routeDirectly()` 加载
- 新页面: Vue SFC 通过 `SingletonAppVueComponentView` 桥接
- 路由表集中定义在 Router.js 中

### 5. 状态管理 (`app/core/store/`)

Vuex Store 按功能拆分模块：
- `me` — 当前用户
- `classrooms` / `courses` / `courseInstances` — 教学相关
- `game` / `gameContent` — 游戏数据
- `teacherDashboard` / `schoolAdministrator` — 管理后台
- `campaigns` / `levels` / `levelSessions` — 关卡进度

### 6. 数据模型 (`app/models/`)

Backbone Model 层, 关键模型:
- **User** — 用户（学生/教师/管理员）
- **Level** — 关卡定义
- **LevelSession** — 玩家关卡进度
- **ThangType** — 角色/物品类型
- **Classroom** / **Course** — 教学班级与课程
- **Campaign** — 关卡地图 (世界)
- **Prepaid** — 许可证

### 7. 双产品机制

通过环境变量 `COCO_PRODUCT=codecombat|ozaria` 切换产品：
- Webpack 通过 `ProductResolverPlugin` 解析 `.coco.coffee` / `.ozar.coffee` 后缀文件
- 路由层根据产品显示不同首页
- `ozaria/` 目录包含 Ozaria 独有的过场动画引擎和教学页面

---

## 数据流

```
用户编写代码
     │
     ▼
Aether/Esper 编译 + 沙箱执行
     │
     ▼
World 模拟引擎 (Web Worker)
     │ (帧数据)
     ▼
Surface 渲染层 (CreateJS)
     │
     ▼
浏览器画布
```

---

## 游戏资源

### 本地资源 (`app/assets/`)

| 路径 | 内容 |
|------|------|
| `app/assets/images/` | UI 图片、页面插图（约 51 个子目录按功能划分） |
| `app/assets/sounds/` | 音效和背景音乐 |
| `app/assets/markdown/` | 课程指南、FAQ 等文档 |
| `app/assets/javascripts/` | 引导脚本和 Web Worker |

### 远程资源 (CDN)

角色 Sprite、动画帧、关卡地图等大量美术资源**不在本仓库中**（关卡内容不开源）。运行时通过 `ThangType` 模型从 CDN (`files.codecombat.com`) 动态加载。

### 其他资源目录

- `vendor/` — 第三方 JS 库（Esper 语言插件等）和样式
- `app/styles/` — 全局 Sass/SCSS 样式文件

---

## 构建与部署

- **开发**: `npm run dev` (Webpack watch + 热重载)
- **构建**: `npm run build` (Webpack production + Bower)
- **代理模式**: `npm run proxy` (前端开发连接远程后端)
- **Docker**: `docker-compose up` (完整本地环境)
- **测试**: `npm test` (Karma + Jasmine)

---

## 关键设计决策

1. **CoffeeScript → JavaScript 迁移中**: 使用 decaffeinate 批量转换，新代码用 JS/Vue
2. **Backbone + Vue 共存**: 通过 `BackboneVueMetaBinding` 桥接，渐进式迁移
3. **确定性模拟**: World 引擎帧可重放，支持回放和AI对战验证
4. **Web Worker 隔离**: 玩家代码在 Worker 中执行，防止阻塞 UI
5. **JSON Schema 驱动**: 数据模型通过 tv4 + Treema 实现校验和可视化编辑
6. **多语言代码执行**: 通过 Esper 插件支持 Python/JS/Java/C++ 等
