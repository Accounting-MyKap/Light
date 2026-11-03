import { memo, type JSX } from 'react';
import type { DecorKind, Pond, Shape } from './maps';

/*
 * The drawings of Switchyard, in board units. The tracks are seen from above; everything that stands on the ground
 * (trains, stations, trees, rocks) is seen from the side, like the pieces of a toy railway. Each drawing stands on
 * its point 0,0.
 */

export const INK = '#0b0d1a';
const IRON = '#1a1d2c';

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

function Wheel({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={IRON} stroke="#3a3f58" strokeWidth={0.8} />
      <circle cx={x} cy={y} r={r * 0.36} fill={color} />
    </g>
  );
}

/**
 * The locomotive seen from the side, heading right, centered between its two ends on the track (34 long): cab with a
 * lit window, boiler, dome, chimney, headlamp and cowcatcher. `beam` is the id of the headlamp's gradient; without it
 * the lamp is off.
 */
export const SideLoco = memo(function SideLoco({ color, beam }: { color: string; beam?: string }) {
  return (
    <g>
      <ellipse cx={0} cy={4} rx={18} ry={3.2} fill="#000000" opacity={0.4} />
      <ellipse cx={0} cy={-11} rx={21} ry={17} fill={color} opacity={0.13} />
      {beam && <path d="M15 -13 L43 -22 Q47 -13 43 -4 Z" fill={`url(#${beam})`} />}
      <rect x={-21} y={-6.2} width={6} height={2.2} fill={IRON} />
      <rect x={-17} y={-5.6} width={30} height={2.8} rx={1} fill={IRON} />
      <rect x={-16} y={-24} width={12} height={21} rx={2} fill={color} />
      <rect x={-13.5} y={-20.5} width={7} height={7} rx={1.2} fill="#fff3c4" />
      <rect x={-18} y={-27.5} width={16.5} height={4} rx={1.6} fill={IRON} />
      <rect x={-5} y={-17.5} width={18} height={13} rx={6} fill={color} />
      <rect x={-3.5} y={-16.5} width={14.5} height={2.6} rx={1.3} fill="#ffffff" opacity={0.3} />
      <path d="M-2 -17 V-5 M8.5 -17 V-5" stroke={INK} strokeOpacity={0.28} strokeWidth={1} />
      <path d="M-0.4 -17 A3.3 3.3 0 0 1 6.2 -17 Z" fill={color} stroke={INK} strokeOpacity={0.35} strokeWidth={0.8} />
      <path d="M2 -17 V-22.5 L0 -27.8 H11 L9 -22.5 V-17 Z" fill={IRON} />
      <rect x={11.5} y={-16.5} width={3} height={11.5} rx={1} fill={IRON} />
      <circle cx={14.6} cy={-12.5} r={2.2} fill="#fff6c8" />
      <path d="M10 -3.6 L18.5 2.4 H8 Z" fill={IRON} />
      <Wheel x={-9.5} y={-0.8} r={4.7} color={color} />
      <Wheel x={1} y={-0.8} r={4.7} color={color} />
      <Wheel x={9.3} y={0.6} r={2.8} color={color} />
      <path d="M-9.5 -0.8 H1" stroke="#c9cfe6" strokeWidth={1.3} strokeLinecap="round" />
    </g>
  );
});

/** The wagon seen from the side, centered between its two ends (21 long), with the station's shape on a white disc. */
export const SideWagon = memo(function SideWagon({ color, shape }: { color: string; shape: Shape }) {
  return (
    <g>
      <ellipse cx={0} cy={4} rx={12} ry={3} fill="#000000" opacity={0.4} />
      <ellipse cx={0} cy={-10} rx={14} ry={13} fill={color} opacity={0.13} />
      <rect x={-11} y={-20.5} width={22} height={3.6} rx={1.6} fill={IRON} />
      <rect x={-10} y={-17.5} width={20} height={14.5} rx={2.5} fill={color} />
      <rect x={-10} y={-17.5} width={20} height={3} rx={1.5} fill="#ffffff" opacity={0.22} />
      <circle cx={0} cy={-10} r={5.6} fill="#f6f7ff" />
      <g transform="translate(0 -10)">
        <ShapeMark shape={shape} size={3.9} fill={INK} />
      </g>
      <Wheel x={-5} y={0} r={3.3} color={color} />
      <Wheel x={5} y={0} r={3.3} color={color} />
    </g>
  );
});

/**
 * The locomotive coming toward the viewer: cab behind, the round smokebox door with the station's shape on its plate,
 * chimney on top, two lamps on the buffer beam and the cowcatcher. `beam` lights the track ahead (down the board).
 */
export const FrontLoco = memo(function FrontLoco({ color, shape, beam }: { color: string; shape: Shape; beam?: string }) {
  return (
    <g>
      <ellipse cx={0} cy={3.5} rx={15} ry={3} fill="#000000" opacity={0.4} />
      <ellipse cx={0} cy={-14} rx={19} ry={21} fill={color} opacity={0.13} />
      {beam && <path d="M-9 -3 L-17 30 Q0 36 17 30 L9 -3 Z" fill={`url(#${beam})`} />}
      <rect x={-14} y={-31} width={28} height={20} rx={3} fill={color} />
      <rect x={-12} y={-27.5} width={5.5} height={5} rx={1} fill="#fff3c4" />
      <rect x={6.5} y={-27.5} width={5.5} height={5} rx={1} fill="#fff3c4" />
      <rect x={-15.5} y={-34.5} width={31} height={4} rx={1.6} fill={IRON} />
      <rect x={-12} y={-22} width={24} height={19} rx={3} fill={color} />
      <rect x={-12} y={-22} width={24} height={3} rx={1.5} fill="#ffffff" opacity={0.22} />
      <rect x={-3} y={-30} width={6} height={9} fill={IRON} />
      <rect x={-4.6} y={-34} width={9.2} height={4} rx={1} fill={IRON} />
      <circle cx={0} cy={-12.5} r={9.5} fill={IRON} stroke="#3a3f58" strokeWidth={1} />
      <circle cx={0} cy={-12.5} r={6} fill="#f6f7ff" />
      <g transform="translate(0 -12.5)">
        <ShapeMark shape={shape} size={4.1} fill={INK} />
      </g>
      <rect x={-14} y={-4.5} width={28} height={3.5} rx={1} fill={IRON} />
      <circle cx={-8.5} cy={-2.8} r={1.9} fill="#fff6c8" />
      <circle cx={8.5} cy={-2.8} r={1.9} fill="#fff6c8" />
      <ellipse cx={-9.5} cy={0.8} rx={2.6} ry={4} fill={IRON} />
      <ellipse cx={9.5} cy={0.8} rx={2.6} ry={4} fill={IRON} />
      <path d="M-8 -1 H8 L5 4 H-5 Z" fill={IRON} />
    </g>
  );
});

/** The wagon seen from the front, behind its locomotive. */
export const FrontWagon = memo(function FrontWagon({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx={0} cy={3.5} rx={13} ry={2.8} fill="#000000" opacity={0.35} />
      <rect x={-11} y={-21} width={22} height={3.6} rx={1.6} fill={IRON} />
      <rect x={-10} y={-18} width={20} height={15} rx={2.5} fill={color} />
      <rect x={-10} y={-18} width={20} height={3} rx={1.5} fill="#ffffff" opacity={0.22} />
      <ellipse cx={-7} cy={0.5} rx={2.4} ry={3.6} fill={IRON} />
      <ellipse cx={7} cy={0.5} rx={2.4} ry={3.6} fill={IRON} />
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

/**
 * The stone portal the trains come out of, set in a grassy mound, centered on the mouth of the tunnel and facing down
 * (the board turns it to face right or left for a tunnel on a side).
 */
export const TunnelPortal = memo(function TunnelPortal() {
  return (
    <g>
      <ellipse cx={0} cy={-26} rx={54} ry={36} fill="#16302b" />
      <ellipse cx={-10} cy={-36} rx={34} ry={20} fill="#1d3d34" opacity={0.8} />
      <path d="M-46 -14 q4 -6 8 -1 M40 -18 q4 -6 8 -1 M-28 -50 q4 -6 8 -1" stroke="#3c8a62" strokeWidth={1.4} fill="none" />
      <ellipse cx={0} cy={6} rx={38} ry={6} fill="#000000" opacity={0.3} />
      <path d="M-32 8 V-14 A32 32 0 0 1 32 -14 V8 Z" fill="#2b3150" stroke="#4a5280" strokeWidth={1.5} />
      {/* Stones around the arch. */}
      <path
        d="M-32 -4 H-21 M21 -4 H32 M-31 -24 L-21 -18 M31 -24 L21 -18 M-14 -42 L-10 -33 M14 -42 L10 -33 M0 -46 V-36"
        stroke="#4a5280"
        strokeWidth={1.3}
      />
      <path d="M-20 8 V-14 A20 20 0 0 1 20 -14 V8 Z" fill="#04050c" />
      <path d="M-20 -14 A20 20 0 0 1 20 -14" fill="none" stroke="#000000" strokeOpacity={0.6} strokeWidth={3} />
    </g>
  );
});

/* ---------------------------------------------------------------------------------------------- the night meadow */

const LEAF_DARK = '#1c4f3f';
const LEAF = '#246a50';
const LEAF_LIGHT = '#2f8462';
const BARK = '#4a3530';

function Pine({ variant }: { variant: 0 | 1 }) {
  const tint = variant === 0 ? LEAF : '#22625e';
  return (
    <g>
      <ellipse cx={0} cy={0} rx={11} ry={2.8} fill="#000000" opacity={0.3} />
      <rect x={-2} y={-7} width={4} height={7} rx={1} fill={BARK} />
      <path d="M0 -36 L11 -20 H7 L14 -7 H-14 L-7 -20 H-11 Z" fill={tint} />
      <path d="M0 -36 L-11 -20 H-7 L-14 -7 H-4 L0 -36 Z" fill={LEAF_DARK} opacity={0.75} />
      <path d="M0 -36 L5 -28" stroke={LEAF_LIGHT} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

function RoundTree({ variant }: { variant: 0 | 1 }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={10} ry={2.6} fill="#000000" opacity={0.3} />
      <rect x={-2} y={-12} width={4} height={12} rx={1} fill={BARK} />
      <circle cx={0} cy={-19} r={11} fill={variant === 0 ? LEAF : '#2a6a4a'} />
      <circle cx={-4.5} cy={-23} r={6} fill={LEAF_LIGHT} opacity={0.55} />
      <circle cx={5} cy={-15} r={5.5} fill={LEAF_DARK} opacity={0.6} />
    </g>
  );
}

function Bush({ variant }: { variant: 0 | 1 }) {
  return (
    <g>
      <ellipse cx={0} cy={0.5} rx={11} ry={2.4} fill="#000000" opacity={0.3} />
      <circle cx={-5} cy={-4} r={5.5} fill={LEAF_DARK} />
      <circle cx={4.5} cy={-4} r={5.5} fill={LEAF} />
      <circle cx={0} cy={-7.5} r={6} fill={LEAF} />
      <circle cx={-1.5} cy={-9.5} r={2.6} fill={LEAF_LIGHT} opacity={0.6} />
      {variant === 1 && (
        <g fill="#ff8fa3">
          <circle cx={-4} cy={-6} r={1.1} />
          <circle cx={3} cy={-8} r={1.1} />
          <circle cx={5} cy={-3} r={1.1} />
        </g>
      )}
    </g>
  );
}

function Rock({ variant }: { variant: 0 | 1 }) {
  return (
    <g>
      <ellipse cx={0} cy={0.5} rx={9} ry={2} fill="#000000" opacity={0.3} />
      {variant === 0 ? (
        <>
          <path d="M-8 0 L-6 -6 L-1 -9 L5 -7 L8 0 Z" fill="#4b5370" />
          <path d="M-6 -6 L-1 -9 L5 -7 L1 -4 Z" fill="#646d90" />
        </>
      ) : (
        <>
          <path d="M-9 0 L-7 -4 L-2 -6 L2 -5 L4 -2 L7 -3 L9 0 Z" fill="#454c68" />
          <path d="M-7 -4 L-2 -6 L2 -5 L-2 -3 Z" fill="#5d6687" />
        </>
      )}
    </g>
  );
}

const PETALS = ['#ffd6e8', '#fff2a8', '#cfc2ff', '#ffffff'];

function Flowers({ variant }: { variant: 0 | 1 }) {
  const spots: [number, number][] = [
    [-4, -1],
    [0, -3],
    [4, -1],
    [-2, 2],
    [3, 2.5],
  ];
  return (
    <g>
      {spots.map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y} v3`} stroke="#3c8a62" strokeWidth={0.8} />
          <circle cx={x} cy={y} r={1.5} fill={PETALS[(i + variant) % PETALS.length]} />
        </g>
      ))}
    </g>
  );
}

function Grass({ variant }: { variant: 0 | 1 }) {
  return (
    <path
      d={variant === 0 ? 'M-4 0 Q-4 -4 -6 -7 M0 0 Q0 -5 1 -9 M4 0 Q4 -4 6 -6' : 'M-3 0 Q-2 -5 -4 -8 M2 0 Q1 -4 3 -7'}
      stroke="#3c8a62"
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
    />
  );
}

const DECOR: Record<DecorKind, (props: { variant: 0 | 1 }) => JSX.Element> = {
  pine: Pine,
  tree: RoundTree,
  bush: Bush,
  rock: Rock,
  flowers: Flowers,
  grass: Grass,
};

/** A plant or a stone, standing on x, y. */
export function DecorView({ kind, x, y, scale, variant }: { kind: DecorKind; x: number; y: number; scale: number; variant: 0 | 1 }) {
  const Drawing = DECOR[kind];
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(2)})`}>
      <Drawing variant={variant} />
    </g>
  );
}

/** A pond seen from above, with the moon in it, a lily pad and reeds on one bank. */
export function PondView({ pond, water }: { pond: Pond; water: string }) {
  const { x, y, rx, ry } = pond;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx + 3} ry={ry + 3} fill="#1a3a33" />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${water})`} stroke="#2a5a6a" strokeWidth={1.4} />
      <ellipse cx={x - rx * 0.25} cy={y - ry * 0.2} rx={rx * 0.42} ry={ry * 0.2} fill="#ffffff" opacity={0.08} />
      <circle cx={x + rx * 0.28} cy={y - ry * 0.1} r={Math.min(5, ry * 0.3)} fill="#f4f1d0" opacity={0.55} />
      <path
        d={`M${x - rx * 0.35} ${y + ry * 0.3} a4.5 3 0 1 0 0.1 0 Z`}
        fill="#2f8462"
        transform={`rotate(-12 ${x - rx * 0.35} ${y + ry * 0.3})`}
      />
      <g stroke="#3c7a55" strokeWidth={1.3} strokeLinecap="round">
        <path d={`M${x + rx * 0.82} ${y + ry * 0.6} l-1 -12`} />
        <path d={`M${x + rx * 0.9} ${y + ry * 0.45} l1 -10`} />
        <path d={`M${x + rx * 0.72} ${y + ry * 0.72} l-2 -9`} />
      </g>
      <g fill="#7a5544">
        <rect x={x + rx * 0.82 - 2.2} y={y + ry * 0.6 - 15} width={2.6} height={5} rx={1.3} />
        <rect x={x + rx * 0.9 - 0.6} y={y + ry * 0.45 - 12.5} width={2.6} height={5} rx={1.3} />
      </g>
    </g>
  );
}
