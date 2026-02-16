// server.js - 坦克大戰伺服器【Server 端物理計算版】
// 所有物理運算在此執行，老師端只做地圖編輯與控制，學生端只做渲染
//    Powered by Google Blockly (Apache 2.0) | Educational platform and extensions © 2026 Justin Chang
//    本平台使用 Google Blockly（Apache License 2.0）開發｜教學平台與延伸功能 保留所有權利｜ © 2026 張世杰 (teachthinking@gmail.com")
const express = require('express');
const app = express();
const http = require('http').createServer(app);

// 加上 methods 允許跨網域連線
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname + '/public'));

// ============================================================
//  常數（與前端保持一致）
// ============================================================
const CANVAS_W = 600;
const CANVAS_H = 400;
const BULLET_SPEED = 8;
const BULLET_RANGE = 180;
const TANK_RADIUS = 12;
const BULLET_RADIUS = 4;
const HIT_RADIUS = 15;
const COOLDOWN_TICKS = 15;    // 開火冷卻 tick 數
const RESPAWN_MS = 3000;  // 重生延遲 ms
const TICK_MS = 50;    // 物理迴圈間隔 (20 fps 邏輯)


// ============================================================
//  預設地圖資料 (用於練習模式)
// ============================================================
const PRESET_MAPS = {
    'map1': [
        { x: 300, y: 200, w: 100, h: 50, type: 'wall', isDestructible: false, emoji: '🧱' },
        { x: 150, y: 100, w: 50, h: 50, type: 'wood', hp: 50, isDestructible: true, emoji: '📦' },
        { x: 450, y: 300, w: 50, h: 50, type: 'wood', hp: 50, isDestructible: true, emoji: '📦' }
    ],
    'map2': [
        // 你可以自己設計更複雜的迷宮
        { x: 200, y: 200, w: 20, h: 200, type: 'wall', isDestructible: false, emoji: '🧱' },
        { x: 400, y: 200, w: 20, h: 200, type: 'wall', isDestructible: false, emoji: '🧱' }
    ]
};

// ============================================================
//  房間管理
// ============================================================
const rooms = {};

function getRoom(roomId) {
    if (!rooms[roomId]) {
        rooms[roomId] = {
            players: {},
            bullets: [],
            walls: [],
            scores: { red: 0, blue: 0 },
            timeLeft: 180,
            active: false,
            tickCount: 0,
            loopHandle: null
        };
    }
    return rooms[roomId];
}

// ============================================================
//  物理與 AI 函數
// ============================================================
function checkCol(walls, x, y, r) {
    if (x < r || x > CANVAS_W - r || y < r || y > CANVAS_H - r) return true;
    for (const w of walls) {
        if (x > w.x - r && x < w.x + w.w + r &&
            y > w.y - r && y < w.y + w.h + r) return true;
    }
    return false;
}

function getSpawn(team, slot) {
    let y = 200;
    if (slot === 0) y = 60;
    if (slot === 2) y = 340;
    return team === 'red' ? { x: 50, y, a: 0 } : { x: 550, y, a: 180 };
}

function applyCmd(room, data) {
    const p = room.players[data.id];
    if (!p || p.hp <= 0) return;

    if (data.action === 'move') {
        const stepSize = 2;
        const steps = Math.floor(Math.abs(data.val) / stepSize);
        const dir = data.val >= 0 ? 1 : -1;
        const rad = p.angle * Math.PI / 180;
        const dx = Math.cos(rad) * stepSize * dir;
        const dy = Math.sin(rad) * stepSize * dir;
        for (let i = 0; i < steps; i++) {
            if (checkCol(room.walls, p.x + dx, p.y + dy, TANK_RADIUS)) break;
            p.x += dx; p.y += dy;
        }
    } else if (data.action === 'turn') {
        p.angle += data.val;
    } else if (data.action === 'fire') {
        if (!room.active) return;
        if (p.cooldown > 0) return;
        room.bullets.push({
            x: p.x, y: p.y,
            angle: p.angle,
            owner: p.id,
            team: p.team,
            distance: 0,
            maxRange: BULLET_RANGE
        });
        p.cooldown = COOLDOWN_TICKS;
    }
}

// 🌟 核心新增：AI 思考與移動邏輯
function updateBots(room) {
    for (let id in room.players) {
        let p = room.players[id];
        if (p.isBot && p.hp > 0) {
            // 簡單 AI 邏輯：每隔一段時間隨機轉向並開火，平時一直往前走
            p.botTimer--;

            if (p.botTimer <= 0) {
                // 決定下一個動作 (1~3 秒換一次動作)
                p.botTimer = 20 + Math.random() * 40;
                p.angle = Math.floor(Math.random() * 360); // 隨機轉向

                // 隨機開火 (30% 機率)
                if (Math.random() > 0.3 && p.cooldown <= 0) {
                    room.bullets.push({
                        x: p.x, y: p.y,
                        angle: p.angle,
                        owner: p.id,
                        team: p.team,
                        distance: 0,
                        maxRange: BULLET_RANGE
                    });
                    p.cooldown = COOLDOWN_TICKS;
                }
            }

            // 讓 AI 持續往前走
            let rad = p.angle * Math.PI / 180;
            let nx = p.x + Math.cos(rad) * 2; // AI 走慢一點 (速度2)
            let ny = p.y + Math.sin(rad) * 2;

            // 碰撞偵測 (使用您的 checkCol 函數)
            if (!checkCol(room.walls, nx, ny, TANK_RADIUS)) {
                p.x = nx;
                p.y = ny;
            } else {
                // 撞牆了就提早改變方向
                p.botTimer = 0;
            }
        }
    }
}

// ============================================================
//  物理迴圈 (每 50ms 執行一次)
// ============================================================
function tickRoom(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    room.tickCount++;

    // 🌟 讓 AI 機器人優先思考與動作
    if (room.active) {
        updateBots(room);
    }

    // 冷卻倒數
    for (const id in room.players) {
        if (room.players[id].cooldown > 0) room.players[id].cooldown--;
    }

    if (!room.active) {
        // 未開始：只廣播位置讓客戶端即時看到坦克
        io.to(roomId).emit('state', buildState(room));
        return;
    }

    // 計時
    room.timeLeft -= TICK_MS / 1000;
    if (room.timeLeft < 0) room.timeLeft = 0;

    // 子彈物理
    for (let i = room.bullets.length - 1; i >= 0; i--) {
        const b = room.bullets[i];
        const rad = b.angle * Math.PI / 180;
        b.x += Math.cos(rad) * BULLET_SPEED;
        b.y += Math.sin(rad) * BULLET_SPEED;
        b.distance += BULLET_SPEED;

        let destroy = (b.distance >= b.maxRange || checkCol(room.walls, b.x, b.y, BULLET_RADIUS));

        if (!destroy) {
            for (const pid in room.players) {
                const p = room.players[pid];
                if (p.team === b.team || p.hp <= 0) continue;
                const dx = p.x - b.x, dy = p.y - b.y;
                if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS) {
                    if (b.team === 'red') room.scores.red++;
                    else room.scores.blue++;
                    p.hp -= 20;
                    destroy = true;
                    if (p.hp <= 0) {
                        const savedPid = pid;
                        setTimeout(() => {
                            const r2 = rooms[roomId];
                            if (!r2 || !r2.players[savedPid]) return;
                            const pp = r2.players[savedPid];
                            const s = getSpawn(pp.team, pp.slot);
                            pp.x = s.x; pp.y = s.y; pp.angle = s.a; pp.hp = 100;
                        }, RESPAWN_MS);
                    }
                    break;
                }
            }
        }
        if (destroy) room.bullets.splice(i, 1);
    }

    // 時間到：結束比賽
    if (room.timeLeft <= 0) {
        room.active = false;
        let winner = 'draw';
        if (room.scores.red > room.scores.blue) winner = 'red';
        else if (room.scores.blue > room.scores.red) winner = 'blue';
        io.to(roomId).emit('state', buildState(room, true, winner));
        console.log(`🏁 房間 ${roomId} 結束，勝者: ${winner}`);
        return;
    }

    // 廣播
    io.to(roomId).emit('state', buildState(room));
}

function buildState(room, gameOver = false, winner = null) {
    return {
        players: room.players,
        bullets: room.bullets,
        scores: room.scores,
        time: room.timeLeft,
        gameOver,
        winner
    };
}

function startLoop(roomId) {
    const room = getRoom(roomId);
    if (room.loopHandle) return;
    room.loopHandle = setInterval(() => tickRoom(roomId), TICK_MS);
    console.log(`▶️  房間 ${roomId} 物理迴圈啟動`);
}

// ============================================================
//  Socket.io 事件
// ============================================================
io.on('connection', (socket) => {
    console.log('連線:', socket.id);

    // 加入房間（老師 & 學生共用）
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        const room = getRoom(roomId);
        startLoop(roomId);
        socket.emit('map', { walls: room.walls });
        socket.emit('state', buildState(room));
    });

    // ── 老師端事件 ──────────────────────────────────────────

    // 老師上傳地圖
    socket.on('setMap', (data) => {
        const room = getRoom(data.roomId);
        room.walls = data.walls;
        io.to(data.roomId).emit('map', { walls: room.walls });
        console.log(`🗺️  房間 ${data.roomId} 地圖更新`);
    });

    // 老師開始比賽
    socket.on('startGame', (data) => {
        const room = getRoom(data.roomId);
        room.active = true;
        room.timeLeft = data.timeLimit || 180;
        room.scores = { red: 0, blue: 0 };
        room.bullets = [];
        io.to(data.roomId).emit('state', buildState(room));
        console.log(`🔔 房間 ${data.roomId} 比賽開始`);
    });

    // 老師重置比賽
    socket.on('resetGame', (data) => {
        const room = getRoom(data.roomId);
        room.active = false;
        room.bullets = [];
        room.scores = { red: 0, blue: 0 };
        room.timeLeft = data.timeLimit || 180;
        for (const id in room.players) {
            const p = room.players[id];
            // 若為電腦則不強制重生至固定點，或依照需求修改
            if (!p.isBot) {
                const s = getSpawn(p.team, p.slot);
                p.x = s.x; p.y = s.y; p.angle = s.a;
            }
            p.hp = 100; p.cooldown = 0;
        }
        io.to(data.roomId).emit('state', buildState(room));
        io.to(data.roomId).emit('map', { walls: room.walls });
        console.log(`♻️  房間 ${data.roomId} 重置`);
    });

    // ── 學生端事件 ──────────────────────────────────────────

    // 學生加入
    socket.on('playerJoin', (data) => {
        const room = getRoom(data.roomId);
        const s = getSpawn(data.team, data.slot);
        room.players[data.id] = {
            id: data.id, name: data.name,
            team: data.team, slot: data.slot,
            x: s.x, y: s.y, angle: s.a,
            hp: 100, cooldown: 0, isBot: false
        };
        socket.playerId = data.id;
        io.to(data.roomId).emit('state', buildState(room));
        socket.emit('map', { walls: room.walls });
        console.log(`👤 ${data.name} 加入房間 ${data.roomId}`);
    });

    // 學生指令 → Server 直接計算，不再轉發給老師
    socket.on('cmd', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        applyCmd(room, data);
        // move / turn 立即廣播，不等下一個 tick
        if (data.action === 'move' || data.action === 'turn') {
            io.to(data.roomId).emit('state', buildState(room));
        }
    });

    // 斷線：移除玩家
    socket.on('disconnect', () => {
        console.log('斷線:', socket.id);
        const roomId = socket.roomId;
        const pid = socket.playerId;
        if (roomId && pid && rooms[roomId]) {
            delete rooms[roomId].players[pid];
            io.to(roomId).emit('state', buildState(rooms[roomId]));
        }
    });

    // ── 自由練習模式 ──────────────────────────────────────────
    socket.on('joinPractice', (data) => {
        const PR_ID = "practice_room"; // 固定的練習房號
        const room = getRoom(PR_ID);

        // 如果房間還沒啟動，初始化地圖跟 AI
        if (!room.active) {
            room.active = true;
            room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            room.timeLeft = 999; // 練習模式時間無限

            // 生成 AI 機器人 (設定為紅隊)
            for (let i = 0; i < data.botCount; i++) {
                let botId = 'bot_' + i + '_' + Date.now();
                room.players[botId] = {
                    id: botId, name: '🤖 電腦 ' + (i + 1),
                    team: 'red', slot: i + 1,
                    x: 500 - (i * 30), y: 50 + (i * 50), angle: 180,
                    hp: 100, cooldown: 0, isBot: true, // 標記為 Bot
                    // AI 的思考變數
                    botState: 'moving', botTimer: 0
                };
            }
            console.log(`🤖 練習房啟動，生成 ${data.botCount} 個 AI`);

            // 🌟 核心關鍵：自動啟動練習房的物理迴圈！
            startLoop(PR_ID);
        }

        // 玩家加入 (預設加入藍隊)
        room.players[data.id] = {
            id: data.id, name: data.name,
            team: 'blue', slot: Object.keys(room.players).length,
            x: 100 + (Math.random() * 50), y: 300, angle: 0, // 隨機一點出生避免重疊
            hp: 100, cooldown: 0, isBot: false
        };

        socket.playerId = data.id;
        socket.roomId = PR_ID; // 記住玩家所在的房間

        socket.join(PR_ID);
        socket.emit('map', { walls: room.walls });
        io.to(PR_ID).emit('state', buildState(room));
        console.log(`👤 ${data.name} 加入練習房`);
    });


    // ── 學生自由對戰模式 ──────────────────────────────────────────
    socket.on('joinStudentPvP', (data) => {
        const room = getRoom(data.roomId);

        // 🌟 巧思：如果房間還沒啟動，由第一位進來的學生負責初始化地圖與時間
        if (!room.active) {
            room.active = true;
            room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            room.timeLeft = 300; // 學生對戰設定為 5 分鐘一局 (300秒)
            room.scores = { red: 0, blue: 0 };
            room.bullets = [];

            console.log(`⚔️ 學生對戰房 [${data.roomId}] 啟動`);
            startLoop(data.roomId); // 自動啟動該房間的物理迴圈
        }

        // 玩家加入指定的隊伍與位置 (不產生 AI)
        const s = getSpawn(data.team, data.slot);
        room.players[data.id] = {
            id: data.id, name: data.name,
            team: data.team, slot: data.slot,
            x: s.x, y: s.y, angle: s.a,
            hp: 100, cooldown: 0, isBot: false
        };

        socket.playerId = data.id;
        socket.roomId = data.roomId;

        socket.join(data.roomId);
        socket.emit('map', { walls: room.walls });
        io.to(data.roomId).emit('state', buildState(room));
        console.log(`👤 ${data.name} 加入學生對戰房 [${data.roomId}]`);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ 伺服器已成功啟動，正在監聽 Port: ${PORT}`);
});
