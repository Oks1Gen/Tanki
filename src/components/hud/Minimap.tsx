import type { MinimapEntity } from "../../types";
import { MAP_HALF } from "../../constants";

const SIZE = 140;
const HALF = SIZE / 2;
const SCALE = SIZE / (MAP_HALF * 2.4);

export default function Minimap({ entities }: { entities: MinimapEntity[] }) {
  return (
    <div
      className="absolute left-1/2 top-2 -translate-x-1/2 pointer-events-none"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <rect x="0" y="0" width={SIZE} height={SIZE} fill="rgba(0,0,0,0.55)" rx="3" />
        <rect x="0" y="0" width={SIZE} height={SIZE} fill="none" stroke="rgba(182,217,76,0.3)" strokeWidth="1" rx="3" />
        {entities.map((e, i) => {
          const x = HALF - e.x * SCALE;  // mirror
          const y = HALF - e.z * SCALE;  // flip
          if (x < 2 || x > SIZE - 2 || y < 2 || y > SIZE - 2) return null;
          const size = e.isPlayer ? 5 : 3;
          const color = e.dead ? "rgba(80,80,80,0.3)" : e.isPlayer ? "#b6d94c" : e.isEnemy ? "#ef4444" : "#3b82f6";
          return (
            <polygon
              key={i}
              points={pointTriangle(x, y, size, e.heading)}
              fill={color}
              opacity={e.dead ? 0.2 : 0.85}
            />
          );
        })}
        <circle cx={HALF} cy={HALF} r="2" fill="#b6d94c" opacity="0.6" />
      </svg>
    </div>
  );
}

function pointTriangle(cx: number, cy: number, r: number, headingDeg: number): string {
  const rad = (headingDeg - 90) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const tip = [cx + cos * r * 1.2, cy + sin * r * 1.2];
  const bl = [cx + Math.cos(rad + 2.2) * r, cy + Math.sin(rad + 2.2) * r];
  const br = [cx + Math.cos(rad - 2.2) * r, cy + Math.sin(rad - 2.2) * r];
  return `${tip[0]},${tip[1]} ${bl[0]},${bl[1]} ${br[0]},${br[1]}`;
}
