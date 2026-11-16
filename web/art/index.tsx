// Hand-drawn dachshund line art for The Sausage Gazette.
// Contract: every component takes optional { size?: number; className?: string; style?: React.CSSProperties }
// and draws with stroke="currentColor" so the caller sets the ink colour.
// Shapes that must hide lines behind them are filled with var(--art-fill), defaulting to newsprint paper.
import { useId, type CSSProperties, type ReactNode } from "react";
import "./art.css";

export interface ArtProps { size?: number; className?: string; style?: CSSProperties }

const FILL = "var(--art-fill, #f3ead6)";
const INK = { fill: FILL, stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const LINE = { ...INK, fill: "none" } as const;

function Svg({ size = 120, vb, label, className, style, children }: ArtProps & { vb: string; label: string; children: ReactNode }) {
  return (
    <svg viewBox={vb} width={size} className={["dk-art", className].filter(Boolean).join(" ")} style={style}
      role="img" aria-label={label} {...INK}>
      {children}
    </svg>
  );
}

/** A stubby leg whose top (0,0) hides inside the body; the paw points toward +x. */
function Leg({ x, y, len = 12, rot = 0, cls }: { x: number; y: number; len?: number; rot?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path className={cls} d={`M-3.5 0V${len}q0 3.5 3.5 3.5h4.5q3 0 2.5-3l-3-2.5V0`} />
    </g>
  );
}

/** Side-view dachshund facing right, standing on y≈61 within a 0 0 200 72 box. */
function SideDog({ running, roll }: { running?: boolean; roll?: boolean }) {
  const r = running ? "dk-run" : "";
  return (
    <g className={r}>
      <path {...LINE} className="dk-tail" d="M32 33C24 29 18 22 15 13" />
      <Leg x={46} y={44} len={14} rot={running ? 0 : 6} cls={running ? "dk-leg-b" : undefined} />
      <Leg x={146} y={44} len={14} rot={running ? 0 : 8} cls={running ? "dk-leg-b" : undefined} />
      <g className="dk-bob">
        <path d="M34 30C52 25 112 27 140 27C148 27 153 21 158 15C166 7 180 9 185 15L197 22C201 24 200 30 195 31L179 33C171 34 165 40 161 46C157 51 150 53 142 53C110 55 70 54 50 52C34 52 26 46 28 38C29 34 31 31 34 30Z" />
      </g>
      <Leg x={58} y={49} len={9} rot={running ? 0 : -8} cls={running ? "dk-leg-a" : undefined} />
      <Leg x={136} y={50} len={8} rot={running ? 0 : -6} cls={running ? "dk-leg-a" : undefined} />
      <g className="dk-bob">
        <circle cx={181} cy={19} r={1.8} fill="currentColor" stroke="none" />
        <ellipse cx={197} cy={25.5} rx={3.4} ry={3} fill="currentColor" />
        {!roll && <path {...LINE} d="M193 31q-5 3-10 1" />}
        <path className="dk-ear" d="M168 14C161 17 159 30 162 38C164 43 171 42 172 36C173 28 174 20 172 14Z" />
        {roll && <PaperRoll x={186} y={35} rot={-14} />}
      </g>
    </g>
  );
}

function PaperRoll({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-20} y={-5.5} width={40} height={11} rx={5.5} />
      <ellipse cx={14.5} cy={0} rx={2.6} ry={5.5} />
      <path {...LINE} d="M14.5 0a1.2 1.2 0 1 1 1 -1.5" strokeWidth={1.2} />
      <path {...LINE} d="M-3 -5.5v11M0 -5.5v11" strokeWidth={1.4} />
      <path {...LINE} d="M-15 -2h7M-15 1.5h8" strokeWidth={1} opacity="0.7" />
    </g>
  );
}

export const DachshundMasthead = (p: ArtProps) => (
  <Svg {...p} vb="8 4 214 64" label="Dachshund carrying a rolled newspaper">
    <SideDog roll />
  </Svg>
);

export const DachshundFetch = ({ carrying, running, ...p }: ArtProps & { carrying?: boolean; running?: boolean }) => (
  <Svg {...p} vb="8 4 214 64" label={carrying ? "Dachshund running with the newspaper" : "Dachshund running"}>
    <SideDog running={running} roll={carrying} />
  </Svg>
);

export const DachshundSleep = (p: ArtProps) => (
  <Svg {...p} vb="10 14 140 58" label="Dachshund asleep, curled up">
    {/* curled body */}
    <path d="M46 66C26 52 46 22 86 22C120 22 142 40 138 60C137 64 133 66 128 66Z" />
    <path {...LINE} d="M104 34C120 38 128 50 122 62" />
    {/* back paw tucked */}
    <path d="M110 66c0-5 10-6 13-2c1 1.5 0 2-1 2Z" />
    {/* tail wrapping round the front */}
    <path {...LINE} d="M134 60C122 66 100 64 78 60" />
    {/* front paw under chin */}
    <path d="M40 66c-2-5 10-7 16-4c3 1.5 2 4 0 4Z" />
    {/* head resting on the floor */}
    <path d="M74 52C74 40 62 34 50 36C42 38 34 44 26 50C21 54 22 60 28 60L64 62C72 62 75 58 74 52Z" />
    <ellipse cx={24.5} cy={54.5} rx={3} ry={2.6} fill="currentColor" />
    <path {...LINE} d="M45 45q4 3 8 0" />
    {/* ear draped over */}
    <path className="dk-ear" d="M62 38C71 40 76 50 73 60C71 64 65 63 64 59C63 52 62 45 58 39Z" />
  </Svg>
);

export const DachshundStretch = (p: ArtProps) => (
  <Svg {...p} vb="8 4 220 62" label="Dachshund stretching in a play bow">
    <path {...LINE} d="M34 20C28 12 22 8 13 8" />
    <Leg x={40} y={30} len={26} rot={4} />
    <path d="M168 50H214Q219 50 219 54.5Q219 59 214 59H168Z" />
    <Leg x={54} y={32} len={24} rot={-4} />
    <path d="M34 18C42 10 60 10 68 16C100 24 140 34 168 38C172 32 176 26 182 22C188 17 198 17 202 21L216 28C220 30 219 36 214 36L200 37C192 38 188 44 186 50C184 56 178 61 170 61C140 58 110 46 70 36C60 34 50 38 40 34C30 30 28 24 34 18Z" />
    <path d="M176 55H220Q225 55 225 59Q225 62 220 62H176Z" />
    <path {...LINE} d="M219 58v3M215 58v3" strokeWidth={1.2} />
    <circle cx={203} cy={25} r={1.8} fill="currentColor" stroke="none" />
    <ellipse cx={216.5} cy={31.5} rx={3.2} ry={2.8} fill="currentColor" />
    <path className="dk-ear" d="M190 21C184 24 182 35 185 42C187 46 193 45 194 41C195 34 196 27 194 21Z" />
  </Svg>
);

export const DachshundTypewriter = (p: ArtProps) => (
  <Svg {...p} vb="0 10 196 96" label="Dachshund typing at a typewriter">
    {/* typewriter */}
    <rect x={140} y={28} width={36} height={36} rx={1} />
    <path {...LINE} d="M146 36h22M146 42h24M146 48h18M146 54h22" strokeWidth={1} opacity="0.7" />
    <rect x={128} y={58} width={62} height={10} rx={5} />
    <path d="M118 102L124 72Q126 68 132 68H182Q188 68 190 72L194 102Z" />
    <path {...LINE} d="M131 78h56M128 86h62M125 94h68" strokeWidth={2.4} strokeDasharray="0.1 6" />
    <path {...LINE} d="M184 63l8-6" />
    {/* tail and dog */}
    <path {...LINE} d="M34 96C22 99 12 95 8 86" />
    <Leg x={90} y={62} len={32} rot={-58} cls="dk-tap-a" />
    <path d="M30 100C22 86 30 70 50 64C66 58 80 50 88 42C90 34 94 28 100 26C106 22 116 22 120 27L132 33C136 35 135 41 130 41L116 42C108 44 104 50 102 56C100 66 96 78 90 86C84 94 76 100 66 100Z" />
    <path {...LINE} d="M38 98C36 86 50 78 60 84C66 88 66 96 62 99" />
    <path d="M60 100c0-5 10-6 14-3c2 1.5 1 3-1 3Z" />
    <Leg x={96} y={64} len={30} rot={-62} cls="dk-tap-b" />
    <circle cx={121} cy={31} r={1.8} fill="currentColor" stroke="none" />
    <ellipse cx={133} cy={37} rx={2.8} ry={2.5} fill="currentColor" />
    <path className="dk-ear" d="M106 25C99 28 98 40 101 47C103 51 109 50 110 46C111 39 112 32 110 25Z" />
  </Svg>
);

export const DachshundSit = (p: ArtProps) => (
  <Svg {...p} vb="0 12 140 92" label="Dachshund sitting up, ears perked">
    <path {...LINE} className="dk-wag" d="M34 96C22 99 12 95 8 86" />
    <Leg x={99} y={80} len={16} />
    <path d="M30 100C22 86 30 70 50 64C66 58 80 50 88 42C90 34 94 28 100 26C106 22 116 22 120 27L132 33C136 35 135 41 130 41L116 42C108 44 104 50 102 56C101 68 102 82 98 92C95 98 86 100 66 100Z" />
    <path {...LINE} d="M38 98C36 86 50 78 60 84C66 88 66 96 62 99" />
    <path d="M60 100c0-5 10-6 14-3c2 1.5 1 3-1 3Z" />
    <Leg x={91} y={88} len={8} />
    <circle cx={121} cy={31} r={1.8} fill="currentColor" stroke="none" />
    <ellipse cx={133} cy={37} rx={2.8} ry={2.5} fill="currentColor" />
    <path {...LINE} d="M130 41q-3 3-7 2" />
    <path className="dk-ear dk-perk" d="M106 25C99 26 95 36 96 43C97 47 103 47 105 43C107 37 110 31 110 25Z" />
  </Svg>
);

export const DachshundPeek = (p: ArtProps) => (
  <Svg {...p} vb="18 8 84 56" label="Dachshund peeking over the edge">
    <path d="M38 54C36 30 46 14 60 14C74 14 84 30 82 54Z" />
    <path {...LINE} d="M20 54H100" />
    <path d="M40 55c0-7 14-7 14 0ZM47 55v-3" />
    <path d="M66 55c0-7 14-7 14 0ZM73 55v-3" />
    <ellipse cx={60} cy={44} rx={11} ry={8.5} />
    <ellipse cx={60} cy={40} rx={4} ry={3} fill="currentColor" />
    <path {...LINE} d="M60 43v3.5M55 47.5q5 3.5 10 0" />
    <circle cx={51.5} cy={31} r={1.9} fill="currentColor" stroke="none" />
    <circle cx={68.5} cy={31} r={1.9} fill="currentColor" stroke="none" />
    <path {...LINE} d="M48 26q3-2 6 0M66 26q3-2 6 0" strokeWidth={1.4} />
    <path className="dk-ear" d="M46 21C35 22 29 34 29 47C29 56 35 60 39 55C41 46 43 35 49 26Z" />
    <path className="dk-ear dk-ear-r" d="M74 21C85 22 91 34 91 47C91 56 85 60 81 55C79 46 77 35 71 26Z" />
  </Svg>
);

export const PawStamp = ({ text = "SAUSAGE GAZETTE", ...p }: ArtProps & { text?: string }) => {
  const id = useId().replace(/:/g, "");
  const word = text.toUpperCase();
  const short = word.length <= 11; // short words go straight across a band; long ones curve over the top
  const band = short ? Math.min(16, 120 / Math.max(word.length, 1)) : 0;
  const bandLen = word.length * band * 0.62;
  const arcSize = Math.min(9, 150 / Math.max(word.length * 0.72, 1));
  return (
    <Svg {...p} size={p.size ?? 96} vb="0 0 100 100" label={`Stamp: ${text}`}
      style={{ color: "#c0392b", transform: "rotate(-8deg)", opacity: 0.9, ...p.style }}>
      <defs><path id={`arc${id}`} d="M22 70A33 33 0 1 1 78 70" /></defs>
      <circle cx={50} cy={50} r={46} fill="none" strokeWidth={2.6} />
      <circle cx={50} cy={50} r={39} fill="none" strokeWidth={1.2} />
      <g fill="currentColor" stroke="none" transform={short ? "translate(50 34) scale(0.62) translate(-50 -56)" : undefined}>
        <path d="M50 54c-7 0-13 6-13 11c0 4 3 6 7 5c3-1 4-2 6-2s3 1 6 2c4 1 7-1 7-5c0-5-6-11-13-11Z" />
        <ellipse cx={38} cy={49} rx={3.6} ry={4.8} transform="rotate(-25 38 49)" />
        <ellipse cx={45.5} cy={42} rx={3.8} ry={5.2} transform="rotate(-8 45.5 42)" />
        <ellipse cx={54.5} cy={42} rx={3.8} ry={5.2} transform="rotate(8 54.5 42)" />
        <ellipse cx={62} cy={49} rx={3.6} ry={4.8} transform="rotate(25 62 49)" />
      </g>
      {short ? (
        <>
          <path d="M6 52H94M6 74H94" fill="none" strokeWidth={1.6} />
          <text x={50} y={63 + band * 0.35} fill="currentColor" stroke="none" fontFamily="'Special Elite', monospace"
            fontSize={band} fontWeight={700} textAnchor="middle" letterSpacing={0.5}
            {...(bandLen > 72 ? { textLength: 72, lengthAdjust: "spacingAndGlyphs" } : {})}>{word}</text>
          <text x={50} y={86} fill="currentColor" stroke="none" fontFamily="'Special Elite', monospace" fontSize={7} textAnchor="middle">★ ★ ★</text>
        </>
      ) : (
        <>
          <text fill="currentColor" stroke="none" fontFamily="'Special Elite', monospace" fontSize={arcSize} letterSpacing={0.8}>
            <textPath href={`#arc${id}`} startOffset="50%" textAnchor="middle">{word}</textPath>
          </text>
          <text x={50} y={86} fill="currentColor" stroke="none" fontFamily="'Special Elite', monospace" fontSize={7} textAnchor="middle">★ ★ ★</text>
        </>
      )}
    </Svg>
  );
};
