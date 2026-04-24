/* ============================================================
   Circuit Board Background Animation
   Adapted from portfolio's GlobalCircuitry component
   ============================================================ */

(function () {
  const canvas = document.getElementById("circuitCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let segments = [];
  let animFrame = 0;

  function buildEdgeTrees(w, h) {
    const segs = [];
    let idCounter = 0;
    const margin = w * 0.18;
    const gridSize = 25;
    const occupied = new Set();

    function key(x, y) {
      return `${Math.round(x / gridSize)},${Math.round(y / gridSize)}`;
    }

    function addPath(sx, sy, angle, depth, parentId, side) {
      if (depth <= 0 || segs.length > 500) return;

      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = 40 + Math.random() * 80;
      const ex = sx + Math.cos(snappedAngle) * len;
      const ey = sy + Math.sin(snappedAngle) * len;

      const leftBoundary = side === "left" ? -40 : w - margin - 40;
      const rightBoundary = side === "left" ? margin + 40 : w + 40;

      if (ex < leftBoundary || ex > rightBoundary || ey < -50 || ey > h + 50) return;

      const endKey = key(ex, ey);
      const midKey = key(
        sx + Math.cos(snappedAngle) * (len / 2),
        sy + Math.sin(snappedAngle) * (len / 2)
      );
      if (occupied.has(endKey) || occupied.has(midKey)) return;

      occupied.add(endKey);
      occupied.add(midKey);

      const currentId = idCounter++;
      const seg = {
        id: currentId,
        x1: sx, y1: sy,
        x2: ex, y2: ey,
        length: len,
        children: [],
        parentId: parentId,
        head: 0,
        tail: 0,
        isPulsing: false,
        nextPulseDelay: parentId === null ? Math.random() * 8 : 0,
      };

      segs.push(seg);
      if (parentId !== null) {
        const parent = segs.find((s) => s.id === parentId);
        if (parent) parent.children.push(currentId);
      }

      const numBranches = Math.random() > 0.82 && depth > 2 ? 2 : 1;
      for (let i = 0; i < numBranches; i++) {
        const turn = (Math.floor(Math.random() * 3) - 1) * (Math.PI / 4);
        addPath(ex, ey, snappedAngle + turn, depth - 1, currentId, side);
      }
    }

    const seedCount = 10;
    for (let i = 0; i < seedCount; i++) {
      const y = (h / (seedCount + 1)) * (i + 1);
      addPath(0, y, 0, 8, null, "left");
      addPath(w, y, Math.PI, 8, null, "right");
    }

    return segs;
  }

  function updateAndDraw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    segments.forEach((seg) => {
      // Static trace
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = "rgba(255,107,0,0.015)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Pulse logic
      if (!seg.isPulsing) {
        if (seg.parentId === null) {
          seg.nextPulseDelay -= 0.016;
          if (seg.nextPulseDelay <= 0) {
            seg.isPulsing = true;
            seg.head = 0;
            seg.tail = 0;
            seg.nextPulseDelay = 5 + Math.random() * 10;
          }
        }
      } else {
        const speed = 0.0075;
        seg.head += speed;

        const signalLength = 2.0;
        if (seg.head > signalLength) {
          seg.tail += speed;
        }

        if (seg.head >= 1.0 && seg.head < 1.0 + speed) {
          seg.children.forEach((cid) => {
            const child = segments.find((s) => s.id === cid);
            if (child && !child.isPulsing) {
              child.isPulsing = true;
              child.head = 0;
              child.tail = 0;
            }
          });
        }

        if (seg.tail >= 1.0) {
          seg.isPulsing = false;
          seg.head = 0;
          seg.tail = 0;
        }
      }

      // Draw active signal
      if (seg.isPulsing) {
        const dx = seg.x2 - seg.x1;
        const dy = seg.y2 - seg.y1;
        const h = Math.min(1, seg.head);
        const t = Math.max(0, Math.min(1, seg.tail));

        if (h > t) {
          const intensity = h - t;
          ctx.beginPath();
          ctx.moveTo(seg.x1 + dx * t, seg.y1 + dy * t);
          ctx.lineTo(seg.x1 + dx * h, seg.y1 + dy * h);

          ctx.shadowColor = "#ff6b00";
          ctx.shadowBlur = 12 * intensity;
          ctx.strokeStyle = `rgba(255,107,0,${0.35 + intensity * 0.65})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Start node
          if (t < 0.25 && h > 0.01) {
            const alpha =
              Math.min(1, h * 20) * Math.max(0, (0.25 - t) * 4) * 0.8;
            ctx.fillStyle = `rgba(255,107,0,${alpha})`;
            ctx.beginPath();
            ctx.arc(seg.x1, seg.y1, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(5,5,5,${alpha})`;
            ctx.beginPath();
            ctx.arc(seg.x1, seg.y1, 0.8, 0, Math.PI * 2);
            ctx.fill();
          }

          // End node
          if (h > 0.95) {
            const alpha =
              Math.min(1, (h - 0.95) * 20) * (1 - t) * 0.8;
            if (alpha > 0) {
              ctx.fillStyle = `rgba(255,107,0,${alpha})`;
              ctx.beginPath();
              ctx.arc(seg.x2, seg.y2, 2.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = `rgba(5,5,5,${alpha})`;
              ctx.beginPath();
              ctx.arc(seg.x2, seg.y2, 0.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    });

    animFrame = requestAnimationFrame(updateAndDraw);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    segments = buildEdgeTrees(canvas.width, canvas.height);
  }

  resize();
  window.addEventListener("resize", resize);
  animFrame = requestAnimationFrame(updateAndDraw);
})();
