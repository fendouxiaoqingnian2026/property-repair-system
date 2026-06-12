# SmartProperty 智慧物业报修管理系统 — v3.7

## 本次更新：本地数据与网页端/手机端三端互通

### 问题
- 直接双击打开 `index.html` 录入的数据（localStorage），通过 `localhost:3000` 网页端访问时看不到
- 网页端数据拉取会覆盖本地 localStorage 数据

### 解决方案

**服务端 `server.js`：新增 `POST /api/sync-local`**
- 启动时接受前端上传的 localStorage 数据
- 智能合并：服务器为空时全量导入；有数据时 ID 去重追加
- 合并后广播通知其他客户端刷新

**客户端 `index.html`：`API.init()` 三阶段初始化**
1. 读取 localStorage → 上传到服务器 (`/api/sync-local`)
2. 从服务器拉取合并后的完整数据
3. 建立 WebSocket 实时连接

### 数据互通架构
```
本地 index.html (localStorage)
       ↕ 上传/同步
   server.js (database.json)
       ↕ WebSocket 广播
手机端 / 其他电脑 (自动刷新)
```

---

## v3.6 配置数据持久化修复
- 所有配置 CRUD 函数（地址/类型/类别/用户等 20+ 函数）增加 `refreshAll()` 调用
- 修复了"录入信息不保存"的核心 Bug

---

## v3.5 全面审计修复
- **严重**：密码明文泄露（API返回脱敏）、静态文件暴露（server.js/data/可下载）
- **高危**：工单号WX→HSJ、迁移重复执行、全局错误处理
- **中低危**：知识库丢失、CSS缺失、WebSocket内存泄漏等

---

## 技术栈
- 前端：单文件 HTML5 + CSS3 + Vanilla JS + Chart.js
- 后端：Node.js + Express + WebSocket (ws)
- 数据：JSON 文件持久化 + localStorage 兜底
- 启动：`node server.js` 或双击 `启动服务器.bat`
