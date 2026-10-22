let video;
let handpose;
let predictions = [];

let hintDiv;
let modelReady = false;

let mic;
let fft;
let lastLevel = 0;
let clapCooldown = 0;

let garden;
let particles = [];
let petals = [];
let butterfly;

let lastPinchTime = 0;
let gestureText = "等待手掌进入画面";

const STAGE = {
  EMPTY: 0,
  SEED: 1,
  GROWING: 2,
  BLOOM: 3,
  POLLINATED: 4,
  FRUIT: 5
};

let harvestCount = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  hintDiv = select("#hint");

  video = createCapture({
    video: {
      width: 640,
      height: 480,
      facingMode: "user"
    },
    audio: false
  });

  video.size(640, 480);
  video.hide();

  handpose = ml5.handpose(video, () => {
    modelReady = true;
    console.log("HandPose model ready");
  });

  handpose.on("predict", results => {
    predictions = results;
  });

  mic = new p5.AudioIn();
  mic.start();

  fft = new p5.FFT(0.8, 256);
  fft.setInput(mic);

  garden = new GardenPlant();
  butterfly = new Butterfly();

  for (let i = 0; i < 90; i++) {
    particles.push(new GlowParticle());
  }

  for (let i = 0; i < 18; i++) {
    petals.push(new FloatingPetal());
  }
}

function draw() {
  drawCameraBackground();
  drawDarkStageOverlay();

  const hand = getMainHand();
  const gestures = analyzeHand(hand);

  handleStateMachine(gestures, hand);
  detectClap();

  updateAmbientParticles();

  garden.update();
  garden.display();

  butterfly.update(garden);
  butterfly.display();

  displayHarvestBook();
  displayGestureDebug(gestures);

  updateDynamicHint(gestures);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  video.size(width, height);
}

/* -------------------------------------------------------
    摄像头与舞台背景
------------------------------------------------------- */

function drawCameraBackground() {
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
}

function drawDarkStageOverlay() {
  noStroke();

  // 深色半透明压暗，使植物自发光突出
  fill(3, 9, 12, 120);
  rect(0, 0, width, height);

  // 中心墨绿色舞台感
  let cx = width * 0.5;
  let cy = height * 0.55;

  for (let r = 900; r > 0; r -= 24) {
    let a = map(r, 900, 0, 0, 52);
    fill(15, 54, 43, a);
    ellipse(cx, cy, r * 1.45, r);
  }

  // 暗角
  for (let r = 0; r < 280; r += 8) {
    noFill();
    stroke(0, 0, 0, map(r, 0, 280, 0, 95));
    strokeWeight(8);
    rect(r * -0.5, r * -0.5, width + r, height + r);
  }
}

/* -------------------------------------------------------
    手势识别
------------------------------------------------------- */

function getMainHand() {
  if (!predictions || predictions.length === 0) return null;
  return predictions[0];
}

function mirroredPoint(p) {
  // ml5 handpose landmark: [x, y, z]
  return createVector(width - p[0], p[1]);
}

function analyzeHand(hand) {
  if (!hand) {
    gestureText = "等待手掌进入画面";
    return {
      hasHand: false,
      pinch: false,
      openPalm: false,
      fist: false,
      palmUpHigh: false,
      palmPos: createVector(width / 2, height * 0.65),
      pinchPos: createVector(width / 2, height * 0.65),
      growthIntent: 0
    };
  }

  const lm = hand.landmarks;

  const wrist = mirroredPoint(lm[0]);
  const thumbTip = mirroredPoint(lm[4]);
  const indexTip = mirroredPoint(lm[8]);
  const middleTip = mirroredPoint(lm[12]);
  const ringTip = mirroredPoint(lm[16]);
  const pinkyTip = mirroredPoint(lm[20]);

  const indexMcp = mirroredPoint(lm[5]);
  const middleMcp = mirroredPoint(lm[9]);
  const ringMcp = mirroredPoint(lm[13]);
  const pinkyMcp = mirroredPoint(lm[17]);

  const palmPos = createVector(
    (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5,
    (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5
  );

  const pinchDist = p5.Vector.dist(thumbTip, indexTip);
  const handScale = max(60, p5.Vector.dist(wrist, middleMcp) * 2.2);

  const pinch = pinchDist < handScale * 0.28;

  const tips = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
  const avgTipDist = tips.reduce((sum, p) => sum + p5.Vector.dist(p, palmPos), 0) / tips.length;

  const fingerSpread =
    p5.Vector.dist(indexTip, middleTip) +
    p5.Vector.dist(middleTip, ringTip) +
    p5.Vector.dist(ringTip, pinkyTip);

  const openPalm =
    avgTipDist > handScale * 0.72 &&
    fingerSpread > handScale * 0.75 &&
    !pinch;

  const fist =
    avgTipDist < handScale * 0.58 &&
    p5.Vector.dist(indexTip, palmPos) < handScale * 0.65 &&
    p5.Vector.dist(middleTip, palmPos) < handScale * 0.65 &&
    p5.Vector.dist(ringTip, palmPos) < handScale * 0.65 &&
    p5.Vector.dist(pinkyTip, palmPos) < handScale * 0.65 &&
    !openPalm;

  const palmUpHigh = palmPos.y < height * 0.58;

  // 手越高，生长目标越大
  const growthIntent = constrain(map(palmPos.y, height * 0.75, height * 0.18, 0, 1), 0, 1);

  let nowGesture = "";
  if (pinch) nowGesture = "🤏 捏合";
  else if (openPalm) nowGesture = "🖐 五指张开";
  else if (fist) nowGesture = "✊ 握拳";
  else if (palmUpHigh) nowGesture = "✋ 手掌抬高";
  else nowGesture = "手掌已识别";

  gestureText = nowGesture;

  return {
    hasHand: true,
    pinch,
    openPalm,
    fist,
    palmUpHigh,
    palmPos,
    pinchPos: p5.Vector.lerp(thumbTip, indexTip, 0.5),
    growthIntent
  };
}

/* -------------------------------------------------------
    状态机
------------------------------------------------------- */

function handleStateMachine(g, hand) {
  const now = millis();

  // 再次捏合：清空并重新播种
  if (g.pinch && now - lastPinchTime > 1100) {
    garden.resetToSeed(g.pinchPos.x, g.pinchPos.y);
    butterfly.reset();
    burst(g.pinchPos.x, g.pinchPos.y, color(180, 255, 210), 28);
    lastPinchTime = now;
    return;
  }

  if (garden.stage === STAGE.SEED || garden.stage === STAGE.GROWING) {
    if (g.palmUpHigh) {
      garden.stage = STAGE.GROWING;
      garden.baseX = lerp(garden.baseX, g.palmPos.x, 0.025);
      garden.targetGrowth = max(garden.targetGrowth, g.growthIntent);
    }
  }

  if (garden.stage === STAGE.GROWING) {
    if (garden.growth > 0.82 && g.openPalm) {
      garden.stage = STAGE.BLOOM;
      garden.targetBloom = 1;
      burst(garden.flowerX(), garden.flowerY(), color(255, 210, 235), 40);
    }
  }

  if (garden.stage === STAGE.BLOOM || garden.stage === STAGE.POLLINATED) {
    if (g.openPalm) {
      garden.targetBloom = 1;
    }
  }

  if (garden.stage === STAGE.POLLINATED && g.fist) {
    garden.stage = STAGE.FRUIT;
    garden.targetFruit = 1;
    garden.targetBloom = 0;
    harvestCount++;
    burst(garden.flowerX(), garden.flowerY(), color(255, 120, 86), 52);
  }

  // 未授粉握拳不结果，仅轻微反馈
  if (garden.stage === STAGE.BLOOM && g.fist) {
    garden.failedPulse = 1;
  }
}

function detectClap() {
  if (!mic) return;

  let level = mic.getLevel();
  let spike = level - lastLevel;

  clapCooldown = max(0, clapCooldown - deltaTime);

  if (level > 0.16 && spike > 0.055 && clapCooldown <= 0) {
    if (garden.stage === STAGE.BLOOM) {
      garden.stage = STAGE.POLLINATED;
      butterfly.summon(garden.flowerX(), garden.flowerY());
      burst(width * random(0.2, 0.8), height * random(0.25, 0.55), color(255, 245, 190), 35);
    } else if (garden.stage === STAGE.POLLINATED) {
      butterfly.summon(garden.flowerX(), garden.flowerY());
    }

    clapCooldown = 1300;
  }

  lastLevel = lerp(lastLevel, level, 0.35);
}

/* -------------------------------------------------------
    植物系统
------------------------------------------------------- */

class GardenPlant {
  constructor() {
    this.resetAll();
  }

  resetAll() {
    this.stage = STAGE.EMPTY;

    this.baseX = width / 2;
    this.baseY = height * 0.78;

    this.seedX = this.baseX;
    this.seedY = this.baseY;

    this.growth = 0;
    this.targetGrowth = 0;

    this.bloom = 0;
    this.targetBloom = 0;

    this.fruit = 0;
    this.targetFruit = 0;

    this.pollinatedGlow = 0;
    this.failedPulse = 0;

    this.swaySeed = random(1000);
  }

  resetToSeed(x, y) {
    this.stage = STAGE.SEED;

    this.seedX = x;
    this.seedY = y;

    this.baseX = x;
    this.baseY = min(height * 0.84, y + height * 0.18);

    this.growth = 0;
    this.targetGrowth = 0.08;

    this.bloom = 0;
    this.targetBloom = 0;

    this.fruit = 0;
    this.targetFruit = 0;

    this.pollinatedGlow = 0;
    this.failedPulse = 0;
  }

  update() {
    this.growth = lerp(this.growth, this.targetGrowth, 0.035);
    this.bloom = lerp(this.bloom, this.targetBloom, 0.04);
    this.fruit = lerp(this.fruit, this.targetFruit, 0.045);

    if (this.stage === STAGE.POLLINATED) {
      this.pollinatedGlow = lerp(this.pollinatedGlow, 1, 0.035);
    } else {
      this.pollinatedGlow = lerp(this.pollinatedGlow, 0, 0.04);
    }

    this.failedPulse = max(0, this.failedPulse - 0.035);
  }

  stemHeight() {
    return lerp(20, min(height * 0.48, 330), easeOutCubic(this.growth));
  }

  flowerX() {
    return this.baseX + sin(frameCount * 0.018 + this.swaySeed) * 18 * this.growth;
  }

  flowerY() {
    return this.baseY - this.stemHeight();
  }

  display() {
    if (this.stage === STAGE.EMPTY) return;

    this.drawSeed();
    this.drawStemAndLeaves();

    if (this.bloom > 0.01 || this.stage === STAGE.BLOOM || this.stage === STAGE.POLLINATED) {
      this.drawFlower();
    }

    if (this.fruit > 0.01 || this.stage === STAGE.FRUIT) {
      this.drawFruit();
    }
  }

  drawSeed() {
    if (this.growth > 0.28) return;

    const a = map(this.growth, 0, 0.28, 220, 0, true);
    const x = lerp(this.seedX, this.baseX, easeOutCubic(this.growth * 3));
    const y = lerp(this.seedY, this.baseY, easeOutCubic(this.growth * 3));

    pushGlow(255, 220, 140, 28, a);
    noStroke();
    fill(255, 204, 125, a);
    ellipse(x, y, 15, 21);
    popGlow();
  }

  drawStemAndLeaves() {
    if (this.growth <= 0.01) return;

    const h = this.stemHeight();
    const topX = this.flowerX();
    const topY = this.flowerY();

    const c1x = this.baseX - 36;
    const c1y = this.baseY - h * 0.36;
    const c2x = this.baseX + 28;
    const c2y = this.baseY - h * 0.72;

    pushGlow(90, 255, 184, 24, 210);

    noFill();
    stroke(105, 255, 190, 210);
    strokeWeight(7);
    bezier(this.baseX, this.baseY, c1x, c1y, c2x, c2y, topX, topY);

    stroke(195, 255, 224, 110);
    strokeWeight(2.2);
    bezier(this.baseX, this.baseY, c1x, c1y, c2x, c2y, topX, topY);

    popGlow();

    this.drawLeaf(0.34, -1, 55 * this.growth);
    this.drawLeaf(0.55, 1, 68 * this.growth);
    this.drawLeaf(0.73, -1, 50 * this.growth);
  }

  pointOnStem(t) {
    const h = this.stemHeight();
    const topX = this.flowerX();
    const topY = this.flowerY();

    const c1x = this.baseX - 36;
    const c1y = this.baseY - h * 0.36;
    const c2x = this.baseX + 28;
    const c2y = this.baseY - h * 0.72;

    const x = bezierPoint(this.baseX, c1x, c2x, topX, t);
    const y = bezierPoint(this.baseY, c1y, c2y, topY, t);
    return createVector(x, y);
  }

  drawLeaf(t, dir, size) {
    if (this.growth < t * 0.75) return;

    let p = this.pointOnStem(t);
    let open = constrain(map(this.growth, t * 0.75, t + 0.2, 0, 1), 0, 1);
    let len = size * easeOutCubic(open);
    let ang = dir < 0 ? -PI * 0.88 : -PI * 0.12;

    push();
    translate(p.x, p.y);
    rotate(ang + sin(frameCount * 0.018 + t * 10) * 0.08);

    pushGlow(80, 255, 180, 20, 160);
    noStroke();
    fill(88, 230, 155, 120);
    beginShape();
    vertex(0, 0);
    bezierVertex(len * 0.34, -len * 0.32, len * 0.78, -len * 0.22, len, 0);
    bezierVertex(len * 0.65, len * 0.25, len * 0.22, len * 0.22, 0, 0);
    endShape(CLOSE);

    stroke(200, 255, 225, 90);
    strokeWeight(1);
    line(0, 0, len * 0.88, 0);
    popGlow();

    pop();
  }

  drawFlower() {
    const x = this.flowerX();
    const y = this.flowerY();

    const b = easeOutCubic(this.bloom);
    const flowerAlpha = 235 * b * (1 - this.fruit * 0.8);
    if (flowerAlpha <= 2) return;

    const pulse = 1 + sin(frameCount * 0.045) * 0.04;
    const failShake = this.failedPulse * sin(frameCount * 0.8) * 5;

    push();
    translate(x + failShake, y);

    pushGlow(255, 190, 230, 42 + this.pollinatedGlow * 22, flowerAlpha);

    noStroke();

    // 花瓣光晕
    fill(255, 205, 232, 28 * b);
    ellipse(0, 0, 118 * b, 118 * b);

    for (let i = 0; i < 7; i++) {
      let a = TWO_PI * i / 7 + frameCount * 0.002;
      let px = cos(a) * 24 * b;
      let py = sin(a) * 24 * b;

      push();
      translate(px, py);
      rotate(a);
      fill(255, 224, 242, flowerAlpha);
      ellipse(18 * b * pulse, 0, 38 * b, 18 * b);
      pop();
    }

    fill(255, 246, 190, flowerAlpha);
    ellipse(0, 0, 20 * b, 20 * b);

    if (this.pollinatedGlow > 0.01) {
      fill(255, 238, 150, 80 * this.pollinatedGlow);
      ellipse(0, 0, 60 * this.pollinatedGlow, 60 * this.pollinatedGlow);
    }

    popGlow();
    pop();
  }

  drawFruit() {
    const x = this.flowerX();
    const y = this.flowerY();
    const f = easeOutCubic(this.fruit);

    if (f <= 0.01) return;

    push();
    translate(x, y + 10 * f);

    pushGlow(255, 96, 62, 50, 240);

    noStroke();

    fill(255, 80, 55, 230);
    ellipse(0, 12, 58 * f, 54 * f);

    fill(255, 142, 92, 115);
    ellipse(-12 * f, 2 * f, 20 * f, 14 * f);

    fill(255, 190, 110, 55);
    ellipse(0, 12, 86 * f, 76 * f);

    // 番茄蒂
    fill(80, 230, 140, 210);
    for (let i = 0; i < 5; i++) {
      push();
      rotate(TWO_PI * i / 5);
      triangle(0, -16 * f, -5 * f, -3 * f, 5 * f, -3 * f);
      pop();
    }

    popGlow();
    pop();
  }
}

/* -------------------------------------------------------
   蝴蝶
------------------------------------------------------- */

class Butterfly {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.arrived = false;
    this.x = -100;
    this.y = height * 0.3;
    this.tx = width / 2;
    this.ty = height / 2;
    this.t = 0;
    this.seed = random(999);
  }

  summon(x, y) {
    this.active = true;
    this.arrived = false;

    this.x = random() < 0.5 ? -80 : width + 80;
    this.y = random(height * 0.18, height * 0.58);

    this.tx = x;
    this.ty = y - 20;

    this.t = 0;
    this.seed = random(999);
  }

  update(plant) {
    if (!this.active) return;

    this.tx = lerp(this.tx, plant.flowerX(), 0.04);
    this.ty = lerp(this.ty, plant.flowerY() - 18, 0.04);

    this.t += 0.012;

    const ease = easeOutCubic(constrain(this.t, 0, 1));

    const nx = noise(this.seed + frameCount * 0.01) - 0.5;
    const ny = noise(this.seed + 80 + frameCount * 0.012) - 0.5;

    this.x = lerp(this.x, this.tx, 0.025 + ease * 0.025) + nx * 3;
    this.y = lerp(this.y, this.ty, 0.025 + ease * 0.025) + ny * 3;

    if (dist(this.x, this.y, this.tx, this.ty) < 24) {
      this.arrived = true;
    }
  }

  display() {
    if (!this.active) return;

    const flap = sin(frameCount * 0.32) * 0.5 + 0.5;
    const wing = lerp(12, 28, flap);

    push();
    translate(this.x, this.y);

    pushGlow(255, 228, 160, 26, 200);

    noStroke();

    fill(255, 220, 150, 165);
    ellipse(-wing * 0.42, -4, wing, 20);
    ellipse(wing * 0.42, -4, wing, 20);

    fill(255, 245, 210, 125);
    ellipse(-wing * 0.32, 7, wing * 0.72, 15);
    ellipse(wing * 0.32, 7, wing * 0.72, 15);

    fill(70, 45, 35, 210);
    ellipse(0, 0, 5, 22);

    stroke(255, 235, 180, 135);
    strokeWeight(1);
    line(0, -8, -7, -18);
    line(0, -8, 7, -18);

    popGlow();
    pop();
  }
}

/* -------------------------------------------------------
   粒子与花瓣
------------------------------------------------------- */

class GlowParticle {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = random(width);
    this.y = initial ? random(height) : height + random(40);
    this.vx = random(-0.18, 0.18);
    this.vy = random(-0.65, -0.16);
    this.r = random(1.2, 3.6);
    this.life = random(0.4, 1);
    this.kind = random() < 0.55 ? "warm" : "cool";
    this.seed = random(999);
  }

  update() {
    this.x += this.vx + sin(frameCount * 0.01 + this.seed) * 0.12;
    this.y += this.vy;
    this.life -= 0.0015;

    if (this.y < -20 || this.life <= 0) {
      this.reset(false);
    }
  }

  display() {
    let a = 130 * this.life;
    if (this.kind === "warm") {
      pushGlow(255, 220, 120, 16, a);
      fill(255, 224, 145, a);
    } else {
      pushGlow(220, 255, 250, 14, a);
      fill(230, 255, 252, a);
    }

    noStroke();
    ellipse(this.x, this.y, this.r, this.r);
    popGlow();
  }
}

class FloatingPetal {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = random(width);
    this.y = initial ? random(height) : random(-120, -20);
    this.vx = random(-0.25, 0.25);
    this.vy = random(0.08, 0.38);
    this.s = random(10, 24);
    this.a = random(20, 58);
    this.seed = random(1000);
  }

  update() {
    this.x += this.vx + sin(frameCount * 0.008 + this.seed) * 0.22;
    this.y += this.vy;
    if (this.y > height + 80) this.reset(false);
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(sin(frameCount * 0.01 + this.seed) * 0.9);

    pushGlow(255, 205, 230, 12, this.a);
    noStroke();
    fill(255, 218, 236, this.a);
    ellipse(0, 0, this.s, this.s * 0.42);
    popGlow();

    pop();
  }
}

function updateAmbientParticles() {
  for (let p of particles) {
    p.update();
    p.display();
  }

  for (let p of petals) {
    p.update();
    p.display();
  }
}

function burst(x, y, c, count = 30) {
  for (let i = 0; i < count; i++) {
    particles.push(new BurstParticle(x, y, c));
  }

  // 避免粒子无限增长
  if (particles.length > 180) {
    particles.splice(0, particles.length - 180);
  }
}

class BurstParticle {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    const a = random(TWO_PI);
    const s = random(0.8, 4.2);
    this.vx = cos(a) * s;
    this.vy = sin(a) * s;
    this.r = random(2, 5);
    this.life = 1;
    this.c = c;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.vy -= 0.006;
    this.life -= 0.025;

    if (this.life <= 0) {
      this.resetAsAmbient();
    }
  }

  resetAsAmbient() {
    this.x = random(width);
    this.y = height + random(30);
    this.vx = random(-0.18, 0.18);
    this.vy = random(-0.65, -0.16);
    this.r = random(1.2, 3.2);
    this.life = random(0.5, 1);
    this.c = random() < 0.5 ? color(255, 224, 145) : color(230, 255, 252);
  }

  display() {
    let rr = red(this.c);
    let gg = green(this.c);
    let bb = blue(this.c);
    let a = 180 * this.life;

    pushGlow(rr, gg, bb, 18, a);
    noStroke();
    fill(rr, gg, bb, a);
    ellipse(this.x, this.y, this.r, this.r);
    popGlow();
  }
}

/* -------------------------------------------------------
    显示辅助信息
------------------------------------------------------- */

function displayHarvestBook() {
  push();
  textAlign(RIGHT, TOP);
  textSize(13);
  noStroke();
  fill(230, 255, 244, 130);
  text(`菜园图鉴：番茄 × ${harvestCount}`, width - 24, 24);
  pop();
}

function displayGestureDebug(g) {
  push();
  textAlign(LEFT, TOP);
  textSize(13);
  noStroke();
  fill(230, 255, 244, 115);

  let stageName = [
    "空园",
    "种子",
    "生长",
    "开花",
    "已授粉",
    "结果"
  ][garden.stage];

  text(`${gestureText}　｜　阶段：${stageName}`, 24, 24);
  pop();
}

/* -------------------------------------------------------
    工具函数
------------------------------------------------------- */

function pushGlow(r, g, b, blur = 24, alpha = 180) {
  drawingContext.save();
  drawingContext.shadowBlur = blur;
  drawingContext.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha / 255})`;
}

function popGlow() {
  drawingContext.restore();
}

function easeOutCubic(x) {
  x = constrain(x, 0, 1);
  return 1 - pow(1 - x, 3);
}

function mousePressed() {
  // 浏览器音频策略：点击任意位置恢复音频上下文
  userStartAudio();
  if (mic) mic.start();
}

function touchStarted() {
  userStartAudio();
  if (mic) mic.start();
  return false;
}

function updateDynamicHint(g) {
  if (!hintDiv) return;

  let title = "Palm Garden 掌上菜园";
  let line = "";
  let small = "";

  let handCount = predictions ? predictions.length : 0;
  let handStatus = "";

  if (!modelReady) {
    handStatus = "手势模型加载中";
  } else if (handCount === 0) {
    handStatus = "未识别到手";
  } else {
    handStatus = `已识别到手：${gestureText}`;
  }

  if (garden.stage === STAGE.EMPTY) {
    line = "第 1 步：🤏 拇指和食指捏在一起，播种";
    small = `${handStatus}｜请把手放到画面中央，露出完整手掌`;
  }

  else if (garden.stage === STAGE.SEED) {
    line = "第 2 步：✋ 张开手掌，并抬到画面上半区，幼苗会生长";
    small = `${handStatus}｜不是挥手，要让整只手掌清楚出现在画面中`;
  }

  else if (garden.stage === STAGE.GROWING) {
    let percent = floor(garden.growth * 100);
    if (garden.growth < 0.82) {
      line = `第 2 步：✋ 继续把手掌往上抬，植物正在生长 ${percent}%`;
      small = `${handStatus}｜手越高，植物越高`;
    } else {
      line = "第 3 步：🖐 五指完全张开，让花朵绽放";
      small = `${handStatus}｜手指之间尽量分开，掌心面对摄像头`;
    }
  }

  else if (garden.stage === STAGE.BLOOM) {
    line = "第 4 步：👏 拍一下手，召唤蝴蝶授粉";
    small = `${handStatus}｜如果没有反应，请先点击页面一次再拍手`;
  }

  else if (garden.stage === STAGE.POLLINATED) {
    line = "第 5 步：✊ 完全握拳，番茄会成熟结果";
    small = `${handStatus}｜五根手指尽量收回掌心`;
  }

  else if (garden.stage === STAGE.FRUIT) {
    line = "收获完成：🍅 再次 🤏 捏合，可以重新种下一棵";
    small = `${handStatus}｜菜园图鉴已记录一次收获`;
  }

  hintDiv.html(`
    <div class="title">${title}</div>
    <div class="line">${line}</div>
    <div class="small">${small}</div>
  `);
}