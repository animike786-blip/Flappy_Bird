
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------------
  const CANVAS_WIDTH = 640;
  const CANVAS_HEIGHT = 480;

  const GRAVITY = 1500;          // px/s^2
  const FLAP_VELOCITY = -420;    // px/s (negative = upward)
  const MAX_FALL_SPEED = 700;    // px/s terminal velocity

  const PIPE_WIDTH = 80;         // px
  const PIPE_SPEED = 170;        // px/s, moves right-to-left
  const PIPE_SPAWN_INTERVAL = 1.4; // seconds between new pipe pairs
  const GAP_HEIGHT = 165;        // px vertical gap the bird flies through
  const GAP_EDGE_MARGIN = 60;    // px min distance of gap from top/bottom

  const BIRD_WIDTH = 68;
  const BIRD_HEIGHT = 48;        // matches bird1.png aspect ratio (408x288)
  const BIRD_X = 140;            // fixed horizontal position on screen
  const BIRD_HITBOX_INSET = 8;   // shrink collision box vs sprite for fairness

  const STATE = {
    START: "start",
    CUSTOMIZE: "customize",
    PLAYING: "playing",
    GAMEOVER: "gameover",
  };

  // ------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const hud = document.getElementById("hud");
  const scoreDisplay = document.getElementById("scoreDisplay");

  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");

  const customizeScreen = document.getElementById("customizeScreen");
  const bgOptions = document.getElementById("bgOptions");
  const towerOptions = document.getElementById("towerOptions");
  const playBtn = document.getElementById("playBtn");

  const gameOverScreen = document.getElementById("gameOverScreen");
  const finalScoreEl = document.getElementById("finalScore");
  const restartBtn = document.getElementById("restartBtn");

  // ------------------------------------------------------------------
  // Asset preloading
  // ------------------------------------------------------------------
  const ASSET_FILES = {
    bg1: "bg1.jpg",
    bg2: "bg2.jpg",
    bg3: "bg3.png",
    bird1: "bird1.png",
    tower1: "tower1.png",
    tower1upper: "tower1upper.png",
    tower2: "tower2.png",
    tower2upper: "tower2upper.png",
  };

  const images = {};
  let assetsLoaded = 0;
  const assetKeys = Object.keys(ASSET_FILES);

  function loadAssets(onDone) {
    assetKeys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded === assetKeys.length) onDone();
      };
      img.src = ASSET_FILES[key];
      images[key] = img;
    });
  }

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  let state = STATE.START;
  let selectedBg = "bg1";
  let selectedTower = "tower1";

  let bird = null;
  let pipes = [];
  let score = 0;
  let spawnTimer = 0;
  let lastTimestamp = null;

  function resetRound() {
    bird = {
      x: BIRD_X,
      y: CANVAS_HEIGHT / 2,
      velocity: 0,
      rotation: 0,
    };
    pipes = [];
    score = 0;
    spawnTimer = 0;
    scoreDisplay.textContent = "0";
  }

  // ------------------------------------------------------------------
  // Screen / state transitions
  // ------------------------------------------------------------------
  function showScreen(next) {
    state = next;
    startScreen.classList.toggle("hidden", next !== STATE.START);
    customizeScreen.classList.toggle("hidden", next !== STATE.CUSTOMIZE);
    gameOverScreen.classList.toggle("hidden", next !== STATE.GAMEOVER);
    hud.classList.toggle("hidden", next !== STATE.PLAYING);
  }

  function selectOption(row, choiceKey) {
    Array.from(row.children).forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.choice === choiceKey);
    });
  }

  bgOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".option-thumb");
    if (!btn) return;
    selectedBg = btn.dataset.choice;
    selectOption(bgOptions, selectedBg);
  });

  towerOptions.addEventListener("click", (e) => {
    const btn = e.target.closest(".option-thumb");
    if (!btn) return;
    selectedTower = btn.dataset.choice;
    selectOption(towerOptions, selectedTower);
  });

  startBtn.addEventListener("click", () => {
    showScreen(STATE.CUSTOMIZE);
  });

  playBtn.addEventListener("click", () => {
    resetRound();
    showScreen(STATE.PLAYING);
  });

  restartBtn.addEventListener("click", () => {
    resetRound();
    showScreen(STATE.PLAYING);
  });

  // ------------------------------------------------------------------
  // Input: flap
  // ------------------------------------------------------------------
  function flap() {
    if (state !== STATE.PLAYING) return;
    bird.velocity = FLAP_VELOCITY;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      flap();
    }
  });

  canvas.addEventListener("mousedown", flap);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    flap();
  });

  // ------------------------------------------------------------------
  // Pipes
  // ------------------------------------------------------------------
  function spawnPipe() {
    const minGapCenter = GAP_EDGE_MARGIN + GAP_HEIGHT / 2;
    const maxGapCenter = CANVAS_HEIGHT - GAP_EDGE_MARGIN - GAP_HEIGHT / 2;
    const gapCenter =
      minGapCenter + Math.random() * (maxGapCenter - minGapCenter);

    pipes.push({
      x: CANVAS_WIDTH,
      gapTop: gapCenter - GAP_HEIGHT / 2,
      gapBottom: gapCenter + GAP_HEIGHT / 2,
      scored: false,
    });
  }

  function updatePipes(dt) {
    spawnTimer += dt;
    if (spawnTimer >= PIPE_SPAWN_INTERVAL) {
      spawnTimer = 0;
      spawnPipe();
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
      const pipe = pipes[i];
      pipe.x -= PIPE_SPEED * dt;

      if (!pipe.scored && pipe.x + PIPE_WIDTH < bird.x) {
        pipe.scored = true;
        score++;
        scoreDisplay.textContent = String(score);
      }

      if (pipe.x + PIPE_WIDTH < 0) {
        pipes.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------------
  // Bird physics
  // ------------------------------------------------------------------
  function updateBird(dt) {
    bird.velocity += GRAVITY * dt;
    if (bird.velocity > MAX_FALL_SPEED) bird.velocity = MAX_FALL_SPEED;
    bird.y += bird.velocity * dt;

    // Tilt: up when rising, nose-diving when falling fast
    const maxTilt = Math.PI / 2.2;
    bird.rotation = Math.max(
      -0.4,
      Math.min(maxTilt, bird.velocity / 500)
    );
  }

  function getBirdHitbox() {
    return {
      left: bird.x - BIRD_WIDTH / 2 + BIRD_HITBOX_INSET,
      right: bird.x + BIRD_WIDTH / 2 - BIRD_HITBOX_INSET,
      top: bird.y - BIRD_HEIGHT / 2 + BIRD_HITBOX_INSET,
      bottom: bird.y + BIRD_HEIGHT / 2 - BIRD_HITBOX_INSET,
    };
  }

  // ------------------------------------------------------------------
  // Collision detection
  // ------------------------------------------------------------------
  function checkCollisions() {
    const box = getBirdHitbox();

    if (box.top <= 0 || box.bottom >= CANVAS_HEIGHT) {
      return true;
    }

    for (const pipe of pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;

      const overlapsX = box.right > pipeLeft && box.left < pipeRight;
      if (!overlapsX) continue;

      const hitsTopPipe = box.top < pipe.gapTop;
      const hitsBottomPipe = box.bottom > pipe.gapBottom;

      if (hitsTopPipe || hitsBottomPipe) {
        return true;
      }
    }

    return false;
  }

  function endGame() {
    showScreen(STATE.GAMEOVER);
    finalScoreEl.textContent = String(score);
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------
  function drawBackground() {
    ctx.drawImage(images[selectedBg], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function drawPipes() {
    const bottomImg = images[selectedTower];
    const upperImg = images[selectedTower + "upper"];

    pipes.forEach((pipe) => {
      // Top pipe: stretched from ceiling (y=0) down to the gap.
      ctx.drawImage(upperImg, pipe.x, 0, PIPE_WIDTH, pipe.gapTop);

      // Bottom pipe: stretched from the gap down to the floor.
      ctx.drawImage(
        bottomImg,
        pipe.x,
        pipe.gapBottom,
        PIPE_WIDTH,
        CANVAS_HEIGHT - pipe.gapBottom
      );
    });
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);
    ctx.drawImage(
      images.bird1,
      -BIRD_WIDTH / 2,
      -BIRD_HEIGHT / 2,
      BIRD_WIDTH,
      BIRD_HEIGHT
    );
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (state === STATE.PLAYING || state === STATE.GAMEOVER) {
      drawBackground();
      drawPipes();
      drawBird();
    } else {
      // Idle screens still show the currently selected background so the
      // customize screen previews it underneath the overlay.
      drawBackground();
    }
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  function loop(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    if (state === STATE.PLAYING) {
      updateBird(dt);
      updatePipes(dt);
      if (checkCollisions()) {
        endGame();
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  loadAssets(() => {
    resetRound();
    showScreen(STATE.START);
    requestAnimationFrame(loop);
  });
})();
