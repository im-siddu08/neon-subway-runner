
import { useEffect, useRef, useState } from "react";

const LANES = [-1, 0, 1];

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem("neon-runner-best")) || 0;
    } catch {
      return 0;
    }
  });

  function createGame() {
    return {
      lane: 0,
      playerX: 0,
      jump: 0,
      slide: 0,
      objects: [],
      distance: 0,
      score: 0,
      coins: 0,
      speed: 0.36,
      spawn: 0,
      over: false,
      lastTime: 0,
      lastUI: 0
    };
  }

  function startGame() {
    gameRef.current = createGame();
    setScore(0);
    setCoins(0);
    setGameOver(false);
    setPlaying(true);
  }

  function move(direction) {
    const g = gameRef.current;
    if (!g || g.over) return;

    g.lane = Math.max(-1, Math.min(1, g.lane + direction));
  }

  function jump() {
    const g = gameRef.current;
    if (!g || g.over || g.jump > 0 || g.slide > 0) return;
    g.jump = 0.75;
  }

  function slide() {
    const g = gameRef.current;
    if (!g || g.over || g.jump > 0 || g.slide > 0) return;
    g.slide = 0.65;
  }

  useEffect(() => {
    if (!playing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animation;
    let alive = true;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const g = gameRef.current;

    function roundRect(x, y, w, h, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    }

    function drawScene(dt) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const horizon = h * 0.28;
      const bottom = h * 0.98;
      const center = w / 2;
      const roadTop = w * 0.16;
      const roadBottom = w * 0.95;

      ctx.clearRect(0, 0, w, h);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#101b3d");
      sky.addColorStop(0.55, "#3b2860");
      sky.addColorStop(1, "#111325");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Moon
      ctx.fillStyle = "#d9d5ff";
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(w * 0.79, h * 0.12, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // City skyline
      for (let i = 0; i < 13; i++) {
        const bw = w / 11;
        const bh = h * (0.10 + (i * 17 % 9) * 0.018);
        const x = i * bw - 8;

        ctx.fillStyle = i % 2 ? "#18213d" : "#222342";
        ctx.fillRect(x, horizon - bh, bw - 3, bh);

        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = "#f9c76c";
          ctx.globalAlpha = 0.4;
          ctx.fillRect(
            x + 6 + j * 10,
            horizon - bh + 12,
            4,
            5
          );
        }
        ctx.globalAlpha = 1;
      }

      // Ground
      ctx.fillStyle = "#111525";
      ctx.fillRect(0, horizon, w, h - horizon);

      // Railway perspective
      const road = [
        [center - roadTop, horizon],
        [center + roadTop, horizon],
        [center + roadBottom, bottom],
        [center - roadBottom, bottom]
      ];

      ctx.beginPath();
      road.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      const trackGradient = ctx.createLinearGradient(0, horizon, 0, bottom);
      trackGradient.addColorStop(0, "#34324b");
      trackGradient.addColorStop(1, "#171a2a");
      ctx.fillStyle = trackGradient;
      ctx.fill();

      // Track edges
      ctx.strokeStyle = "#9b75ed";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#a855f7";

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(center + side * roadTop, horizon);
        ctx.lineTo(center + side * roadBottom, bottom);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;

      // Rails
      for (const lane of LANES) {
        const xTop = center + lane * roadTop * 0.66;
        const xBottom = center + lane * roadBottom * 0.66;

        ctx.strokeStyle = "#a7a6b8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xTop - 9, horizon);
        ctx.lineTo(xBottom - 9, bottom);
        ctx.moveTo(xTop + 9, horizon);
        ctx.lineTo(xBottom + 9, bottom);
        ctx.stroke();
      }

      // Moving railway sleepers
      for (let i = 0; i < 15; i++) {
        const p = ((i / 15 + g.distance * 0.7) % 1);
        const y = horizon + (bottom - horizon) * p * p;
        const width = roadTop + (roadBottom - roadTop) * p * p;

        ctx.strokeStyle = "#77718d";
        ctx.lineWidth = 1 + p * 4;
        ctx.globalAlpha = 0.25 + p * 0.5;
        ctx.beginPath();
        ctx.moveTo(center - width * 0.96, y);
        ctx.lineTo(center + width * 0.96, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Side lights
      for (let i = 0; i < 9; i++) {
        const p = ((i / 9 + g.distance * 0.45) % 1);
        const y = horizon + (bottom - horizon) * p * p;
        const spread = roadTop + (roadBottom - roadTop) * p * p;

        for (const side of [-1, 1]) {
          ctx.fillStyle = "#b77aff";
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 12 * p;
          ctx.beginPath();
          ctx.arc(center + side * spread * 1.12, y, 2 + 5 * p, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;

      function position(lane, z) {
        const p = Math.max(0, Math.min(1, z));
        const y = horizon + (bottom - horizon) * p * p;
        const spread = roadTop + (roadBottom - roadTop) * p * p;
        return {
          x: center + lane * spread * 0.66,
          y,
          scale: 0.12 + p * 0.95
        };
      }

      // Draw obstacles and coins
      const sorted = [...g.objects].sort((a, b) => a.z - b.z);

      for (const obj of sorted) {
        const pos = position(obj.lane, obj.z);
        const s = pos.scale;
        const x = pos.x;
        const y = pos.y;

        if (obj.type === "coin") {
          ctx.save();
          ctx.translate(x, y - 23 * s);
          ctx.scale(s, s);

          ctx.fillStyle = "#ffd447";
          ctx.shadowColor = "#ffbd24";
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#fff2a3";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        }

        if (obj.type === "barrier") {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(s, s);

          roundRect(-29, -48, 58, 48, 5, "#e74c60");
          ctx.fillStyle = "#ffda73";
          ctx.fillRect(-29, -34, 58, 9);
          ctx.fillStyle = "#6c294b";
          ctx.fillRect(-25, -8, 50, 8);

          ctx.restore();
        }

        if (obj.type === "train") {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(s, s);

          roundRect(-38, -112, 76, 112, 11, "#6c42a7");
          roundRect(-30, -99, 60, 36, 6, "#b8e6ff");
          roundRect(-30, -55, 60, 12, 3, "#33224f");

          ctx.fillStyle = "#ffdf76";
          ctx.fillRect(-27, -10, 12, 6);
          ctx.fillRect(15, -10, 12, 6);

          ctx.restore();
        }

        if (obj.type === "low") {
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(s, s);

          ctx.fillStyle = "#ff9d46";
          ctx.fillRect(-35, -78, 70, 10);
          ctx.fillStyle = "#d0a4ff";
          ctx.fillRect(-32, -68, 5, 68);
          ctx.fillRect(27, -68, 5, 68);

          ctx.restore();
        }
      }

      // Player character
      const player = position(g.playerX, 0.91);
      const px = player.x;
      const py = player.y;
      const jumping = g.jump > 0;
      const sliding = g.slide > 0;
      const jumpHeight = jumping ? Math.sin((g.jump / 0.75) * Math.PI) * h * 0.15 : 0;

      ctx.save();
      ctx.translate(px, py - jumpHeight);

      // Shadow
      ctx.globalAlpha = jumping ? 0.15 : 0.45;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(0, 2, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (sliding) {
        // Sliding character
        roundRect(-26, -34, 53, 22, 10, "#ff9c4a");
        ctx.fillStyle = "#273c9e";
        ctx.fillRect(-30, -13, 60, 10);
        ctx.fillStyle = "#ffd4a3";
        ctx.beginPath();
        ctx.arc(20, -31, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Legs
        ctx.fillStyle = "#263d9c";
        ctx.fillRect(-14, -33, 11, 34);
        ctx.fillRect(4, -33, 11, 34);

        // Shoes
        roundRect(-17, -6, 17, 8, 4, "#f1eaff");
        roundRect(3, -6, 17, 8, 4, "#f1eaff");

        // Body
        roundRect(-20, -77, 40, 46, 10, "#ff963d");

        // Jacket
        ctx.fillStyle = "#ffcf55";
        ctx.fillRect(-5, -76, 10, 42);

        // Head
        ctx.fillStyle = "#e9a878";
        ctx.beginPath();
        ctx.arc(0, -91, 17, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = "#302039";
        ctx.beginPath();
        ctx.arc(0, -99, 17, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-16, -100, 32, 8);

        // Arms
        ctx.strokeStyle = "#e9a878";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-17, -67);
        ctx.lineTo(-27, -46);
        ctx.moveTo(17, -67);
        ctx.lineTo(27, -46);
        ctx.stroke();
      }

      ctx.restore();

      // Instructions on the track
      if (g.score < 100 && !g.over) {
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("DODGE  •  JUMP  •  COLLECT", center, h - 10);
      }
    }

    function spawnObject() {
      const lane = LANES[Math.floor(Math.random() * 3)];
      const chance = Math.random();

      let type = "coin";

      if (chance < 0.20) type = "train";
      else if (chance < 0.42) type = "barrier";
      else if (chance < 0.56) type = "low";

      // Sometimes create a coin instead of an obstacle
      if (Math.random() < 0.32) type = "coin";

      g.objects.push({
        lane,
        type,
        z: 0
      });
    }

    function update(dt) {
      if (g.over) return;

      g.distance += dt * g.speed;
      g.score += dt * 12;
      g.speed = Math.min(0.82, 0.36 + g.score / 18000);

      g.playerX += (g.lane - g.playerX) * Math.min(1, dt * 12);

      if (g.jump > 0) g.jump = Math.max(0, g.jump - dt);
      if (g.slide > 0) g.slide = Math.max(0, g.slide - dt);

      g.spawn -= dt;

      if (g.spawn <= 0) {
        spawnObject();
        g.spawn = Math.max(0.55, 1.05 - g.speed * 0.5);
      }

      for (const obj of g.objects) {
        obj.z += dt * g.speed;

        if (obj.z > 0.84 && obj.z < 0.98 && Math.abs(obj.lane - g.playerX) < 0.42) {
          if (obj.type === "coin" && !obj.collected) {
            obj.collected = true;
            g.coins++;
            g.score += 25;
          }

          if (
            obj.type !== "coin" &&
            !obj.hit &&
            obj.z > 0.86 &&
            obj.z < 0.96
          ) {
            const safe = (
              (obj.type === "barrier" && g.jump > 0.12) ||
              (obj.type === "low" && g.slide > 0.12)
            );

            if (!safe) {
              obj.hit = true;
              g.over = true;
              setPlaying(false);
              setGameOver(true);

              const finalScore = Math.floor(g.score);
              setScore(finalScore);
              setCoins(g.coins);

              setBest(old => {
                const next = Math.max(old, finalScore);
                try {
                  localStorage.setItem("neon-runner-best", String(next));
                } catch {}
                return next;
              });
            }
          }
        }
      }

      g.objects = g.objects.filter(obj => obj.z < 1.08 && !obj.collected);

      if (g.over) return;

      if (performance.now() - g.lastUI > 100) {
        setScore(Math.floor(g.score));
        setCoins(g.coins);
        g.lastUI = performance.now();
      }
    }

    function loop(time) {
      if (!alive) return;

      const dt = g.lastTime
        ? Math.min((time - g.lastTime) / 1000, 0.035)
        : 0;

      g.lastTime = time;

      update(dt);
      drawScene(dt);

      if (alive) animation = requestAnimationFrame(loop);
    }

    animation = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", resize);
    };
  }, [playing]);

  // Keyboard controls
  useEffect(() => {
    function handleKey(e) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") move(-1);
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") move(1);
      if (e.key === "ArrowUp" || e.key === " ") jump();
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") slide();
      if (e.key === "Enter" && !playing) startGame();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // Swipe controls for phones
  const touchStart = useRef(null);

  function handleTouchStart(e) {
    touchStart.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
  }

  function handleTouchEnd(e) {
    if (!touchStart.current) return;

    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) {
      if (Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? 1 : -1);
      } else if (dy < 0) {
        jump();
      } else {
        slide();
      }
    }

    touchStart.current = null;
  }

  return (
    <div className="game-page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⚡</span>
          NEON <b>RUNNER</b>
        </div>
        <span className="live-label">● ENDLESS MODE</span>
      </header>

      <main className="game-content">
        <div className="title-area">
          <p>THE CITY IS YOUR PLAYGROUND</p>
          <h1>SUBWAY <span>RUN</span></h1>
        </div>

        <div className="hud">
          <div className="hud-card">
            <small>SCORE</small>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div className="hud-card coin-hud">
            <small>COINS</small>
            <strong>🪙 {coins}</strong>
          </div>
          <div className="hud-card">
            <small>BEST</small>
            <strong>{best.toLocaleString()}</strong>
          </div>
        </div>

        <div
          className="game-window"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <canvas ref={canvasRef} className="game-canvas" />

          {!playing && !gameOver && (
            <div className="overlay">
              <div className="overlay-icon">🏃</div>
              <p className="overlay-small">READY TO RUN?</p>
              <h2>START YOUR<br /><span>ADVENTURE</span></h2>
              <p className="overlay-description">
                Dodge trains, jump barriers and collect coins!
              </p>
              <button className="start-button" onClick={startGame}>
                ▶ START RUNNING
              </button>
            </div>
          )}

          {gameOver && (
            <div className="overlay">
              <div className="overlay-icon">💥</div>
              <p className="overlay-small">RUN FINISHED</p>
              <h2>GAME <span>OVER</span></h2>
              <div className="final-score">
                <div>
                  <small>YOUR SCORE</small>
                  <strong>{score.toLocaleString()}</strong>
                </div>
                <div>
                  <small>COINS</small>
                  <strong>🪙 {coins}</strong>
                </div>
              </div>
              <button className="start-button" onClick={startGame}>
                ↻ PLAY AGAIN
              </button>
            </div>
          )}
        </div>

        <div className="controls">
          <button onClick={() => move(-1)}>← LEFT</button>
          <button onClick={jump}>↑ JUMP</button>
          <button onClick={slide}>↓ SLIDE</button>
          <button onClick={() => move(1)}>RIGHT →</button>
        </div>

        <p className="help-text">
          KEYBOARD: ← → to move · ↑ to jump · ↓ to slide
        </p>
        <p className="mobile-help">
          PHONE: Swipe left, right, up or down on the game
        </p>
      </main>

      <footer className="game-footer">
        NEON SUBWAY RUNNER <span>•</span> RUN FOREVER
      </footer>
    </div>
  );
}
