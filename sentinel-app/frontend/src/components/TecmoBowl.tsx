import { useEffect, useRef, useState } from 'react';

/**
 * THE GAME — Tecmo Bowl-style easter egg.
 * Unlocked via the Konami code (handled in Layout.tsx).
 * Maize-jersey Wolverines vs scarlet Buckeyes. Esc or X to dismiss.
 */
type Sprite = { x: number; y: number; vy: number };

const FIELD_W = 640;
const FIELD_H = 240;
const PLAYER_SPEED = 4;
const SPRITE = 16;

const PLAY_BOOK = [
  { name: 'OFF TACKLE', yards: () => 4 + Math.floor(Math.random() * 6) },
  { name: 'POST ROUTE', yards: () => 8 + Math.floor(Math.random() * 12) },
  { name: 'PLAY-ACTION BOMB', yards: () => 18 + Math.floor(Math.random() * 22) },
];

export default function TecmoBowl({ onClose }: { onClose: () => void }) {
  const [mich, setMich] = useState({ score: 0 });
  const [osu, setOsu] = useState({ score: 0 });
  const [quarter, setQuarter] = useState(1);
  const [yardLine, setYardLine] = useState(25);
  const [down, setDown] = useState(1);
  const [toGo, setToGo] = useState(10);
  const [toast, setToast] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [hailEnabled, setHailEnabled] = useState(false);

  const qbRef = useRef<Sprite>({ x: 80, y: FIELD_H / 2 - SPRITE / 2, vy: 0 });
  const defenders = useRef<Sprite[]>([
    { x: 320, y: 60, vy: 0.6 },
    { x: 380, y: 120, vy: -0.8 },
    { x: 440, y: 180, vy: 0.5 },
    { x: 500, y: 90, vy: -0.5 },
  ]);
  const frameRef = useRef<number | null>(null);
  const [, force] = useState(0);

  // Keyboard control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') onClose();
        return;
      }
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowUp')   qbRef.current.y = Math.max(8, qbRef.current.y - PLAYER_SPEED * 2);
      if (e.key === 'ArrowDown') qbRef.current.y = Math.min(FIELD_H - SPRITE - 8, qbRef.current.y + PLAYER_SPEED * 2);
      if (e.key === 'ArrowRight') qbRef.current.x = Math.min(FIELD_W - SPRITE - 8, qbRef.current.x + PLAYER_SPEED * 2);
      if (e.key === 'ArrowLeft')  qbRef.current.x = Math.max(8, qbRef.current.x - PLAYER_SPEED * 2);

      if (e.key === ' ' || e.key === '1' || e.key === '2' || e.key === '3') {
        const idx = e.key === ' ' ? Math.floor(Math.random() * 3) : Number(e.key) - 1;
        const play = PLAY_BOOK[idx];
        const gain = play.yards();
        showToast(`${play.name} · +${gain} YDS`);
        advancePlay(gain);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  // Sprite tick loop
  useEffect(() => {
    if (gameOver) return;
    const tick = () => {
      const ds = defenders.current;
      for (const d of ds) {
        d.y += d.vy;
        if (d.y < 16 || d.y > FIELD_H - SPRITE - 16) d.vy *= -1;
        // Defenders move slooowly toward the QB (visibly outclassed)
        if (d.x > qbRef.current.x + 30) d.x -= 0.18;
      }
      force((n) => (n + 1) % 1000);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [gameOver]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1300);
  };

  const playHail = () => {
    if (!hailEnabled) return;
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AC();
      // Stylized "Hail to the Victors" opening — 8-bit square wave riff (not the real recording, just the spirit).
      const notes = [
        [392, 0.18], [392, 0.10], [523, 0.18], [392, 0.10],
        [330, 0.28], [392, 0.18], [523, 0.18], [659, 0.40],
      ];
      let t = ctx.currentTime;
      for (const [freq, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur + 0.02;
      }
    } catch { /* audio not available */ }
  };

  const advancePlay = (gain: number) => {
    const newYard = yardLine + gain;
    if (newYard >= 100) {
      const newScore = mich.score + 7;
      setMich({ score: newScore });
      setYardLine(25);
      setDown(1); setToGo(10);
      showToast('TOUCHDOWN MICHIGAN · +7');
      playHail();
      qbRef.current = { x: 80, y: FIELD_H / 2 - SPRITE / 2, vy: 0 };
      maybeNextQuarter(newScore, osu.score);
      return;
    }
    setYardLine(newYard);
    if (gain >= toGo) {
      setDown(1); setToGo(10);
      showToast('FIRST DOWN');
    } else {
      const nextDown = down + 1;
      if (nextDown > 4) {
        // Buckeyes get a token field goal occasionally
        if (Math.random() < 0.35 && osu.score < mich.score) {
          const newScore = osu.score + 3;
          setOsu({ score: newScore });
          showToast('OSU FIELD GOAL · +3');
          maybeNextQuarter(mich.score, newScore);
        } else {
          showToast('TURNOVER ON DOWNS');
        }
        setDown(1); setToGo(10);
        setYardLine(25);
      } else {
        setDown(nextDown);
        setToGo(toGo - gain);
      }
    }
  };

  const maybeNextQuarter = (m: number, o: number) => {
    if (quarter >= 4) { setGameOver(true); return; }
    if (Math.random() < 0.4) {
      const next = quarter + 1;
      setQuarter(next);
      showToast(`END OF Q${quarter}`);
      if (next > 4) setGameOver(true);
    }
    void m; void o;
  };

  const finishNow = () => {
    // round to the iconic 2022 score in the user's favor: 45 - 23 if not enough
    setMich({ score: Math.max(mich.score, 45) });
    setOsu({ score: Math.min(osu.score, 23) });
    setQuarter(4);
    setGameOver(true);
    setTimeout(() => playHail(), 200);
  };

  return (
    <div className="tecmo-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tecmo-crt">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[#FFCB05] hover:text-white font-mono text-sm"
          aria-label="Close"
        >[X]</button>

        <div className="tecmo-title">THE GAME</div>
        <div className="tecmo-sub">TECMO BOWL · 1990 · MICH vs OHIO STATE</div>

        <div className="tecmo-scoreboard">
          <div>
            <div className="tecmo-team-mich">MICHIGAN</div>
            <div className="tecmo-score">{String(mich.score).padStart(2, '0')}</div>
          </div>
          <div style={{ fontSize: 14, color: '#FFDA47' }}>
            Q{quarter} · DN{down} · {toGo} TO GO<br />
            BALL ON {yardLine}
          </div>
          <div>
            <div className="tecmo-team-osu">OHIO STATE</div>
            <div className="tecmo-score">{String(osu.score).padStart(2, '0')}</div>
          </div>
        </div>

        <div className="tecmo-field">
          {toast && <div className="tecmo-toast">{toast}</div>}
          {/* yard markers */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((m) => (
            <div
              key={m}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: (FIELD_W * m) / 100 - 1, width: 1,
                background: m === 50 ? '#FFCB05' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
          {/* end zones */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 32, background: 'rgba(255,203,5,0.5)', borderRight: '2px solid #FFCB05', display: 'grid', placeItems: 'center', color: '#00274C', fontSize: 10, fontWeight: 700, writingMode: 'vertical-rl' }}>MICHIGAN</div>
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 32, background: 'rgba(187,0,0,0.5)', borderLeft: '2px solid #BB0000', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 10, fontWeight: 700, writingMode: 'vertical-rl' }}>OHIO STATE</div>
          {/* QB */}
          <div className="tecmo-sprite mich" style={{ left: qbRef.current.x, top: qbRef.current.y }} />
          {/* ball cue */}
          <div className="tecmo-sprite ball" style={{ left: qbRef.current.x + 18, top: qbRef.current.y + 6 }} />
          {/* defenders */}
          {defenders.current.map((d, i) => (
            <div key={i} className="tecmo-sprite osu" style={{ left: d.x, top: d.y }} />
          ))}
        </div>

        {!gameOver ? (
          <>
            <div className="tecmo-controls">
              <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> MOVE QB &nbsp;·&nbsp;
              <kbd>1</kbd> RUN &nbsp; <kbd>2</kbd> PASS &nbsp; <kbd>3</kbd> BOMB &nbsp;·&nbsp; <kbd>SPACE</kbd> AUDIBLE
            </div>
            <div className="tecmo-banner">
              <button
                onClick={finishNow}
                className="font-mono text-[11px] tracking-[0.2em] text-[#FFCB05] hover:text-white underline-offset-4 hover:underline"
              >SKIP TO FINAL · 45-23</button>
              <span className="mx-3 text-[#163d6d]">·</span>
              <label className="text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hailEnabled}
                  onChange={(e) => setHailEnabled(e.target.checked)}
                  style={{ marginRight: 6, verticalAlign: 'middle' }}
                />
                HAIL TO THE VICTORS (chiptune)
              </label>
              <span className="mx-3 text-[#163d6d]">·</span>
              <kbd>ESC</kbd> EXIT
            </div>
          </>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div className="tecmo-title" style={{ fontSize: 28, letterSpacing: 4 }}>
              {mich.score > osu.score ? 'MICHIGAN WINS' : 'GAME OVER'}
            </div>
            <div className="tecmo-banner" style={{ marginTop: 8, fontSize: 13 }}>
              {mich.score > osu.score ? (
                <>FINAL · MICHIGAN {mich.score} – OHIO STATE {osu.score} · GO BLUE 〽</>
              ) : (
                <>FINAL · {mich.score} – {osu.score}</>
              )}
            </div>
            <div className="tecmo-controls" style={{ marginTop: 14 }}>
              BUILT ON FIVETRAN ODI · DBT LABS · ICEBERG · SNOWFLAKE
            </div>
            <div className="tecmo-controls" style={{ marginTop: 6 }}>
              <kbd>ESC</kbd> CLOSE
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
