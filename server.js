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
const CANVAS_W = 800;
const CANVAS_H = 600;
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
let PRESET_MAPS = {
    'map1': [
      {
        "x": 400,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🪨"
      },
      {
        "x": 360,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🪨"
      },
      {
        "x": 440,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 440,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 440,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 320,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 320,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 320,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 160,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 200,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 200,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 160,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 560,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 600,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 600,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 560,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 600,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 600,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 560,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 560,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 160,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 200,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 200,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 160,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 200,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 160,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 560,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 600,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 480,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 120,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 80,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 360,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      },
      {
        "x": 400,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🌲"
      }
    ],
    'map2': [
      {
        "x": 440,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 480,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 320,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 280,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 160,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 200,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 200,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 360,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 400,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 240,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 280,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 320,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 440,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 480,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 440,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 400,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 520,
        "y": 360,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 360,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 400,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 400,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 360,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 200,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 360,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 200,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 240,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 280,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 320,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 360,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 640,
        "y": 400,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 120,
        "y": 400,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 600,
        "y": 560,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 600,
        "y": 520,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 160,
        "y": 520,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 160,
        "y": 560,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 200,
        "y": 560,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 560,
        "y": 560,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 160,
        "y": 0,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 160,
        "y": 40,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 200,
        "y": 0,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 600,
        "y": 0,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 600,
        "y": 40,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      },
      {
        "x": 560,
        "y": 40,
        "w": 40,
        "h": 40,
        "emoji": "🧱"
      }
    ]
};
//===========================================================
//  🌟 新增：從 GitHub 載入外部地圖的函數
// ============================================================
async function loadExternalMaps() {
    try {
        // 請將以下網址替換為您的 GitHub Raw 連結
        const url = 'https://raw.githubusercontent.com/teachthinking/tank_maps/refs/heads/main/maps.json?t=' + Date.now();

        console.log('⏳ 正在從 GitHub 載入外部地圖...');
        const response = await fetch(url);

        if (response.ok) {
            const externalMaps = await response.json();

            PRESET_MAPS = { ...PRESET_MAPS, ...externalMaps };

            console.log(`✅ 成功載入外部地圖！目前共有 ${Object.keys(PRESET_MAPS).length} 張地圖。`);
        } else {
            console.error(`⚠️ 讀取外部地圖失敗 (狀態碼: ${response.status})，將繼續使用本地預設地圖。`);
        }
    } catch (error) {
        console.error('🚨 載入外部地圖時發生網路錯誤:', error.message);
    }
}

// 啟動伺服器前，呼叫載入函數
loadExternalMaps();
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

// 🌟 修正：Class 與 PvP 模式的固定出生點 (配合 800x600 畫布)
function getSpawn(team, slot) {
    // 依據位置 (slot 1~3) 分布在上、中、下
    let y = 300; // 預設中間
    if (slot == 1) y = 100;
    else if (slot == 2) y = 300;
    else if (slot == 3) y = 500;
    else if (slot == 4) y = 200; // 給第4名以後的備用位置
    else if (slot == 5) y = 400;

    // 紅隊在最左側 (X=50)，藍隊在最右側 (X=750)
    return team === 'red' ? { x: 50, y, a: 0 } : { x: 750, y, a: 180 };
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
    } else if (data.action === 'setAngle') {
        // 直接設定絕對朝向角度，一次到位不逐格轉
        p.angle = ((data.val % 360) + 360) % 360;
        p.targetAngle = undefined;
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

            // ==========================================
            // 🌟 1. 瞄準系統：加入「避障狀態」
            // ==========================================
            if (!bot.evadeTimer) bot.evadeTimer = 0; // 初始化防呆
            if (bot.evadeTimer > 0) {
                // 撞牆了！暫時不要管玩家，專心倒車並轉動方向盤
                bot.evadeTimer--;
                bot.angle += 5; // 邊退邊轉彎，尋找新出路
            } else {
                // 正常情況：死盯著玩家瞄準
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
            }

            // ==========================================
            // 🧠 2. 大腦決定步伐
            // ==========================================
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

            // ==========================================
            // 🦵 3. 雙腿執行與碰撞偵測
            // ==========================================
            if (bot.targetMove && Math.abs(bot.targetMove) > 0) {
                let speed = 2;
                let step = Math.sign(bot.targetMove) * Math.min(speed, Math.abs(bot.targetMove));

                let rad = bot.angle * (Math.PI / 180);
                let oldX = bot.x;
                let oldY = bot.y;

                bot.x += Math.cos(rad) * step;
                bot.y += Math.sin(rad) * step;

                let hitWall = false;
                let radius = TANK_RADIUS;
                let mapWidth = CANVAS_W;
                let mapHeight = CANVAS_H;

                // 🗺️ 邊界檢查
                if (bot.x - radius < 0 || bot.x + radius > mapWidth ||
                    bot.y - radius < 0 || bot.y + radius > mapHeight) {
                    hitWall = true;
                }

                // 🔍 關鍵修正：智慧尋找牆壁陣列 (防止穿牆)
                let currentWalls = room.walls;
                if (!currentWalls && typeof walls !== 'undefined') currentWalls = walls; // 去全域變數找
                if (!currentWalls) currentWalls = []; // 如果真的沒有牆，就給空陣列防呆

                // 🧱 內部障礙物檢查
                if (!hitWall && currentWalls.length > 0) {
                    for (let w of currentWalls) {
                        if (bot.x + radius > w.x && bot.x - radius < w.x + w.w &&
                            bot.y + radius > w.y && bot.y - radius < w.y + w.h) {
                            hitWall = true;
                            break;
                        }
                    }
                }

                // 💥 撞擊應對機制
                if (hitWall) {
                    bot.x = oldX;
                    bot.y = oldY;

                    // 如果是往前走撞到，就強迫倒車；如果是倒車撞到，就往前開
                    bot.targetMove = bot.targetMove > 0 ? -40 : 40;

                    // 🌟 啟動避障狀態：接下來 20 個 frame 不要瞄準玩家，專心脫困！
                    bot.evadeTimer = 20;
                } else {
                    bot.targetMove -= step;
                }
            }

            // ==========================================
            // 🔥 4. 開火邏輯
            // ==========================================
            let aimTolerance = level === 1 ? 30 : (level === 2 ? 15 : 5);
            // 只有在非避障狀態，且角度對準時才開火
            let diffForFire = target ? (((Math.atan2(target.y - bot.y, target.x - bot.x) * 180 / Math.PI) - bot.angle + 540) % 360) - 180 : 999;

            if (Math.abs(diffForFire) < aimTolerance && bot.cooldown <= 0 && (!bot.evadeTimer || bot.evadeTimer <= 0)) {
                applyCmd(room, { id: bot.id, action: 'fire' });
                bot.cooldown = level === 1 ? 50 : (level === 2 ? 30 : 15);
            }
        }
    }
}

// 🌟 新增：產生隨機且不會卡在牆壁內的安全出生點
function getSafeRandomSpawn(walls) {
    let rx, ry;
    let isSafe = false;
    let attempts = 0;

    // 嘗試 50 次找尋空白地點 (假設 TANK_RADIUS 約為 20，我們留 50 的安全邊界)
    while (!isSafe && attempts < 50) {
        rx = 50 + Math.random() * (CANVAS_W - 100);
        ry = 50 + Math.random() * (CANVAS_H - 100);

        // 利用您寫好的 checkCol 檢查是否撞牆
        if (!checkCol(walls, rx, ry, 20)) {
            isSafe = true;
        }
        attempts++;
    }

    // 如果地圖太滿真的找不到，就給個預設防呆值
    if (!isSafe) { rx = 100; ry = 100; }

    // 回傳座標與隨機朝向 (0~360度)
    return { x: rx, y: ry, a: Math.random() * 360 };
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

        // AI 的移動已在 updateBots 內完成，這裡只處理真人玩家
        if (p.isBot) continue;

        // 處理平滑前進/後退 (真人玩家)
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
        // 遊戲已結束，不再廣播避免蓋掉前端勝負畫面
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

                            // 🌟 判斷：如果是 AI 給隨機點，如果是玩家則回到固定出生點
                            let s;
                            if (pp.isBot) {
                                s = getSafeRandomSpawn(r2.walls);
                            } else {
                                s = getSpawn(pp.team, pp.slot);
                            }

                            pp.x = s.x; pp.y = s.y; pp.angle = s.a; pp.hp = 100;
                            if (pp.isBot) pp.targetAngle = s.a; // 同步 AI 角度

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
        // 🌟 確保玩家確實有在房間內
        const roomId = socket.roomId;
        const playerId = socket.playerId;
        if (!roomId || !playerId) return;

        const room = rooms[roomId];
        if (!room || !room.active) return;

        // 🌟 1. 取得該名玩家的物件
        const player = room.players[playerId];
        if (!player || player.hp <= 0) return;

        // ==========================================
        // 🛡️ 防護一：頻率限制 (Rate Limiting)
        // ==========================================
        const now = Date.now();
        const lastKey = 'lastCmd_' + data.action;
        if (now - (player[lastKey] || 0) < 10) return;
        player[lastKey] = now;

        // ==========================================
        // 🛡️ 防護二：數值箝制 (Clamping) 避免超速外掛
        // ==========================================
        let val = Number(data.val);
        if (isNaN(val)) val = 0;

        // 根據不同動作，限制最大值與最小值 (數值可依你的遊戲平衡調整)
        if (data.action === 'move') {
            val = Math.max(-1000, Math.min(1000, val));
        } else if (data.action === 'turn') {
            val = Math.max(-360, Math.min(360, val));
        } else if (data.action === 'setAngle') {
            val = ((val % 360) + 360) % 360; // 正規化到 0~360
        }

        // ==========================================
        // ⚔️ 執行指令
        // ==========================================
        // 強制覆寫 ID 與過濾後的安全數值，確保套用到正確的玩家身上
        data.id = playerId;
        data.val = val;

        applyCmd(room, data);
    });

    socket.on('disconnect', () => {
        console.log('斷線:', socket.id);
        const roomId = socket.roomId;
        const pid = socket.playerId;

        if (roomId && pid && rooms[roomId]) {
            // 1. 移除斷線的玩家
            delete rooms[roomId].players[pid];

            // 2. 🌟 檢查房間裡是否還有「真人玩家」 (過濾掉 isBot)
            let hasRealPlayer = false;
            for (let id in rooms[roomId].players) {
                if (!rooms[roomId].players[id].isBot) {
                    hasRealPlayer = true;
                    break;
                }
            }

            // 3. 🌟 如果沒有真人玩家了 (只剩 AI 或全空)，就關閉並刪除這個房間
            if (!hasRealPlayer) {
                clearInterval(rooms[roomId].loopHandle); // 停止物理迴圈
                delete rooms[roomId];                    // 釋放記憶體
                console.log(`🗑️ 房間 ${roomId} 已無玩家，關閉並回收資源`);
            } else {
                // 如果還有其他真人，只廣播有人離開
                io.to(roomId).emit('state', buildState(rooms[roomId]));
            }
        }
    });

    // 🌟 修正後的個人專屬練習模式
    socket.on('joinPractice', (data) => {
        // 1. 使用玩家的 ID 當作專屬房間名稱，確保每次 F5 都是全新的環境
        // (假設每次 F5 前端都會產生新的 data.id)
        const PR_ID = "practice_" + data.id;
        const room = getRoom(PR_ID);

        // 2. 🌟 強制重置房間狀態 (避免 F5 後舊物件殘留)
        room.players = {}; // 清空所有舊玩家與舊 AI
        room.bullets = []; // 清空舊子彈
        room.active = true;
        room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
        room.timeLeft = 999;

        // 依照學生選的數量來決定難度
        let aiLevel = data.botCount === 1 ? 1 : (data.botCount === 3 ? 2 : 3);

        // 3. 🌟 生成全新且隨機的 AI
        for (let i = 1; i <= data.botCount; i++) {
            let botId = 'bot_' + Math.random().toString(36).substr(2, 6);
            let botName = '電腦_' + Math.floor(Math.random() * 1000);

            // 使用我們剛寫好的隨機點函數
            const s = getSafeRandomSpawn(room.walls);

            room.players[botId] = {
                id: botId, name: botName, team: 'red', slot: i,
                x: s.x, y: s.y, angle: s.a, targetAngle: s.a,
                hp: 100, cooldown: 0,
                isBot: true, level: aiLevel, targetMove: 0
            };
        }
        console.log(`🤖 專屬練習房 [${PR_ID}] 啟動，生成 ${data.botCount} 個 AI (等級 ${aiLevel})`);

        // 啟動物理迴圈
        startLoop(PR_ID);

// 4. 加入玩家自己
        // 🌟 修正：練習模式的玩家也要使用「安全隨機點」出生，不能寫死座標
        const playerSpawn = getSafeRandomSpawn(room.walls);
        
        room.players[data.id] = {
            id: data.id, name: data.name,
            team: 'blue', slot: Object.keys(room.players).length,
            x: playerSpawn.x,           // ✅ 使用隨機安全 X
            y: playerSpawn.y,           // ✅ 使用隨機安全 Y
            angle: playerSpawn.a,       // ✅ 隨機面朝方向
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
        // 1. 房間初始化
        if (!room.active) {
            room.active = true;
            // 確保每次新開房，玩家清單都是乾淨的
            room.players = {};
            
            // ✅ 修正：先檢查房間是不是「還沒有牆壁」。
            // 如果老師已經預先設定好地圖 (room.walls 有東西)，就保留老師的，不覆蓋！
            if (!room.walls || room.walls.length === 0) {
                room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            }
            
            room.timeLeft = 360;
            room.scores = { red: 0, blue: 0 };
            room.bullets = [];
            console.log(`⚔️ 學生對戰房 [${data.roomId}] 初始化`);

            startLoop(data.roomId);
        }

        // 2. ⚠️ 防呆檢查：如果 ID 重複，拒絕加入或給予新 ID
        if (room.players[data.id]) {
            console.log(`🚨 警告：玩家 ID [${data.id}] 重複或已存在房內！`);

        }

        // 3. 玩家資料建立
        const s = getSpawn(data.team, data.slot);
        room.players[data.id] = {
            id: data.id,
            name: data.name,
            team: data.team,
            slot: data.slot,
            x: s.x,
            y: s.y,
            angle: s.a,
            hp: 100,
            cooldown: 0,
            isBot: false
        };

        socket.playerId = data.id;
        socket.roomId = data.roomId;

        socket.join(data.roomId);
        socket.emit('map', { walls: room.walls });
        io.to(data.roomId).emit('state', buildState(room));

        // 4. 📊 統計目前人數
        const playerCount = Object.values(room.players).filter(p => !p.isBot).length;
        console.log(`👤 ${data.name} 加入 PvP 房 [${data.roomId}]。目前房內有 ${playerCount} 名真人。`);
    });

    socket.on('joinCoop', (data) => {
        const room = getRoom(data.roomId);

        // 1. 房間初始化與機器人生成
        if (!room.active) {
            room.active = true;
            room.players = {}; // 確保乾淨的房間
            room.walls = JSON.parse(JSON.stringify(PRESET_MAPS[data.mapId] || []));
            room.timeLeft = 300;
            room.scores = { red: 0, blue: 0 };
            room.bullets = [];

            let botCount = data.botCount || 5;
            for (let i = 1; i <= botCount; i++) {
                let botId = 'bot_' + Math.random().toString(36).substr(2, 6);
                let botName = '電腦_' + Math.floor(Math.random() * 1000);
                const s = getSafeRandomSpawn(room.walls);
                room.players[botId] = {
                    id: botId,
                    name: botName,
                    team: 'red',
                    slot: i,
                    x: s.x,
                    y: s.y,
                    angle: s.a,
                    targetAngle: s.a,
                    hp: 100,
                    cooldown: 0,
                    isBot: true,
                    level: 2,
                    targetMove: 0
                };
            }
            console.log(`🤝 合作房 [${data.roomId}] 創立，生成 ${botCount} 個 AI`);
            startLoop(data.roomId);
        }

        // 2. ⚠️ 防呆檢查
        if (room.players[data.id]) {
            console.log(`🚨 警告：玩家 ID [${data.id}] 重複！`);
        }

        // 3. 真人玩家資料建立
        const s = getSafeRandomSpawn(room.walls);
        room.players[data.id] = {
            id: data.id,
            name: data.name,
            team: 'blue',
            // 💡 這裡的小問題：如果有人中途退出再加入，Object.keys 的長度可能會導致 slot 號碼重複。
            // 建議改為一個亂數，或是直接讓伺服器分配遞增的號碼
            slot: Object.keys(room.players).length,
            x: s.x,
            y: s.y,
            angle: s.a,
            targetAngle: s.a,
            hp: 100,
            cooldown: 0,
            isBot: false
        };

        socket.playerId = data.id;
        socket.roomId = data.roomId;

        socket.join(data.roomId);
        socket.emit('map', { walls: room.walls });
        io.to(data.roomId).emit('state', buildState(room));

        // 4. 📊 統計目前人數
        const playerCount = Object.values(room.players).filter(p => !p.isBot).length;
        console.log(`👤 ${data.name} 加入合作房 [${data.roomId}]。目前房內有 ${playerCount} 名真人。`);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`✅ 伺服器已成功啟動，正在監聽 Port: ${PORT}`);
});
