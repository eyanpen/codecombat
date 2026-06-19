# CodeCombat 安装与启动指南

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | 22.22.1 |
| npm | 10.9.4 |
| Bower | 全局安装 (`npm install -g bower`) |

可选：Docker（用于容器化开发环境）。

---

## 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/codecombat/codecombat.git
cd codecombat

# 2. 使用正确的 Node 版本（如果用 nvm）
nvm install
nvm use

# 3. 安装依赖
npm install
bower install

# 4. 构建 Aether（代码沙箱引擎）
npm run build-aether
```

---

## 启动方式

### 方式一：代理模式（推荐，无需数据库）

前端本地编译 + API 请求代理到远程 staging 后端：

```bash
# 终端 1: Webpack watch 实时编译前端
npm run dev

# 终端 2: 启动代理服务器
npm run proxy
```

访问 http://localhost:3000

代理目标默认为 `https://direct.staging.codecombat.com`，可通过环境变量覆盖：

```bash
COCO_PROXY_TARGET=https://your-backend.com npm run proxy
```

### 方式二：Docker 容器

```bash
docker-compose up
```

自动执行 `npm install` → `npm run build` → `npm run proxy`，映射端口 7777→3000。

访问 http://localhost:7777

### 方式三：Ozaria 产品

```bash
npm run dev:ozaria     # Webpack watch (Ozaria)
COCO_PRODUCT=ozaria COCO_PORT=3001 npm run proxy
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `COCO_PRODUCT` | `codecombat` | 产品切换：`codecombat` 或 `ozaria` |
| `COCO_PORT` | `3000` | 服务端口 |
| `COCO_PROXY` | 无 | 设为 `true` 启用代理模式 |
| `COCO_PROXY_TARGET` | `https://direct.staging.codecombat.com` | 代理目标地址 |
| `COCO_PROXY_NEXT` | 无 | 设置后代理到 next 环境 |
| `COCO_COOKIE_SECRET` | `chips ahoy` | Session 加密密钥 |
| `COCO_TIMEOUT` | `60000` | 请求超时（毫秒） |
| `COCO_FORCE_COMPRESSION` | 无 | 强制启用 gzip |
| `COCO_CHINA_INFRASTRUCTURE` | 无 | 中国基础设施模式 |

---

## 数据库

项目后端使用 **MongoDB**。但在代理模式下（`npm run proxy`），所有数据请求被转发到远程服务器，**本地不需要安装 MongoDB**。

如需完全离线运行，按以下步骤安装 MongoDB：

### 安装 MongoDB 7.0（Ubuntu 24.04）

```bash
# 添加 GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# 添加 apt 源（Ubuntu 24.04 使用 jammy 源兼容）
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 安装
sudo apt-get update
sudo apt-get install -y mongodb-org

# 启动并设置开机自启
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 启动后台服务

```bash
# 默认端口 3000
node index.js

# 自定义端口（如 3300）
COCO_PORT=3300 node index.js
```

访问 http://localhost:3300

---

## 生产构建

```bash
npm run build
```

执行流程：`bower install` → `build-aether` → `webpack --production`

产物输出到 `public_coco/`（CodeCombat）或 `public_ozar/`（Ozaria）。

---

## 常见问题

**Q: 启动时报错找不到 favicon？**

前端资源未构建。运行 `npm run build` 或 `npm run dev` 后重试。

**Q: 内存不足 / JavaScript heap out of memory？**

Webpack 需要大内存，npm scripts 已配置 `--max-old-space-size=4096`。如仍不够，手动加大：

```bash
NODE_OPTIONS='--max-old-space-size=8192' npm run dev
```

**Q: 后台如何连接 MongoDB？**

开源版仓库**不包含数据库连接层代码**。`package.json` 中没有 `mongoose`/`mongodb` 驱动，仓库内无数据库连接逻辑。真正的后端 API 层（含 MongoDB CRUD、用户认证）是闭源的。

本地开发推荐使用代理模式（`npm run proxy`），API 请求转发到远程 staging 服务器，无需本地数据库。

**Q: 如何通过局域网 IP 访问？**

Express 默认绑定 `0.0.0.0`（所有网卡），启动后即可通过局域网 IP 直接访问，无需额外配置：

```bash
COCO_PORT=3300 node index.js
# 访问 http://10.210.156.69:3300
```

如果无法访问，检查防火墙：

```bash
sudo ufw allow 3300/tcp
```

**Q: 如何只编译部分模块加速开发？**

编辑 `webpack.development.config.js`，取消注释需要忽略的 `IgnorePlugin` 行。
