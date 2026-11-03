import { memo } from 'react';
import type { Shape } from './maps';

/*
 * The drawings of Switchyard, in board units. Trains are seen from above and drawn heading to the right (0°): the
 * board rotates them. Stations and the tunnel are seen from the front, like the icons of a map.
 */

export const INK = '#0b0d1a';

/** A shape centered on 0,0 that fits in a circle of radius `size`. */
export function ShapeMark({ shape, size, fill = INK }: { shape: Shape; size: number; fill?: string }) {
  const s = size;
  switch (shape) {
    case 'circle':
      return <circle r={s * 0.82} fill={fill} />;
    case 'square':
      return <rect x={-s * 0.72} y={-s * 0.72} width={s * 1.44} height={s * 1.44} rx={s * 0.18} fill={fill} />;
    case 'triangle':
      return <path d={`M0 ${-s * 0.9} L${s * 0.92} ${s * 0.68} L${-s * 0.92} ${s * 0.68} Z`} fill={fill} strokeLinejoin="round" />;
    case 'diamond':
      return <path d={`M0 ${-s} L${s * 0.82} 0 L0 ${s} L${-s * 0.82} 0 Z`} fill={fill} />;
    case 'star': {
      const points = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? s : s * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      });
      return <polygon points={points.join(' ')} fill={fill} />;
    }
    case 'heart':
      return (
        <path
          d={`M0 ${s * 0.85} C${-s * 1.25} ${-s * 0.05} ${-s * 0.62} ${-s * 1.05} 0 ${-s * 0.4} C${s * 0.62} ${-s * 1.05} ${s * 1.25} ${-s * 0.05} 0 ${s * 0.85} Z`}
          fill={fill}
        />
      );
    case 'cross': {
      const a = s * 0.3;
      return (
        <path
          d={`M${-a} ${-s * 0.85} H${a} V${-a} H${s * 0.85} V${a} H${a} V${s * 0.85} H${-a} V${a} H${-s * 0.85} V${-a} H${-a} Z`}
          fill={fill}
        />
      );
    }
  }
}

/** The locomotive, 28 long and 16 wide, centered on 0,0 and heading right. `beam` is the id of the headlight's
    gradient; without it the headlight is off (a train inside its station). */
export const Locomotive = memo(function Locomotive({ color, beam }: { color: string; beam?: string }) {
  return (
    <g>
      <ellipse rx={21} ry={13} fill={color} opacity={0.16} />
      {/* Headlight beam on the track ahead. */}
      {beam && <path d="M14 0 L38 -10 Q42 0 38 10 Z" fill={`url(#${beam})`} />}
      <rect x={-14} y={-8} width={28} height={16} rx={5} fill={color} />
      {/* Boiler: a lighter cylinder with bands. */}
      <rect x={-5} y={-5.5} width={18} height={11} rx={5.5} fill="#ffffff" opacity={0.26} />
      <path d="M1 -5.2 V5.2 M7 -5.4 V5.4" stroke={INK} strokeOpacity={0.28} strokeWidth={1} />
      {/* Cab at the back, with its roof window. */}
      <rect x={-14} y={-8} width={10} height={16} rx={3} fill={INK} opacity={0.3} />
      <rect x={-12} y={-5} width={6} height={10} rx={1.6} fill="#fff7d6" opacity={0.75} />
      {/* Chimney. */}
      <circle cx={8.5} cy={0} r={3.4} fill="#1a1d2c" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={0.9} />
      <circle cx={8.5} cy={0} r={1.5} fill="#05060b" />
      {/* Buffer beam and headlight. */}
      <rect x={13} y={-7} width={2.6} height={14} rx={1} fill={INK} opacity={0.55} />
      <circle cx={15.4} cy={0} r={2.3} fill="#fff6c8" />
    </g>
  );
});

/** The wagon, 20 long and 15 wide, centered on 0,0 and heading right. Its shape is drawn apart, kept upright. */
export const Wagon = memo(function Wagon({ color }: { color: string }) {
  return (
    <g>
      <ellipse rx={15} ry={11} fill={color} opacity={0.14} />
      <rect x={-10} y={-7.5} width={20} height={15} rx={4} fill={color} />
      <rect x={-8} y={-5.5} width={16} height={11} rx={3} fill="#ffffff" opacity={0.18} />
    </g>
  );
});

/** A station seen from the front, centered where its track ends. */
export const StationHouse = memo(function StationHouse({
  color,
  shape,
  glow,
}: {
  color: string;
  shape: Shape;
  /** Id of the radial gradient of this station's color. */
  glow: string;
}) {
  return (
    <g>
      <circle r={36} fill={`url(#${glow})`} />
      <ellipse cx={0} cy={17} rx={24} ry={4.5} fill="#000000" opacity={0.35} />
      {/* Walls with a lighter band, then the roof. */}
      <rect x={-18} y={-10} width={36} height={26} rx={4} fill={color} />
      <rect x={-18} y={-10} width={36} height={6} fill="#ffffff" opacity={0.2} />
      <path d="M-23 -9 L0 -27 L23 -9 Z" fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-23 -9 L0 -27 L23 -9 Z" fill={INK} opacity={0.32} strokeLinejoin="round" />
      <path d="M-19.5 -11.5 L0 -26" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
      {/* The sign: the station's shape in a light disc. */}
      <circle cx={0} cy={4} r={9.5} fill="#f6f7ff" />
      <g transform="translate(0 4)">
        <ShapeMark shape={shape} size={6.2} fill={INK} />
      </g>
    </g>
  );
});

/** The stone portal the trains come out of, centered on the mouth of the tunnel and facing down. */
export const TunnelPortal = memo(function TunnelPortal() {
  return (
    <g>
      <ellipse cx={0} cy={6} rx={30} ry={6} fill="#000000" opacity={0.3} />
      <path d="M-25 8 V-12 A25 25 0 0 1 25 -12 V8 Z" fill="#2b3150" stroke="#4a5280" strokeWidth={1.5} />
      {/* Stones around the arch. */}
      <path
        d="M-25 -4 H-17 M17 -4 H25 M-24 -20 L-16.5 -16 M24 -20 L16.5 -16 M-11 -34 L-8 -27 M11 -34 L8 -27 M0 -37 V-29"
        stroke="#4a5280"
        strokeWidth={1.3}
      />
      <path d="M-15 8 V-12 A15 15 0 0 1 15 -12 V8 Z" fill="#04050c" />
      <path d="M-15 -12 A15 15 0 0 1 15 -12" fill="none" stroke="#000000" strokeOpacity={0.6} strokeWidth={3} />
    </g>
  );
});

/** A round tree seen from above. */
export function TreeTop({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x + r * 0.25} cy={y + r * 0.3} r={r} fill="#000000" opacity={0.28} />
      <circle cx={x} cy={y} r={r} fill="#15382e" />
      <circle cx={x - r * 0.28} cy={y - r * 0.3} r={r * 0.55} fill="#1f4d3d" />
    </g>
  );
}
