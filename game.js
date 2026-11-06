const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Ajusta o tamanho imediatamente

const WORLD_SIZE = 3000;
let mapRadius = WORLD_SIZE / 2;
let targetMapRadius = WORLD_SIZE / 2;
let zoneTimer = 0;

let player;
let bots = [];
let bullets = [];
let particles = [];
let isGameActive = true;
let aliveCount = 20;

const botNames = ["Alpha", "Beta", "Zeta", "Vortex", "Shadow", "Neon", "Glitch", "SniperBot", "Matrix", "Quantum", "Apex", "Rogue", "Titan", "Specter", "Hunter", "Void", "Helix", "Cipher", "Blaze"];

class Entity {
    constructor(x, y, isPlayer, name) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 4;
        this.health = 100;
        this.maxHealth = 100;
        this.isPlayer = isPlayer;
        this.name = name;
        this.color = isPlayer ? '#4ade80' : '#ef4444';
        this.angle = 0;
        this.lastShot = 0;
        this.shootCooldown = 250; 
        this.kills = 0;
        
        this.targetX = x;
        this.targetY = y;
        this.aiTimer = 0;
    }

    draw(camX, camY) {
        const screenX = this.x - camX + canvas.width / 2;
        const screenY = this.y - camY + canvas.height / 2;

        if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) return;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.lineTo(-this.radius / 2, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, screenX, screenY - this.radius - 15);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(screenX - 20, screenY - this.radius - 10, 40, 5);
        ctx.fillStyle = this.health > 30 ? '#4ade80' : '#ef4444';
        ctx.fillRect(screenX - 20, screenY - this.radius - 10, (this.health / this.maxHealth) * 40, 5);
    }

    update() {
        let distFromCenter = Math.hypot(this.x, this.y);
        if (distFromCenter > mapRadius) {
            this.health -= 0.2;
            if (this.health <= 0) this.die("A Tempestade");
        }

        if (this.isPlayer) return;

        this.aiTimer--;
        if (this.aiTimer <= 0) {
            let angle = Math.random() * Math.PI * 2;
            let randRadius = Math.random() * mapRadius * 0.8;
            this.targetX = Math.cos(angle) * randRadius;
            this.targetY = Math.sin(angle) * randRadius;
            this.aiTimer = Math.random() * 100 + 50;
        }

        let dx = this.targetX - this.x;
        let dy = this.targetY - this.y;
        let dist = Math.hypot(dx, dy);
        if (dist > 5) {
            this.x += (dx / dist) * (this.speed * 0.8);
            this.y += (dy / dist) * (this.speed * 0.8);
            this.angle = Math.atan2(dy, dx);
        }

        let closestEnemy = null;
        let minDist = 400;

        let targets = [player, ...bots].filter(e => e !== this && e.health > 0);
        for (let t of targets) {
            let d = Math.hypot(t.x - this.x, t.y - this.y);
            if (d < minDist) {
                minDist = d;
                closestEnemy = t;
            }
        }

        if (closestEnemy) {
            this.angle = Math.atan2(closestEnemy.y - this.y, closestEnemy.x - this.x);
            this.shoot();
        }
    }

    shoot() {
        let now = Date.now();
        if (now - this.lastShot > this.shootCooldown) {
            bullets.push({
                x: this.x + Math.cos(this.angle) * this.radius,
                y: this.y + Math.sin(this.angle) * this.radius,
                vx: Math.cos(this.angle) * 12,
                vy: Math.sin(this.angle) * 12,
                owner: this
            });
            this.lastShot = now;
        }
    }

    die(killerName) {
        this.health = 0;
        addKillFeed(killerName, this.name);
        for(let i=0; i<15; i++) {
            particles.push({
                x: this.x, y: this.y,
                vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                radius: Math.random() * 4 + 2, color: this.color, alpha: 1
            });
        }
    }
}

const keys = {};
const mouse = { x: 0, y: 0 };

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => { if(isGameActive) player.shoot(); });

function init() {
    player = new Entity(0, 0, true, "Você (Player)");
    bots = [];
    bullets = [];
    particles = [];
    mapRadius = WORLD_SIZE / 2;
    targetMapRadius = WORLD_SIZE / 2;
    zoneTimer = 0;
    isGameActive = true;

    for (let i = 0; i < 19; i++) {
        let angle = Math.random() * Math.PI * 2;
        let r = Math.random() * (mapRadius - 100);
        bots.push(new Entity(Math.cos(angle) * r, Math.sin(angle) * r, false, botNames[i] || `Bot_${i}`));
    }
    aliveCount = 20;
    document.getElementById('screen-msg').style.display = 'none';
    document.getElementById('kill-count').textContent = '0';
}

function addKillFeed(killer, victim) {
    const feed = document.getElementById('kill-feed');
    const msg = document.createElement('div');
    msg.className = 'feed-msg';
    msg.innerHTML = `<span style="color:#ef4444">${killer}</span> eliminou <span style="color:#3b82f6">${victim}</span>`;
    feed.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
}

function checkGameOver(title, sub) {
    isGameActive = false;
    document.getElementById('msg-title').textContent = title;
    document.getElementById('msg-sub').textContent = sub;
    document.getElementById('screen-msg').style.display = 'block';
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isGameActive) {
        if (keys['w'] || keys['arrowup']) player.y -= player.speed;
        if (keys['s'] || keys['arrowdown']) player.y += player.speed;
        if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
        if (keys['d'] || keys['arrowright']) player.x += player.speed;

        let dx = mouse.x - canvas.width / 2;
        let dy = mouse.y - canvas.height / 2;
        player.angle = Math.atan2(dy, dx);
        player.update();
    }

    let camX = player.x;
    let camY = player.y;

    zoneTimer++;
    if (zoneTimer > 500) {
        targetMapRadius = Math.max(150, targetMapRadius - 150);
        zoneTimer = 0;
    }
    mapRadius += (targetMapRadius - mapRadius) * 0.01;

    ctx.save();
    ctx.translate(-camX + canvas.width / 2, -camY + canvas.height / 2);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    let gridSize = 100;
    for (let x = -WORLD_SIZE; x <= WORLD_SIZE; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, -WORLD_SIZE); ctx.lineTo(x, WORLD_SIZE); ctx.stroke();
    }
    for (let y = -WORLD_SIZE; y <= WORLD_SIZE; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(-WORLD_SIZE, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, mapRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        let bScreenX = b.x - camX + canvas.width / 2;
        let bScreenY = b.y - camY + canvas.height / 2;
        ctx.fillStyle = b.owner.isPlayer ? '#4ade80' : '#ef4444';
        ctx.beginPath();
        ctx.arc(bScreenX, bScreenY, 4, 0, Math.PI * 2);
        ctx.fill();

        let targets = [player, ...bots].filter(e => e.health > 0 && e !== b.owner);
        let hit = false;
        for (let t of targets) {
            if (Math.hypot(b.x - t.x, b.y - t.y) < t.radius) {
                t.health -= 15;
                hit = true;
                if (t.health <= 0) {
                    t.die(b.owner.name);
                    b.owner.kills++;
                    if (b.owner.isPlayer) document.getElementById('kill-count').textContent = player.kills;
                }
                break;
            }
        }

        if (hit || Math.hypot(b.x - b.owner.x, b.y - b.owner.y) > 800) {
            bullets.splice(i, 1);
        }
    }

    bots = bots.filter(b => b.health > 0);
    for (let bot of bots) {
        bot.update();
        bot.draw(camX, camY);
    }

    if (player.health > 0) {
        player.draw(camX, camY);
        document.getElementById('health-val').textContent = Math.max(0, Math.ceil(player.health));
    } else if (isGameActive) {
        checkGameOver("GAME OVER", `Você ficou em #${aliveCount} lugar.`);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x - camX + canvas.width/2, p.y - camY + canvas.height/2, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    aliveCount = (player.health > 0 ? 1 : 0) + bots.length;
    document.getElementById('alive-count').textContent = aliveCount;
