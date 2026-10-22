/* ============================================================
指尖菜园 · Finger Garden
p5.js  +  ml5.handPose  +  p5.AudioIn
------------------------------------------------------------
开场页 / 加载页 / 种植页 全部由 p5 绘制
   ============================================================ */
p5.disableFriendlyErrors = true;

/* ---------------- 蔬菜配置 ---------------- */
const VEGGIES = {
    greens: {
    name: '小青菜',
    stemColor: [150, 255, 200],
    leafColor: [120, 240, 170],
    flowerColor: [210, 255, 230],
    fruitColor: [160, 255, 180],
    maxHeight: 165, stemWidth: 7, leafCount: 6, fruitCount: 1,
    needPollinate: false, followLight: false
    },
    sunflower: {
    name: '向日葵',
    stemColor: [160, 255, 190],
    leafColor: [130, 240, 160],
    flowerColor: [255, 228, 120],
    fruitColor: [255, 205, 95],
    maxHeight: 235, stemWidth: 9, leafCount: 5, fruitCount: 1,
    needPollinate: false, followLight: true
    },
    tomato: {
    name: '番茄',
    stemColor: [160, 255, 195],
    leafColor: [125, 240, 165],
    flowerColor: [255, 246, 180],
    fruitColor: [255, 105, 105],
    maxHeight: 200, stemWidth: 8, leafCount: 5, fruitCount: 3,
    needPollinate: true, followLight: false
    }
};

/* ---------------- 全局状态 ---------------- */
let appState = 'intro';        // intro | loading | play

let video = null;
let handPose = null;
let hands = [];
let audioIn = null;
let started = false;

let plant = null;
let particles = [];
let butterflies = [];
let currentKind = 'greens';

let handTips = null;

const view = { scale: 1, ox: 0, oy: 0, dw: 0, dh: 0 };

/* 平滑后的手势状态 */
const G = {
    present: 0, pinch: 0, open: 0, fist: 0,
    x: 0.5, y: 0.5, vx: 0, vy: 0, motion: 0
};

/* 声音 */
let clapPulse = 0;
let lastClapTime = -9999;
let audioLevel = 0;
let audioBase = 0;

/* 开场页 */
let introDots = [];
let introBtn = { x: 0, y: 0, w: 0, h: 0 };
let introHover = false;
let bgGfx = null;



function preload() {
    handPose = ml5.handPose({ maxHands: 1 });
}

function setup() {
    const c = createCanvas(windowWidth, windowHeight);
    c.position(0, 0);
    pixelDensity(1);

    textAlign(CENTER, CENTER);
    textFont('system-ui, "PingFang SC", "Microsoft YaHei", sans-serif');

    buildBackdrop();
    initIntroDots();
    computeView();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    buildBackdrop();
    initIntroDots();
    computeView();
}

/* 摄像头画面以 cover 方式铺满 */
function computeView() {
    const vw = (video && video.elt && video.elt.videoWidth) || 640;
    const vh = (video && video.elt && video.elt.videoHeight) || 480;
    const s = max(width / vw, height / vh);
    view.scale = s;
  view.dw = vw * s;
  view.dh = vh * s;
    view.ox = (width - view.dw) / 2;
    view.oy = (height - view.dh) / 2;
}

/* ============================================================
    主循环
   ============================================================ */
function draw() {
    if (appState === 'intro')   { drawIntro();   return; }
    if (appState === 'loading') { drawLoading(); return; }
    drawPlay();
}

/* ============================================================
    开场页
   ============================================================ */
function buildBackdrop() {
    bgGfx = createGraphics(width, height);
    bgGfx.noStroke();
    const c1 = color(240, 252, 244);
    const c2 = color(196, 231, 209);
    for (let y = 0; y < height; y += 2) {
    bgGfx.fill(lerpColor(c1, c2, y / height));
    bgGfx.rect(0, y, width, 2);
    }
}

function initIntroDots() {
    introDots = [];
  const n = constrain(floor(width * height / 26000), 26, 70);
    for (let i = 0; i < n; i++) {
    introDots.push({
    x: random(width),
    y: random(height),
    r: random(2, 7),
    sp: random(0.12, 0.5),
    a: random(40, 110),
    ph: random(TWO_PI)
    });
}
}

function drawIntro() {
  const t = millis() * 0.001;

    if (bgGfx) image(bgGfx, 0, 0);

  /* --- 漂浮光点 --- */
    noStroke();
    for (const d of introDots) {
    d.y -= d.sp;
    d.x += sin(t * 0.6 + d.ph) * 0.16;
    if (d.y < -14) { d.y = height + 14; d.x = random(width); }
    const a = d.a * (0.55 + 0.45 * sin(t * 1.1 + d.ph));
    fill(120, 198, 152, a);
    circle(d.x, d.y, d.r);
    }

  /* --- 卡片尺寸 --- */
    const s  = constrain(min(width / 1000, height / 780), 0.5, 1.3);
  const cw = min(620 * s, width * 0.92);
  const ch = min(620 * s, height * 0.92);
    const cx = width / 2;
    const cy = height / 2;
    const left = cx - cw / 2;
    const top  = cy - ch / 2;

  /* --- 卡片 --- */
    push();
    noStroke();
    fill(255, 255, 255, 128);
  rect(left, top, cw, ch, 16 * s);
    noFill();
    stroke(86, 168, 110, 205);
  strokeWeight(1.6 * s);
  rect(left, top, cw, ch, 16 * s);
    pop();

  /* --- 标题 --- */
    push();
    noStroke();
    textAlign(CENTER, CENTER);

    fill(28, 92, 52);
  textSize(48 * s);
  text('指 尖 菜 园', cx, top + 92 * s);

  /* --- 副标题 --- */
    fill(66, 128, 88, 225);
  textSize(13.5 * s);
  text('手势与声音，在指间种出一座会生长的菜园', cx, top + 142 * s);

  /* --- 分隔线 --- */
    stroke(120, 190, 145, 120);
    strokeWeight(1);
  line(cx - cw * 0.3, top + 172 * s, cx + cw * 0.3, top + 172 * s);
    noStroke();

  /* --- 手势提示 --- */
    const tips = [
    '🤏  捏合手指 — 播下种子',
    '✋  手掌上抬 — 幼苗破土',
    '🖐  五指张开 — 植株开花',
    '👏  拍手轻响 — 蝴蝶授粉',
    '✊  握拳收拢 — 结出果实'
    ];
    fill(38, 104, 60, 235);
  textSize(14.5 * s);
    for (let i = 0; i < tips.length; i++) {
    text(tips[i], cx, top + 218 * s + i * 40 * s);
    }

  /* --- 按键说明 --- */
    fill(70, 130, 92, 190);
  textSize(11.5 * s);
    text('按键：[1] 小青菜   [2] 向日葵   [3] 番茄   [R] 重来',
       cx, top + 430 * s);

    pop();

  /* --- 开始按钮 --- */
  const bw = 216 * s;
  const bh = 52 * s;
    const bx = cx - bw / 2;
  const by = top + ch - 86 * s - bh / 2;

    introBtn = { x: bx, y: by, w: bw, h: bh };
    introHover = mouseX > bx && mouseX < bx + bw &&
    mouseY > by && mouseY < by + bh;
    document.body.style.cursor = introHover ? 'pointer' : 'default';

    push();
    noStroke();
    drawingContext.shadowBlur = introHover ? 26 : 12;
    drawingContext.shadowColor = 'rgba(110,200,140,0.75)';
    // 方案一：拆成 if / else
    if (introHover) fill(96, 190, 126);
    else fill(126, 208, 152);
    rect(bx, by, bw, bh, bh / 2);
    drawingContext.shadowBlur = 0;

    fill(255, 255, 255, 245);
  textSize(16 * s);
    text('开 始 种 植', cx, by + bh / 2 + 1);
    pop();
}
加载页

function drawLoading() {
    if (bgGfx) image(bgGfx, 0, 0);

  const t = millis() * 0.001;
    noStroke();
    textAlign(CENTER, CENTER);

    fill(30, 96, 54, 235);
    textSize(16);
    text('正在唤醒镜头…', width / 2, height / 2 - 30);

    fill(80, 150, 105, 160);
    textSize(11.5);
    text('请在浏览器提示中允许摄像头与麦克风', width / 2, height / 2 + 54);

    for (let i = 0; i < 8; i++) {
    const a = t * 2.2 + i * TWO_PI / 8;
    fill(96, 190, 126, map(i, 0, 7, 255, 45));
    circle(width / 2 + cos(a) * 22, height / 2 + 22 + sin(a) * 22, 5.5);
    }
}

/* ============================================================
    启动摄像头与麦克风
   ============================================================ */
function beginPlay() {
    if (appState !== 'intro') return;
    appState = 'loading';

  /* 麦克风：失败不影响主流程 */
    try {
    userStartAudio().then(() => {
    try {
        audioIn = new p5.AudioIn();
        audioIn.start();
        started = true;
    } catch (e) {
        console.warn('麦克风启动失败：', e);
    }
    }).catch(err => console.warn('麦克风未启用，仅手势模式：', err));
} catch (e) {
    console.warn('userStartAudio 异常：', e);
}

  /* 摄像头 */
    video = createCapture(VIDEO, () => computeView());
    video.size(640, 480);
    video.hide();

  /* 轮询等待首帧，带兜底 */
    let tries = 0;
    const check = () => {
    tries++;
    const el = video && video.elt;
    const videoReady = el && el.readyState >= 2 && el.videoWidth > 0;

    if (videoReady) {
    computeView();

      /* 手势检测：失败不阻塞进入 play */
    try {
        if (handPose && typeof handPose.detectStart === 'function') {
        handPose.detectStart(el, (results) => { hands = results || []; });
        } else {
        console.warn('handPose 尚未就绪，跳过手势检测');
        }
    } catch (e) {
        console.warn('手势检测启动失败：', e);
    }

    initParticles();
    appState = 'play';
    return;
    }

    if (tries > 200) {           // 约 10 秒兜底
    computeView();
    initParticles();
    appState = 'play';
    return;
    }
    setTimeout(check, 50);
};
check();
}

/* ============================================================
种植页
   ============================================================ */
function drawPlay() {
background(5, 7, 10);

  /* --- 摄像头画面（水平镜像） --- */
if (video && video.elt && video.elt.readyState >= 2) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, view.ox, view.oy, view.dw, view.dh);
    pop();
}

  /* --- 压暗背景，衬托自发光主体 --- */
noStroke();
fill(5, 7, 10, 158);
rect(0, 0, width, height);

  /* --- 识别 --- */
analyzeHand();
analyzeAudio();

  /* --- 粒子 --- */
for (const p of particles) { p.update(); p.render(); }
particles = particles.filter(p => p.age < p.maxLife);

  /* --- 播种 --- */
handleSeeding();

  /* --- 植物 --- */
if (plant) { plant.update(); plant.render(); }

  /* --- 蝴蝶 --- */
for (const b of butterflies) { b.update(); b.render(); }

drawHandOverlay();
drawHUD();
}

/* ============================================================
手势识别
   ============================================================ */
function videoToScreen(kp) {
const s = view.scale;
  const x = view.ox + kp.x * s;
  const y = view.oy + kp.y * s;
  return { x: width - x, y: y };     // 视频已镜像，x 需翻转
}

function analyzeHand() {
const tp = { present: 0, pinch: 0, open: 0, fist: 0, x: G.x, y: G.y };
handTips = null;

if (hands.length > 0 && hands[0].keypoints && hands[0].keypoints.length >= 21) {
    const kp = hands[0].keypoints;
    handTips = kp.map(k => videoToScreen(k));

    const wrist = kp[0];
    const midMcp = kp[9];
    const hs = max(1, dist(wrist.x, wrist.y, midMcp.x, midMcp.y));

    /* 捏合程度：拇指尖(4) ↔ 食指尖(8)，按手掌尺寸归一化 */
    const pinchRatio = dist(kp[4].x, kp[4].y, kp[8].x, kp[8].y) / hs;

    /* 手指伸展计数 */
    let ext = 0;
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < 4; i++) {
    const dTip = dist(kp[tips[i]].x, kp[tips[i]].y, wrist.x, wrist.y);
    const dPip = dist(kp[pips[i]].x, kp[pips[i]].y, wrist.x, wrist.y);
      if (dTip > dPip * 1.22) ext++;
    }
    const dThumbTip = dist(kp[4].x, kp[4].y, wrist.x, wrist.y);
    const dThumbMcp = dist(kp[2].x, kp[2].y, wrist.x, wrist.y);
    if (dThumbTip > dThumbMcp * 1.35) ext++;

    /* 食指是否伸出（区分「捏合」与「握拳」） */
    const indexOut = dist(kp[8].x, kp[8].y, wrist.x, wrist.y) >
                     dist(kp[6].x, kp[6].y, wrist.x, wrist.y) * 1.18;

    const sp = videoToScreen(wrist);
    tp.present = 1;
    tp.x = sp.x / width;
    tp.y = sp.y / height;

    tp.pinch = (pinchRatio < 0.5 && indexOut) ? 1 : 0;
    tp.open  = (ext >= 4) ? 1 : 0;
    tp.fist  = (ext <= 1 && !indexOut) ? 1 : 0;
}

  /* 平滑插值，避免跳变 */
G.present = lerp(G.present, tp.present, 0.28);
G.pinch   = lerp(G.pinch,   tp.pinch,   0.40);
G.open    = lerp(G.open,    tp.open,    0.32);
G.fist    = lerp(G.fist,    tp.fist,    0.40);

const prevX = G.x, prevY = G.y;
G.x = lerp(G.x, tp.x, 0.22);
G.y = lerp(G.y, tp.y, 0.22);
G.vx = G.x - prevX;
G.vy = G.y - prevY;
  G.motion = lerp(G.motion, constrain(abs(G.vx) * 22, 0, 1), 0.25);
}

/* ============================================================
声音识别（拍手）
   ============================================================ */
function analyzeAudio() {
clapPulse = 0;
if (!started || !audioIn) return;

audioLevel = audioIn.getLevel();
audioBase = lerp(audioBase, audioLevel, 0.02);

const ratio = audioLevel / (audioBase + 0.004);
if (ratio > 2.4 && audioLevel > 0.08 && millis() - lastClapTime > 550) {
    lastClapTime = millis();
    clapPulse = 1;

    for (let i = 0; i < 18; i++) {
    const a = random(TWO_PI), d = random(30, 140);
    particles.push(new Particle(
        width * 0.5 + cos(a) * d,
        height * 0.45 + sin(a) * d,
        false
    ));
    }
}
}

/* ============================================================
播种
   ============================================================ */
function handleSeeding() {
if (plant) return;
if (G.pinch > 0.65 && G.present > 0.5) {
    const sx = constrain(G.x * width, width * 0.15, width * 0.85);
    const sy = constrain(G.y * height, height * 0.48, height * 0.9);
    plant = new Plant(currentKind, sx, sy);

    for (let i = 0; i < 20; i++) {
    const a = random(TWO_PI), d = random(6, 34);
      particles.push(new Particle(sx + cos(a) * d, sy + sin(a) * d, false));
    }
}
}

/* ============================================================
发光绘制辅助
   ============================================================ */
function glow(c, blur) {
drawingContext.shadowBlur = blur;
drawingContext.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
}
function noGlow() {
drawingContext.shadowBlur = 0;
}

/* ============================================================
手部骨架叠层
   ============================================================ */
function drawHandOverlay() {
if (!handTips) return;

push();
noFill();
stroke(150, 255, 200, 55);
strokeWeight(1);
for (const t of handTips) circle(t.x, t.y, 4);

const tip = handTips[8];
noStroke();
fill(190, 255, 220, 85);
circle(tip.x, tip.y, 14);
pop();
}

/* ============================================================
植物
   ============================================================ */
class Plant {
constructor(kind, x, y) {
    this.kind = kind;
    this.cfg = VEGGIES[kind];
    this.x = x;
    this.y = y;

    this.phase = 1;          // 1生长 2开花 3授粉 4结果 5完成
    this.stem = 0;
    this.bloom = 0;
    this.fruit = 0;
    this.pollinated = false;
    this.headAngle = 0;
    this.seedPhase = random(TWO_PI);

    this.leaves = [];
    const n = this.cfg.leafCount;
    for (let i = 0; i < n; i++) {
    this.leaves.push({
        p: 0.16 + (i / n) * 0.66,
        side: i % 2 === 0 ? 1 : -1,
        s: random(0.78, 1.15)
    });
    }

    this.fruits = [];
    const m = this.cfg.fruitCount;
    for (let i = 0; i < m; i++) {
    this.fruits.push({
        p: m === 1 ? 0.78 : 0.55 + i * 0.15,
        side: i % 2 === 0 ? 1 : -1,
        s: random(0.85, 1.15)
    });
    }
}

update() {
    const dt = min(deltaTime, 50) / 1000;

    /* 向日葵：花盘追手 */
    if (this.cfg.followLight && G.present > 0.5) {
      const target = constrain((G.x - 0.5) * 1.5, -0.8, 0.8);
    this.headAngle = lerp(this.headAngle, target, 0.06);
    }

    switch (this.phase) {
      /* 生长：手掌上抬 */
    case 1:
        if (G.open > 0.5 && G.vy < -0.00015) {
        let rate = 0.62;
        if (this.cfg.followLight) {
            rate *= map(G.motion, 0, 1, 0.30, 2.2, true);
        }
          this.stem = min(1, this.stem + rate * dt);
        }
        if (this.stem >= 1) this.phase = 2;
        break;

      /* 开花：五指张开 */
    case 2:
        if (G.open > 0.5) this.bloom = min(1, this.bloom + 0.72 * dt);
        if (this.bloom >= 1) {
        this.phase = this.cfg.needPollinate ? 3 : 4;
        }
        break;

      /* 授粉：拍手 */
    case 3:
        if (clapPulse > 0) {
        this.pollinated = true;
        this.phase = 4;
        this.spawnButterflies();
        }
        break;

      /* 结果：握拳 */
    case 4:
        if (G.fist > 0.5) this.fruit = min(1, this.fruit + 0.62 * dt);
        if (this.fruit >= 1) this.phase = 5;
        break;
    }
}

spawnButterflies() {
    const topX = this.x;
    const topY = this.y - this.cfg.maxHeight * this.stem;
    for (let i = 0; i < 3; i++) {
    butterflies.push(new Butterfly({ x: topX, y: topY }));
    }
}

render() {
    const cfg = this.cfg;
    const t = millis() * 0.001;
    const h = cfg.maxHeight * this.stem;
    const sway = sin(t * 0.75 + this.seedPhase) * 11 * this.stem;

    push();
    translate(this.x, this.y);
    noStroke();

    /* 种子 */
    if (this.stem < 0.05) {
    glow([190, 255, 220], 34);
    fill(210, 255, 230, 240);
      circle(0, -2, 9 + sin(t * 5) * 2.5);
    noGlow();
    }

    /* 茎 */
    const N = 22;
    for (let i = 0; i <= N; i++) {
    const p = i / N;
      const px = sway * p * p;
      const py = -h * p;
      const r = lerp(cfg.stemWidth * 0.5, 1.6, p) * (0.5 + 0.5 * this.stem);
    glow(cfg.stemColor, 20);
    fill(cfg.stemColor[0], cfg.stemColor[1], cfg.stemColor[2], 240);
      circle(px, py, r * 2);
    }
    noGlow();

    /* 叶 */
    for (const L of this.leaves) {
    if (this.stem <= L.p) continue;
    const g = constrain((this.stem - L.p) / 0.2, 0, 1);
    const p = L.p;
      const px = sway * p * p;
      const py = -h * p;
      const len = 52 * L.s * g;
      const wid = 17 * L.s * g;
    if (len < 2) continue;

    push();
    translate(px, py);
      const wobble = sin(t * 1.1 + p * 6) * 0.07;
    rotate(L.side > 0 ? -0.45 + wobble : PI + 0.45 - wobble);
    glow(cfg.leafColor, 16);
    fill(cfg.leafColor[0], cfg.leafColor[1], cfg.leafColor[2], 215);
      ellipse(len * 0.5, 0, len, wid);
    noGlow();
    pop();
    }

    /* 花 / 顶冠 */
    if (this.bloom > 0.02) {
    push();
    translate(sway, -h);
    rotate(this.headAngle);
    this.drawBloom(this.bloom, t);
    pop();
    }

    /* 果 */
    if (this.fruit > 0.02) {
    const f = this.fruit;
    const fc = cfg.fruitColor;
    for (const F of this.fruits) {
        const p = F.p;
        const px = sway * p * p;
        const py = -h * p;
        const r = 15 * F.s * f;
        if (r < 1) continue;

        push();
        translate(px + F.side * 13 * f, py + 10 * f);
        glow(fc, 28);
        fill(fc[0], fc[1], fc[2], 245);
        circle(0, 0, r * 2);
        noGlow();
        fill(255, 255, 255, 130);
        circle(-r * 0.32, -r * 0.34, r * 0.55);
        pop();
    }
    }

    pop();
}

drawBloom(b, t) {
    const cfg = this.cfg;
    const fc = cfg.flowerColor;
    noStroke();

    if (this.kind === 'sunflower') {
    const petals = 18;
    for (let i = 0; i < petals; i++) {
        push();
        rotate(TWO_PI * i / petals + sin(t * 0.6) * 0.015);
        glow(fc, 24);
        fill(fc[0], fc[1], fc[2], 235);
        ellipse(0, -30 * b, 12 * b, 38 * b);
        noGlow();
        pop();
    }
      fill(92, 58, 30, 245);   circle(0, 0, 46 * b);
      fill(150, 100, 55, 245); circle(0, 0, 30 * b);
      fill(70, 44, 22, 245);   circle(0, 0, 14 * b);

    } else if (this.kind === 'tomato') {
    for (let i = 0; i < 5; i++) {
        const a = TWO_PI * i / 5;
        push();
        translate(cos(a) * 22 * b, sin(a) * 14 * b - 6 * b);
        for (let j = 0; j < 5; j++) {
        push();
          rotate(TWO_PI * j / 5 + t * 0.15);
        glow(fc, 14);
        fill(fc[0], fc[1], fc[2], 230);
          ellipse(0, -5 * b, 4.5 * b, 11 * b);
        noGlow();
        pop();
        }
        fill(255, 252, 210, 240);
        circle(0, 0, 5 * b);
        pop();
    }

    } else {
    for (let i = 0; i < 7; i++) {
        const a = map(i, 0, 6, -1.25, 1.25);
        push();
        rotate(a);
        glow(cfg.leafColor, 16);
        fill(cfg.leafColor[0], cfg.leafColor[1], cfg.leafColor[2], 205);
        ellipse(0, -34 * b, 20 * b, 66 * b);
        noGlow();
        pop();
    }
    }
}
}

/* ============================================================
粒子
   ============================================================ */
class Particle {
constructor(x, y, ambient = true) {
    this.x = x;
    this.y = y;
    this.ambient = ambient;
    this.vx = random(-0.28, 0.28);
    this.vy = random(-0.75, -0.15);
    this.size = random(1, 3.4);
    this.alpha = random(45, 135);
    this.phase = random(TWO_PI);
    this.hue = random() > 0.5 ? [255, 230, 160] : [200, 240, 255];
    this.age = 0;
    this.maxLife = ambient ? Infinity : random(0.8, 1.7);
}

update() {
    const dt = min(deltaTime, 50) / 1000;
    this.age += dt;
    this.x += this.vx + sin(millis() * 0.001 + this.phase) * 0.16;
    this.y += this.vy;

    if (this.ambient) {
    if (this.y < -12) { this.y = height + 12; this.x = random(width); }
    if (this.x < -12) this.x = width + 12;
    if (this.x > width + 12) this.x = -12;
    }
}

render() {
    const fade = this.maxLife === Infinity ? 1 : (1 - this.age / this.maxLife);
    if (fade <= 0) return;
    noStroke();
    fill(this.hue[0], this.hue[1], this.hue[2], this.alpha * fade);
    circle(this.x, this.y, this.size);
}
}

function initParticles() {
particles = particles.filter(p => !p.ambient);
for (let i = 0; i < 70; i++) {
    particles.push(new Particle(random(width), random(height), true));
}
}

/* ============================================================
蝴蝶
   ============================================================ */
class Butterfly {
constructor(target) {
    this.x = random(width * 0.1, width * 0.9);
    this.y = random(height * 0.1, height * 0.6);
    this.target = target;
    this.wingPhase = random(TWO_PI);
    this.alpha = 0;
    this.tx = target.x;
    this.ty = target.y;
}

update() {
    const tt = millis() * 0.001;
    this.tx = this.target.x + sin(tt * 1.4 + this.wingPhase) * 62;
    this.ty = this.target.y - 62 + cos(tt * 1.9 + this.wingPhase) * 40;

    this.x = lerp(this.x, this.tx, 0.018);
    this.y = lerp(this.y, this.ty, 0.018);
    this.alpha = lerp(this.alpha, 255, 0.03);
}

render() {
    push();
    translate(this.x, this.y);
    const flap = abs(sin(millis() * 0.012 + this.wingPhase));
    const s = 0.5 + flap * 0.75;
    noStroke();

    glow([255, 200, 255], 22);
    fill(255, 220, 245, this.alpha * 0.85);
    ellipse(-9 * s, 0, 20 * s, 14);
    ellipse( 9 * s, 0, 20 * s, 14);
    noGlow();

    fill(255, 255, 255, this.alpha);
    ellipse(-6 * s, 0, 10 * s, 8);
    ellipse( 6 * s, 0, 10 * s, 8);

    fill(120, 90, 140, this.alpha);
    ellipse(0, 0, 4, 12);
    pop();
}
}

/* ============================================================
HUD
   ============================================================ */
function drawHUD() {
let hint = '';
if (!plant) {
    hint = `🤏 捏合手指，播下 ${VEGGIES[currentKind].name}`;
} else {
    switch (plant.phase) {
        case 1: hint = '✋ 手掌缓缓上抬 — 幼苗破土'; break;
        case 2: hint = '🖐 五指张开 — 让植株绽放'; break;
        case 3: hint = '👏 拍手 — 召唤蝴蝶来授粉'; break;
        case 4: hint = '✊ 握拳 — 采收果实'; break;
        case 5: hint = `🌱 ${VEGGIES[plant.kind].name} 采收完成 · 按 R 再来`; break;
    }
}

noStroke();
textAlign(CENTER, CENTER);

textSize(15);
fill(190, 255, 215, 215);
 text(hint, width / 2, height - 54);

textSize(11);
fill(160, 220, 190, 105);
text(`${VEGGIES[currentKind].name}　[1]小青菜 [2]向日葵 [3]番茄　[R]重来`,
    width / 2, height - 26);

if (started) {
    const w = 90, h = 3;
    const bx = width - w - 22, by = height - 22;
    noStroke();
    fill(255, 255, 255, 22);
    rect(bx, by, w, h, 2);
    fill(150, 255, 200, 160);
    rect(bx, by, w * constrain(audioLevel * 3, 0, 1), h, 2);
}
}

/* ============================================================
交互
   ============================================================ */
function mousePressed() {
    if (appState === 'intro' && introHover) beginPlay();
}

function keyPressed() {
    if (appState !== 'play') return;
    if (key === '1') { currentKind = 'greens';    resetPlant(); }
    if (key === '2') { currentKind = 'sunflower'; resetPlant(); }
    if (key === '3') { currentKind = 'tomato';    resetPlant(); }
    if (key === 'r' || key === 'R') resetPlant();
}

function resetPlant() {
    plant = null;
    butterflies = [];
    particles = particles.filter(p => p.ambient);
}