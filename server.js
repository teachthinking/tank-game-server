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
        { "x": 240, "y": 240, "w": 40, "h": 40, "emoji": "🌵" },
        { "x": 280, "y": 240, "w": 40, "h": 40, "emoji": "🌵" },
        { "x": 320, "y": 240, "w": 40, "h": 40, "emoji": "🌵" },
        { "x": 320, "y": 200, "w": 40, "h": 40, "emoji": "🌵" },
        { "x": 320, "y": 160, "w": 40, "h": 40, "emoji": "🌵" },
        { "x": 200, "y": 40,  "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 200, "y": 0,   "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 200, "y": 80,  "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 240, "y": 80,  "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 280, "y": 80,  "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 160, "y": 320, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 160, "y": 360, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 200, "y": 360, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 400, "y": 360, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 360, "y": 360, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 360, "y": 320, "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 400, "y": 0,   "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 400, "y": 40,  "w": 40, "h": 40, "emoji": "🌲" },
        { "x": 400, "y": 80,  "w": 40, "h": 40, "emoji": "🌲" }
    ],
    'map2': [
        { "x": 160, "y": 120, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 200, "y": 80,  "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 160, "y": 80,  "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 160, "y": 160, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 360, "y": 160, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 360, "y": 200, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 360, "y": 240, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 320, "y": 240, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 360, "y": 120, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 320, "y": 120, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 160, "y": 200, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 200, "y": 200, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 200, "y": 320, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 200, "y": 360, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 400, "y": 320, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 360, "y": 360, "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 280, "y": 0,   "w": 40, "h": 40, "emoji": "🧱" },
        { "x": 320, "y": 0,   "w": 40, "h": 40, "emoji": "🧱" }
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
    // 稍微錯開出生點避免擠在一起
    if (slot === 1) y = 60;
    if (slot === 2) y = 130;
    if (slot === 3) y = 200;
    if (slot === 4) y = 270;
    if (slot === 5) y = 340;
    return team === 'red' ? { x: 50, y, a: 0 } : { x: 550, y, a: 180 };
}

function applyCmd(room, data) {
    const p = room.players[data.id];
    if (!p || p.hp <= 0) return;

    if (data.action === 'move') {
        // 🌟 把距離加入「目標移動緩衝區」
        p.targetMove = (p.targetMove || 0) + data.val;
    } else if (data.action === 'turn') {
        // 🌟 把轉向角度加入緩衝區
        p.targetAngle = (p.targetAngle !== undefined ? p.targetAngle : p.angle) + data.val;
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

// 🌟 AI 思考與移動邏輯 (已修復結構)
function updateBots(room) {
    for (let id in room.players) {
        let bot = room.players[id];
        if (!bot.isBot || bot.hp <= 0) continue;

        let target = null;
        let minDist = Infinity;
        for (let eid in room.players) {
            let enemy = room.players[eid];
            if (enemy.team !== bot.team && enemy.hp > 0) {
                let dist = Math.hypot(enemy.x - bot.x, enemy.y - bot.y);
                if (dist < minDist) {
                    minDist = dist;
                    target = enemy;
                }
            }
        }

        if (target) {
            let level = bot.level || 2;

            let dx = target.x - bot.x;
            let dy = target.y - bot.y;
            let targetAngle = Math.atan2(dy, dx) * 180 / Math.PI;

            let diff = ((targetAngle - bot.angle + 540) % 360) - 180;
            let turnSpeed = level === 1 ? 2 : (level === 2 ? 5 : 10);

            if (Math.abs(diff) > turnSpeed) {
                bot.angle += Math.sign(diff) * turnSpeed; 
            } else {
                bot.angle = targetAngle; 
            }

            if (!bot.targetMove || Math.abs(bot.targetMove) < 2) {
                if (level === 1) {
                    if (Math.random() < 0.05) bot.targetMove = 10;
                } else if (level === 2) {
                    if (minDist > 120) bot.targetMove = 15;
                } else if (level === 3) {
                    if (minDist > 200) {
                        bot.targetMove = 20; 
                    } else if (minDist < 120) {
                        bot.targetMove = -15; 
                    }
                }
            }

            let aimTolerance = level === 1 ? 30 : (level === 2 ? 15 : 5);

            if (Math.abs(diff) < aimTolerance && bot.cooldown <= 0) {
                // 🌟 使用 applyCmd 來開火，取代原本不存在的 spawnBullet
                applyCmd(room, { id: bot.id, action: 'fire' });
                bot.cooldown = level === 1 ? 50 : (level === 2 ? 30 : 15);
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

    if (room.active) {
        updateBots(room);
    }

    // 🌟 在這裡處理所有坦克 (玩家+電腦) 的平滑移動與冷卻
    for (const id in room.players) {
        let p = room.players[id];
        if (p.hp <= 0) continue;

        // 扣除冷卻
        if (p.cooldown > 0) p.cooldown--;

        // 處理平滑前進/後退
        if (p.targetMove && Math.abs(p.targetMove) > 0) {
            const stepSize = 4; // 移動速度
            const dir = p.targetMove > 0 ? 1 : -1;
            const step = Math.min(stepSize, Math.abs(p.targetMove));
            
            const rad = p.angle * Math.PI / 180;
            const dx = Math.cos(rad) * step * dir;
            const dy = Math.sin(rad) * step * dir;
            
            if (!checkCol(room.walls, p.x + dx, p.y + dy, TANK_RADIUS)) {
                p.x += dx; 
                p.y += dy;
                p.targetMove -= step * dir;
            } else {
                p.targetMove = 0; // 撞牆停止
            }
        }

        // 處理平滑轉向 (玩家專用，AI已經在 updateBots 內轉好了)
        if (p.targetAngle !== undefined) {
            let diff = p.targetAngle - p.angle;
            if (Math.abs(diff) > 0.5) {
                const turnSpeed = 5;
                const turnStep = Math.min(turnSpeed, Math.abs(diff)) * Math.sign(diff);
                p.angle += turnStep;
            } else {
                p.angle = p.targetAngle;
                p.targetAngle = undefined;
            }
        }
    }

    if (!room.active) {
        io.to(roomId).emit('state', buildState(room));
        return;
    }

    room.timeLeft -= TICK_MS / 1000;
    if (room.timeLeft < 0) room.timeLeft = 0;

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

    if (room.timeLeft <= 0) {
        room.active = false;
        let winner = 'draw';
        if (room.scores.red > room.scores.blue) winner = 'red';
        else if (room.scores.blue > room.scores.red) winner = 'blue';
        io.to(roomId).emit('state', buildState(room, true, winner));
        console.log(`🏁 房間 ${roomId} 結束，勝者: ${winner}`);
        return;
    }

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

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId;
        const room = getRoom(roomId);
        startLoop(roomId);
        socket.emit('map', { walls: room.walls });
        socket.emit('state', buildState(room));
    });

    socket.on('setMap', (data) => {
        const room = getRoom(data.roomId);
        room.walls = data.walls;
        io.to(data.roomId).emit('map', { walls: room.walls });
        console.log(`🗺️  房間 ${data.roomId} 地圖更新`);
    });

    socket.on('startGame', (data) => {
        const room = getRoom(data.roomId);
        room.active = true;
        room.timeLeft = data.timeLimit || 180;
        room.scores = { red: 0, blue: 0 };
        room.bullets = [];
        io.to(data.roomId).emit('state', buildState(room));
        console.log(`🔔 房間 ${data.roomId} 比賽開始`);
    });

    socket.on('resetGame', (data) => {
        const room = getRoom(data.roomId);
        room.active = false;
        room.bullets = [];
        room.scores = { red: 0, blue: 0 };
        room.timeLeft = data.timeLimit || 180;
        for (const id in room.players) {
            const p = room.players[id];
            if (!p.isBot) {
                const s = getSpawn(p.team, p.slot);
                p.x = s.x; p.y = s.y; p.angle = s.a;
            }
            p.hp = 100; p.cooldown = 0; p.targetMove = 0;
        }
        io.to(data.roomId).emit('state', buildState(room));
        io.to(data.roomId).emit('map', { walls: room.walls });
        console.log(`♻️  房間 ${data.roomId} 重置`);
    });

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

    socket.on('cmd', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        applyCmd(room, data);
    });

    socket.on('disconnect', () => {
        console.log('斷線:', socket.id);
        const roomId = socket.roomId;
        const pid = socket.playerId;
        if (roomId && pid && rooms[roomId]) {
            delete rooms[roomId].players[pid];
            io.to(roomId).emit('state', buildState(rooms[roomId]));
        }
    });

    // 🌟 修正後的自由練習模式
    socket.on('joinPractice', (data) => {
        const PR_ID = "practice_room"; 
        const room = getRoom(PR_ID);

        if (!room.active) {
            room.active = true;
            room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            room.timeLeft = 999; 

            // 依照學生選的數量來決定難度
            let aiLevel = data.botCount === 1 ? 1 : (data.botCount === 3 ? 2 : 3);
            
            // 🌟 真正生成 AI 的迴圈
            for (let i = 1; i <= data.botCount; i++) {
                let botId = 'bot_' + i; 
                let botName = '電腦 ' + i;
                const s = getSpawn('red', i); 
                
                room.players[botId] = {
                    id: botId, name: botName, team: 'red', slot: i,
                    x: s.x, y: s.y, angle: s.a,
                    hp: 100, cooldown: 0, 
                    isBot: true, level: aiLevel, targetMove: 0
                };
            }
            console.log(`🤖 練習房啟動，生成 ${data.botCount} 個 AI (等級 ${aiLevel})`);
            startLoop(PR_ID);
        }

        room.players[data.id] = {
            id: data.id, name: data.name,
            team: 'blue', slot: Object.keys(room.players).length,
            x: 100 + (Math.random() * 50), y: 300, angle: 0, 
            hp: 100, cooldown: 0, isBot: false
        };

        socket.playerId = data.id;
        socket.roomId = PR_ID; 

        socket.join(PR_ID);
        socket.emit('map', { walls: room.walls });
        io.to(PR_ID).emit('state', buildState(room));
        console.log(`👤 ${data.name} 加入練習房`);
    });

    socket.on('joinStudentPvP', (data) => {
        const room = getRoom(data.roomId);
        if (!room.active) {
            room.active = true;
            room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            room.timeLeft = 300; 
            room.scores = { red: 0, blue: 0 };
            room.bullets = [];

            console.log(`⚔️ 學生對戰房 [${data.roomId}] 啟動`);
            startLoop(data.roomId); 
        }

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
