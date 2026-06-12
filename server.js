/**
 * SmartProperty 智慧物业报修管理系统 — 后端服务
 * 版本: 3.0
 * 技术: Node.js + Express + WebSocket (ws)
 * 功能: REST API + 实时推送 + 文件持久化存储
 * 
 * 启动方式:
 *   node server.js           (默认端口 3000)
 *   PORT=8080 node server.js (自定义端口)
 * 
 * 手机/电脑访问:  http://<本机IP>:3000
 */

'use strict';

const http    = require('http');
const express = require('express');
const WebSocket = require('ws');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// ─── 配置 ────────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
const DATA_DIR  = path.join(__dirname, 'data');        // 数据存储目录
const DB_FILE   = path.join(DATA_DIR, 'database.json');
const LOG_FILE  = path.join(DATA_DIR, 'access.log');

// ─── 初始化目录 ───────────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('✅ 数据目录已创建:', DATA_DIR);
}

// ─── 默认初始数据 ─────────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  version: '3.0',
  savedAt: new Date().toISOString(),

  // 用户数据
  users: [
    { id: 1, name: 'admin',  password: 'admin123', role: '超级管理员', status: 'active',   email: 'admin@smartproperty.com',  avatar: '👑' },
    { id: 2, name: '张经理',  password: '123456',   role: '库管员',     status: 'active',   email: 'zhang@smartproperty.com',  avatar: '📦' },
    { id: 3, name: '李主管',  password: '123456',   role: '工程人员',   status: 'active',   email: 'li@smartproperty.com',     avatar: '🔧' },
    { id: 4, name: '王客服',  password: '123456',   role: '客服员',     status: 'active',   email: 'wang@smartproperty.com',   avatar: '🎧' },
    { id: 5, name: '赵文员',  password: '123456',   role: '客服员',     status: 'disabled', email: 'zhao@smartproperty.com',   avatar: '👤' }
  ],
  nextUserId: 6,

  // 工单数据
  orders: [
    { id: 'HSJ-2026-0001', type: '水电维修', address: '1栋201室', contact: '张三', phone: '13800001111', priority: '紧急', status: 'processing', tech: '李主管', time: '2026-06-08 09:00', dispatchedAt: '2026-06-08 09:15', desc: '厨房水管漏水，影响楼下', materials: '密封胶, 水管接头' },
    { id: 'HSJ-2026-0002', type: '管道疏通', address: '2栋305室', contact: '李四', phone: '13800002222', priority: '高',   status: 'pending',    tech: '',     time: '2026-06-08 10:30', desc: '客厅下水道堵塞，返水严重', materials: '' },
    { id: 'HSJ-2026-0003', type: '门窗维修', address: '公区大堂', contact: '物业', phone: '13800000000', priority: '普通', status: 'completed',  tech: '李主管', time: '2026-06-07 14:00', dispatchedAt: '2026-06-07 14:20', completedAt: '2026-06-07 15:45', desc: '大堂玻璃门闭合异常', materials: '门轴x2, 螺丝x8' }
  ],
  nextOrderId: 4,

  // 技术人员
  technicians: [
    { id: 1, name: '李主管', phone: '13900001111', specialty: '电路维修', status: 'active',  orders: 12, rating: 4.8 },
    { id: 2, name: '王师傅', phone: '13900002222', specialty: '水暖维修', status: 'active',  orders: 8,  rating: 4.6 },
    { id: 3, name: '赵师傅', phone: '13900003333', specialty: '门窗维修', status: 'inactive', orders: 5, rating: 4.5 }
  ],
  nextTechId: 4,

  // 设备资产
  assets: [
    { id: 1, code: 'SB-001', name: '消防水泵',  cat: '消防设备', loc: '地下室泵房', model: 'XBD5.0/30', date: '2022-01-15', cycle: 12, status: 'normal'      },
    { id: 2, code: 'SB-002', name: '电梯轿厢',  cat: '电梯设备', loc: '1号楼',     model: 'KONE MonoSpace', date: '2021-06-01', cycle: 3, status: 'maintenance' },
    { id: 3, code: 'SB-003', name: '监控摄像头', cat: '安防设备', loc: '小区大门',  model: 'DS-2CD2T47', date: '2023-03-10', cycle: 24, status: 'normal'      }
  ],
  nextAssetId: 4,

  // 库存物料
  inventory: [
    { id: 1, code: 'CL-001', name: '密封胶',    cat: '防水材料', spec: '中性硅酮',   unit: '支', qty: 50, safe: 20 },
    { id: 2, code: 'CL-002', name: '水管接头',  cat: '管道配件', spec: 'DN25 PPR',   unit: '个', qty: 8,  safe: 15 },
    { id: 3, code: 'CL-003', name: '空气开关',  cat: '电气元件', spec: '2P 16A DZ47', unit: '个', qty: 30, safe: 10 }
  ],
  nextInvId: 4,

  // 库存出入库记录
  inventoryTransactions: [],
  nextTrId: 1,

  // 固定资产
  fixedAssets: [
    { id: 1, code: 'GD-001', name: '值班室空调',    cat: '办公电器', spec: '格力1.5P',  location: '物业值班室', responsible: 'admin', date: '2023-01-10', status: 'normal', note: '' },
    { id: 2, code: 'GD-002', name: '巡逻电动车',    cat: '交通工具', spec: '台铃48V',   location: '地下停车场', responsible: 'admin', date: '2022-08-15', status: 'normal', note: '' }
  ],
  nextFaId: 3,

  // 分类配置
  addresses: [],
  nextAddrId: 1,
  zones: [],
  nextZoneId: 1,
  repairTypes: [
    { id: 'hsj-lx-1',  name: '水电维修',   category: 'owner' },
    { id: 'hsj-lx-2',  name: '管道疏通',   category: 'owner' },
    { id: 'hsj-lx-3',  name: '门窗维修',   category: 'owner' },
    { id: 'hsj-lx-4',  name: '空调维修',   category: 'owner' },
    { id: 'hsj-lx-5',  name: '电梯故障',   category: 'owner' },
    { id: 'hsj-lx-6',  name: '墙面修补',   category: 'owner' },
    { id: 'hsj-lx-7',  name: '弱电系统',   category: 'owner' },
    { id: 'hsj-lx-8',  name: '其他',       category: 'owner' },
    { id: 'hsj-lx-9',  name: '电梯故障',   category: 'public' },
    { id: 'hsj-lx-10', name: '楼道照明',   category: 'public' },
    { id: 'hsj-lx-11', name: '消防设施',   category: 'public' },
    { id: 'hsj-lx-12', name: '门禁系统',   category: 'public' },
    { id: 'hsj-lx-13', name: '绿化/景观',  category: 'public' },
    { id: 'hsj-lx-14', name: '地下车库',   category: 'public' },
    { id: 'hsj-lx-15', name: '健身器材',   category: 'public' },
    { id: 'hsj-lx-16', name: '公共卫生间', category: 'public' },
    { id: 'hsj-lx-17', name: '外墙/屋顶',  category: 'public' },
    { id: 'hsj-lx-18', name: '其他公区',   category: 'public' }
  ],
  nextRtId: 19,
  assetCategories: ['消防设备','电梯设备','安防设备','供电设备','给排水设备'],
  nextAcId: 6,
  fixedAssetCategories: ['办公电器','交通工具','办公家具','通讯设备'],
  nextFacId: 5,

  // 知识库
  knowledge: [
    { id: 1, title: '水管漏水快速处理指南',   cat: '水电维修', diff: '简单', views: 128, date: '2026-05-10' },
    { id: 2, title: '家用空调常见故障诊断',   cat: '设备维修', diff: '中等', views: 96,  date: '2026-04-22' },
    { id: 3, title: '电路短路排查方法',       cat: '电气维修', diff: '困难', views: 74,  date: '2026-03-15' }
  ],
  nextKbId: 4
};

// ─── 数据库读写 ───────────────────────────────────────────────────────────────
let db = null;   // 内存中的数据库
let saveTimer = null;

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
      console.log('✅ 数据库已加载:', DB_FILE);
      console.log(`   工单: ${db.orders?.length || 0} 条 | 用户: ${db.users?.length || 0} 个 | 资产: ${db.assets?.length || 0} 条`);
    } else {
      db = { ...DEFAULT_DATA };
      saveDatabase();
      console.log('✅ 已创建初始数据库');
    }
  } catch (e) {
    console.error('❌ 数据库加载失败，使用默认数据:', e.message);
    db = { ...DEFAULT_DATA };
  }
}

// ── 自动数据迁移 ──────────────────────────────────────────────────────────────
// 每次服务器启动时运行，自动升级旧格式数据到最新格式，不丢失用户数据
function migrateDatabase() {
  if (!db._migratedVersion) db._migratedVersion = '0';

  const migrations = [
    {
      // v3.1: repairTypes 从字符串数组升级为对象数组
      from: '0', to: '3.1',
      run() {
        if (db.repairTypes && db.repairTypes.length > 0 && typeof db.repairTypes[0] === 'string') {
          // 备份旧值
          const oldTypes = [...db.repairTypes];
          console.log(`🔄 数据迁移 v3.1: repairTypes 格式升级 (${oldTypes.length} 条)...`);
          // 转换：旧字符串数组 → 新 {id, name, category} 对象数组
          // id 使用新前缀 hsj-lx-，category 尝试从名称推断
          const publicKeywords = ['电梯','楼道','消防','门禁','绿化','车库','器材','卫生间','外墙','屋顶','公区'];
          db.repairTypes = oldTypes.map((name, i) => {
            const isPublic = publicKeywords.some(kw => name.includes(kw));
            return {
              id: `hsj-lx-${i + 1}`,
              name: name,
              category: isPublic ? 'public' : 'owner'
            };
          });
          db.nextRtId = oldTypes.length + 1;
          console.log(`   ✅ repairTypes 已迁移为对象格式`);
        }
        if (db.nextRtId === 7) {
          db.nextRtId = 19; // 补至新预设值
        }
        // 修复 nextOrderId: 旧值是 2026004，应为 4
        if (db.nextOrderId > 100000) {
          const maxN = Math.max(0, ...(db.orders || []).map(o => {
            const m = (o.id || '').match(/(\d+)$/);
            return m ? parseInt(m[1]) : 0;
          }));
          db.nextOrderId = maxN + 1;
          console.log(`   ✅ nextOrderId 修复为 ${db.nextOrderId}`);
        }
        // 迁移工单数据：WX- → HSJ-，优先级 urgent/high/normal → 中文
        let migratedOrders = 0;
        (db.orders || []).forEach(o => {
          if (o.id && o.id.startsWith('WX-')) {
            // WX-2026001 → HSJ-2026-0001
            const raw = o.id.replace('WX-', ''); // 2026001
            const year = raw.substring(0, 4);     // 2026
            const seq  = raw.substring(4);        // 001
            o.id = 'HSJ-' + year + '-' + seq.padStart(4, '0');
            migratedOrders++;
          }
          const priorityMap = { urgent: '紧急', high: '高', normal: '普通' };
          if (priorityMap[o.priority]) o.priority = priorityMap[o.priority];
        });
        if (migratedOrders > 0) console.log(`   ✅ ${migratedOrders} 条工单号已迁移 WX → HSJ`);
      }
    }
  ];

  for (const m of migrations) {
    if (compareVersions(db._migratedVersion, m.from) <= 0) {
      console.log(`🔄 执行数据迁移: ${m.from} → ${m.to}`);
      // 迁移前自动备份
      autoBackup();
      m.run();
      db._migratedVersion = m.to;
      db.version = '3.1';
    }
  }

      // 迁移标记持久化到数据库，避免下次重启重复执行
      saveDatabase(true); // 迁移完成后立即写入磁盘
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function autoBackup() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const backupFile = path.join(DATA_DIR, `backup-${stamp}.json`);
      fs.copyFileSync(DB_FILE, backupFile);
      console.log(`💾 自动备份已保存: ${backupFile}`);
    }
  } catch (e) {
    console.error('⚠️ 自动备份失败:', e.message);
  }
}

function saveDatabase(immediate = false) {
  const doSave = () => {
    try {
      db.savedAt = new Date().toISOString();
      // 保留 _migratedVersion 以持久化迁移状态（避免每次重启都重复迁移）
      const json = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_FILE, json, 'utf8');
    } catch (e) {
      console.error('❌ 数据库保存失败:', e.message);
    }
  };

  if (immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    doSave();
  } else {
    // 防抖：500ms 后批量保存，避免频繁写盘
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 500);
  }
}

// ─── WebSocket 实时推送 ───────────────────────────────────────────────────────
const clients = new Set();   // 已连接的客户端

function broadcast(event, payload, excludeWs = null) {
  const msg = JSON.stringify({ event, payload, ts: Date.now() });
  clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

// ─── Express 应用 ─────────────────────────────────────────────────────────────
const app = express();

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 允许跨域 (方便开发调试)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 静态文件服务 — 仅提供前端 index.html，禁止访问 server.js、data/ 等敏感文件
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  });
});
// 禁止直接访问其他文件
app.get('/*', (req, res, next) => {
  // 只允许 index.html 通过文件系统访问
  if (req.path === '/' || req.path === '/index.html') return next();
  // 拦截 data/、server.js、package.json 等敏感路径
  if (req.path.startsWith('/data/') || req.path.endsWith('.js') || req.path.endsWith('.json') || req.path.endsWith('.log') || req.path.endsWith('.bat')) {
    return res.status(403).json({ ok: false, error: '禁止访问' });
  }
  next();
});

// 访问日志中间件
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const line = `[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}\n`;
    fs.appendFileSync(LOG_FILE, line);
  }
  next();
});

// ─── API 路由 ─────────────────────────────────────────────────────────────────

// ── 系统状态 ──
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    version: '3.0',
    serverTime: new Date().toISOString(),
    connectedClients: clients.size,
    stats: {
      orders: db.orders?.length || 0,
      users: db.users?.length || 0,
      assets: db.assets?.length || 0,
      inventory: db.inventory?.length || 0
    }
  });
});

// ── 完整数据快照 (全量同步) ──
app.get('/api/data', (req, res) => {
  // 发送前脱敏：移除密码字段，避免泄露
  const safeDb = { ...db };
  if (safeDb.users) {
    safeDb.users = safeDb.users.map(u => { const { password, ...rest } = u; return rest; });
  }
  // 移除内部字段
  delete safeDb._migratedVersion;
  res.json({ ok: true, data: safeDb });
});

// ── 全量保存 (前端推送全部数据) ──
app.post('/api/data', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ ok: false, error: '无效的数据格式' });
    }
    // 合并数据（保留服务端版本号等元信息）
    Object.assign(db, incoming, {
      version: '3.0',
      savedAt: new Date().toISOString()
    });
    saveDatabase();
    broadcast('data_updated', { source: 'full_sync', ts: Date.now() }, req.ws);
    res.json({ ok: true, savedAt: db.savedAt });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 以下是细粒度 REST API（预留扩展接口，方便未来拆分业务或对接第三方）
// ─────────────────────────────────────────────────────────────────────────────

// ── 用户 CRUD ──
app.get('/api/users', (req, res) => {
  // 不返回密码
  const safeUsers = (db.users || []).map(u => ({ ...u, password: undefined }));
  res.json({ ok: true, data: safeUsers });
});

app.post('/api/users', (req, res) => {
  const u = req.body;
  if (!u.name || !u.password) return res.status(400).json({ ok: false, error: '缺少必填字段' });
  const newUser = { ...u, id: db.nextUserId++ };
  db.users = [...(db.users || []), newUser];
  saveDatabase();
  broadcast('users_changed', { action: 'create', user: { ...newUser, password: undefined } });
  res.json({ ok: true, data: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.users || []).findIndex(u => u.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '用户不存在' });
  db.users[idx] = { ...db.users[idx], ...req.body, id };
  saveDatabase();
  broadcast('users_changed', { action: 'update', user: { ...db.users[idx], password: undefined } });
  res.json({ ok: true, data: db.users[idx] });
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const before = (db.users || []).length;
  db.users = (db.users || []).filter(u => u.id !== id);
  if (db.users.length === before) return res.status(404).json({ ok: false, error: '用户不存在' });
  saveDatabase();
  broadcast('users_changed', { action: 'delete', id });
  res.json({ ok: true });
});

// ── 工单 CRUD ──
app.get('/api/orders', (req, res) => {
  let list = db.orders || [];
  if (req.query.status) list = list.filter(o => o.status === req.query.status);
  if (req.query.priority) list = list.filter(o => o.priority === req.query.priority);
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    list = list.filter(o => o.id.toLowerCase().includes(q) || o.contact.includes(q) || o.address.includes(q));
  }
  res.json({ ok: true, data: list, total: list.length });
});

app.get('/api/orders/:id', (req, res) => {
  const order = (db.orders || []).find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: '工单不存在' });
  res.json({ ok: true, data: order });
});

app.post('/api/orders', (req, res) => {
  const o = req.body;
  if (!o.type || !o.address || !o.contact) return res.status(400).json({ ok: false, error: '缺少必填字段' });
  // 生成 HSJ-YYYY-NNNN 格式工单号
  const now = new Date();
  const year = now.getFullYear();
  const seq = String(db.nextOrderId).padStart(4, '0');
  const idStr = `HSJ-${year}-${seq}`;
  const newOrder = {
    id: idStr,
    type: o.type, address: o.address, contact: o.contact, phone: o.phone || '',
    priority: o.priority || 'normal', status: 'pending', tech: '', materials: '',
    time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    desc: o.desc || '', createdBy: o.createdBy || ''
  };
  db.nextOrderId++;
  db.orders = [newOrder, ...(db.orders || [])];
  saveDatabase();
  broadcast('order_created', newOrder);
  res.status(201).json({ ok: true, data: newOrder });
});

app.put('/api/orders/:id', (req, res) => {
  const idx = (db.orders || []).findIndex(o => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '工单不存在' });
  const before = db.orders[idx];
  db.orders[idx] = { ...before, ...req.body, id: before.id };
  saveDatabase();
  broadcast('order_updated', db.orders[idx]);
  res.json({ ok: true, data: db.orders[idx] });
});

app.delete('/api/orders/:id', (req, res) => {
  const before = (db.orders || []).length;
  db.orders = (db.orders || []).filter(o => o.id !== req.params.id);
  if (db.orders.length === before) return res.status(404).json({ ok: false, error: '工单不存在' });
  saveDatabase();
  broadcast('order_deleted', { id: req.params.id });
  res.json({ ok: true });
});

// ── 工单接单/派单 ──
app.post('/api/orders/:id/claim', (req, res) => {
  const idx = (db.orders || []).findIndex(o => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '工单不存在' });
  db.orders[idx] = {
    ...db.orders[idx],
    status: 'processing',
    tech: req.body.techName || '',
    claimedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  };
  saveDatabase();
  broadcast('order_claimed', db.orders[idx]);
  res.json({ ok: true, data: db.orders[idx] });
});

app.post('/api/orders/:id/dispatch', (req, res) => {
  const idx = (db.orders || []).findIndex(o => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '工单不存在' });
  db.orders[idx] = {
    ...db.orders[idx],
    status: 'processing',
    tech: req.body.techName || db.orders[idx].tech,
    dispatchedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  };
  saveDatabase();
  broadcast('order_dispatched', db.orders[idx]);
  res.json({ ok: true, data: db.orders[idx] });
});

app.post('/api/orders/:id/complete', (req, res) => {
  const idx = (db.orders || []).findIndex(o => o.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '工单不存在' });
  db.orders[idx] = {
    ...db.orders[idx],
    status: 'completed',
    completedAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
    completionNote: req.body.note || ''
  };
  saveDatabase();
  broadcast('order_completed', db.orders[idx]);
  res.json({ ok: true, data: db.orders[idx] });
});

// ── 设备资产 CRUD ──
app.get('/api/assets', (req, res) => {
  let list = db.assets || [];
  if (req.query.cat) list = list.filter(a => a.cat === req.query.cat);
  if (req.query.status) list = list.filter(a => a.status === req.query.status);
  res.json({ ok: true, data: list });
});

app.post('/api/assets', (req, res) => {
  const a = { ...req.body, id: db.nextAssetId++ };
  db.assets = [...(db.assets || []), a];
  saveDatabase();
  broadcast('asset_created', a);
  res.status(201).json({ ok: true, data: a });
});

app.put('/api/assets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.assets || []).findIndex(a => a.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '资产不存在' });
  db.assets[idx] = { ...db.assets[idx], ...req.body, id };
  saveDatabase();
  broadcast('asset_updated', db.assets[idx]);
  res.json({ ok: true, data: db.assets[idx] });
});

app.delete('/api/assets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.assets = (db.assets || []).filter(a => a.id !== id);
  saveDatabase();
  broadcast('asset_deleted', { id });
  res.json({ ok: true });
});

// ── 库存物料 CRUD ──
app.get('/api/inventory', (req, res) => {
  res.json({ ok: true, data: db.inventory || [] });
});

app.post('/api/inventory', (req, res) => {
  const i = { ...req.body, id: db.nextInvId++ };
  db.inventory = [...(db.inventory || []), i];
  saveDatabase();
  broadcast('inventory_changed', { action: 'create', item: i });
  res.status(201).json({ ok: true, data: i });
});

app.put('/api/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.inventory || []).findIndex(i => i.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '物料不存在' });
  db.inventory[idx] = { ...db.inventory[idx], ...req.body, id };
  saveDatabase();
  broadcast('inventory_changed', { action: 'update', item: db.inventory[idx] });
  res.json({ ok: true, data: db.inventory[idx] });
});

app.delete('/api/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.inventory = (db.inventory || []).filter(i => i.id !== id);
  saveDatabase();
  broadcast('inventory_changed', { action: 'delete', id });
  res.json({ ok: true });
});

// ── 库存入库/出库 ──
app.post('/api/inventory/transaction', (req, res) => {
  const { type, items, operator, note } = req.body;  // type: 'in' | 'out'
  if (!type || !Array.isArray(items)) return res.status(400).json({ ok: false, error: '参数错误' });

  const errors = [];
  items.forEach(({ code, qty }) => {
    const idx = (db.inventory || []).findIndex(i => i.code === code);
    if (idx < 0) { errors.push(`物料 ${code} 不存在`); return; }
    if (type === 'out' && db.inventory[idx].qty < qty) {
      errors.push(`${db.inventory[idx].name} 库存不足 (现有: ${db.inventory[idx].qty})`);
      return;
    }
    db.inventory[idx].qty += (type === 'in' ? qty : -qty);
  });

  if (errors.length) return res.status(400).json({ ok: false, errors });

  const tr = {
    id: db.nextTrId++,
    type, items, operator: operator || 'system',
    note: note || '', time: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
  };
  db.inventoryTransactions = [...(db.inventoryTransactions || []), tr];
  saveDatabase();
  broadcast('inventory_transaction', tr);
  res.json({ ok: true, data: tr });
});

// ── 固定资产 CRUD ──
app.get('/api/fixed-assets', (req, res) => {
  res.json({ ok: true, data: db.fixedAssets || [] });
});

app.post('/api/fixed-assets', (req, res) => {
  const a = { ...req.body, id: db.nextFaId++ };
  db.fixedAssets = [...(db.fixedAssets || []), a];
  saveDatabase();
  broadcast('fixed_asset_created', a);
  res.status(201).json({ ok: true, data: a });
});

app.put('/api/fixed-assets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.fixedAssets || []).findIndex(a => a.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '资产不存在' });
  db.fixedAssets[idx] = { ...db.fixedAssets[idx], ...req.body, id };
  saveDatabase();
  broadcast('fixed_asset_updated', db.fixedAssets[idx]);
  res.json({ ok: true, data: db.fixedAssets[idx] });
});

app.delete('/api/fixed-assets/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.fixedAssets = (db.fixedAssets || []).filter(a => a.id !== id);
  saveDatabase();
  broadcast('fixed_asset_deleted', { id });
  res.json({ ok: true });
});

// ── 技术人员 CRUD ──
app.get('/api/technicians', (req, res) => {
  res.json({ ok: true, data: db.technicians || [] });
});

app.post('/api/technicians', (req, res) => {
  const t = { ...req.body, id: db.nextTechId++ };
  db.technicians = [...(db.technicians || []), t];
  saveDatabase();
  broadcast('technician_created', t);
  res.status(201).json({ ok: true, data: t });
});

app.put('/api/technicians/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.technicians || []).findIndex(t => t.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '人员不存在' });
  db.technicians[idx] = { ...db.technicians[idx], ...req.body, id };
  saveDatabase();
  broadcast('technician_updated', db.technicians[idx]);
  res.json({ ok: true, data: db.technicians[idx] });
});

app.delete('/api/technicians/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.technicians = (db.technicians || []).filter(t => t.id !== id);
  saveDatabase();
  broadcast('technician_deleted', { id });
  res.json({ ok: true });
});

// ── 知识库 CRUD ──
app.get('/api/knowledge', (req, res) => {
  res.json({ ok: true, data: db.knowledge || [] });
});

app.post('/api/knowledge', (req, res) => {
  const k = { ...req.body, id: db.nextKbId++ };
  db.knowledge = [k, ...(db.knowledge || [])];
  saveDatabase();
  res.status(201).json({ ok: true, data: k });
});

app.put('/api/knowledge/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = (db.knowledge || []).findIndex(k => k.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: '案例不存在' });
  db.knowledge[idx] = { ...db.knowledge[idx], ...req.body, id };
  saveDatabase();
  res.json({ ok: true, data: db.knowledge[idx] });
});

app.delete('/api/knowledge/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.knowledge = (db.knowledge || []).filter(k => k.id !== id);
  saveDatabase();
  res.json({ ok: true });
});

// ── 配置类数据 ──
app.get('/api/config', (req, res) => {
  res.json({
    ok: true,
    data: {
      repairTypes: db.repairTypes || [],
      assetCategories: db.assetCategories || [],
      fixedAssetCategories: db.fixedAssetCategories || [],
      zones: db.zones || [],
      addresses: db.addresses || []
    }
  });
});

app.put('/api/config', (req, res) => {
  const allowed = ['repairTypes','assetCategories','fixedAssetCategories','zones','addresses'];
  allowed.forEach(key => {
    if (req.body[key]) db[key] = req.body[key];
  });
  saveDatabase();
  broadcast('config_updated', req.body);
  res.json({ ok: true });
});

// ── 本地数据上传合并（网页端读取本地 localStorage 数据同步到服务器）──
app.post('/api/sync-local', (req, res) => {
  try {
    const local = req.body;
    if (!local) return res.status(400).json({ ok: false, error: '无效数据' });

    const hasServerData = (db.orders && db.orders.length > 0) ||
                          (db.users && db.users.length > 4); // 超过4个默认用户=有业务数据

    if (!hasServerData) {
      // 服务器为空/新安装：直接用本地数据，同时保留服务器预设用户
      const serverUsers = db.users || [];
      Object.assign(db, local, { savedAt: new Date().toISOString() });
      // 合并用户：保留服务器已有的 + 本地新增的（去重）
      const allUsers = [...serverUsers];
      (local.users || []).forEach(lu => {
        if (!allUsers.find(su => su.id === lu.id || su.name === lu.name)) {
          allUsers.push(lu);
        }
      });
      db.users = allUsers;
      console.log('[sync-local] 服务器为空，已导入本地数据');
    } else {
      // 服务器已有数据：智能合并（本地新增的项追加到服务器）
      const arrayFields = ['orders','technicians','assets','inventory','inventoryTransactions',
        'addresses','zones','repairTypes','assetCategories','fixedAssets','fixedAssetCategories','knowledge'];
      let mergedCount = 0;
      arrayFields.forEach(field => {
        if (!local[field] || !Array.isArray(local[field])) return;
        if (!db[field]) { db[field] = []; }
        const serverIds = new Set(db[field].map(item => String(item.id || item.code || item.name)));
        const newItems = local[field].filter(item => {
          const itemId = String(item.id || item.code || item.name);
          return !serverIds.has(itemId);
        });
        if (newItems.length > 0) {
          db[field] = [...db[field], ...newItems];
          mergedCount += newItems.length;
        }
      });
      // 用户去重合并
      if (local.users) {
        const existingNames = new Set((db.users||[]).map(u => u.name));
        const newUsers = local.users.filter(u => !existingNames.has(u.name));
        if (newUsers.length > 0) db.users = [...(db.users||[]), ...newUsers];
      }
      console.log(`[sync-local] 合并了 ${mergedCount} 条本地数据`);
    }

    saveDatabase(true);
    broadcast('data_updated', { source: 'sync-local', ts: Date.now() });
    res.json({ ok: true, message: '本地数据已同步到服务器' });
  } catch (e) {
    console.error('[sync-local] 错误:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── 数据备份/恢复 ──
app.get('/api/backup', (req, res) => {
  const filename = `SmartProperty_Backup_${new Date().toISOString().replace(/[:.]/g,'').substring(0,15)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/restore', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.version) return res.status(400).json({ ok: false, error: '无效的备份文件' });
    // 备份当前数据
    const backupPath = path.join(DATA_DIR, `backup_before_restore_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2));
    Object.assign(db, data, { savedAt: new Date().toISOString() });
    saveDatabase(true);
    broadcast('data_restored', { ts: Date.now() });
    res.json({ ok: true, message: '恢复成功', backupSaved: backupPath });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── 通知推送 (供其他模块手动广播) ──
app.post('/api/broadcast', (req, res) => {
  const { event, payload } = req.body;
  if (!event) return res.status(400).json({ ok: false, error: '缺少 event 字段' });
  broadcast(event, payload || {});
  res.json({ ok: true, clients: clients.size });
});

// ── 全局错误处理中间件（捕获所有路由的未处理异常）───────────
app.use((err, req, res, next) => {
  console.error(`❌ [${req.method}] ${req.path} 服务器错误:`, err.message);
  console.error(err.stack);
  res.status(500).json({ ok: false, error: '服务器内部错误: ' + (err.message || '未知错误') });
});

// ─── HTTP + WebSocket 服务器 ──────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const ip = req.socket.remoteAddress;
  console.log(`🔌 WebSocket 连接 [${clients.size}] from ${ip}`);

  // 连接成功后发送完整数据快照
  ws.send(JSON.stringify({
    event: 'connected',
    payload: {
      message: '已连接到 SmartProperty 实时服务',
      connectedClients: clients.size,
      serverTime: new Date().toISOString()
    },
    ts: Date.now()
  }));

  // 发送完整数据（初始化），脱敏密码和内部字段
  const safeDb = { ...db };
  if (safeDb.users) {
    safeDb.users = safeDb.users.map(u => { const { password, ...rest } = u; return rest; });
  }
  delete safeDb._migratedVersion;
  ws.send(JSON.stringify({
    event: 'full_sync',
    payload: safeDb,
    ts: Date.now()
  }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // 客户端推送数据更新
      if (msg.event === 'save_data' && msg.payload) {
        // 保护服务器元数据，防止客户端覆盖
        const { version: _, savedAt: __, _migratedVersion: ___, ...cleanPayload } = msg.payload;
        Object.assign(db, cleanPayload);
        db.savedAt = new Date().toISOString();
        saveDatabase();
        // 广播给其他客户端
        broadcast('data_updated', { source: 'client', ts: Date.now() }, ws);
        ws.send(JSON.stringify({ event: 'saved', payload: { savedAt: db.savedAt }, ts: Date.now() }));
      }
      // Ping/Pong
      if (msg.event === 'ping') {
        ws.send(JSON.stringify({ event: 'pong', ts: Date.now() }));
      }
    } catch (e) {
      console.error('WebSocket 消息解析失败:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`🔌 WebSocket 断开 [${clients.size}]`);
  });

  ws.on('error', (e) => {
    clients.delete(ws);
    console.error('WebSocket 错误:', e.message);
  });
});

// ─── 启动 ─────────────────────────────────────────────────────────────────────
loadDatabase();
migrateDatabase();  // 自动升级旧数据格式，不丢失用户数据

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  Object.values(interfaces).forEach(nets => {
    nets.forEach(net => {
      if (net.family === 'IPv4' && !net.internal) localIP = net.address;
    });
  });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║    🏢 SmartProperty 智慧物业报修管理系统  v3.0           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  📡 服务地址:                                             ║`);
  console.log(`║     本机访问: http://localhost:${PORT}                       ║`);
  console.log(`║     局域网访问: http://${localIP}:${PORT}         ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  💾 数据存储: ${DATA_DIR.padEnd(40)}║`);
  console.log('║  🔌 WebSocket 实时同步: 已启用                           ║');
  console.log('║  📋 REST API: /api/* (预留升级接口)                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log('⚡ 手机访问: 确保手机和电脑在同一 WiFi 下，输入上方局域网地址');
  console.log('🛑 停止服务: Ctrl+C\n');
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n⏹  正在停止服务...');
  saveDatabase(true);
  console.log('💾 数据已保存');
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveDatabase(true);
  process.exit(0);
});

module.exports = { app, broadcast };
