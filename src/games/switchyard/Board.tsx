import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DecorView, FrontLoco, FrontWagon, INK, PondView, SideLoco, SideWagon, StationHouse, TunnelPortal } from './art';
import { TRAIN_LENGTH, type Arrival, type Train } from './engine';
import { headingName, offsetPolyline, type Point } from './geometry';
import { BOARD, STATION_STYLES, type TrackMap, type Tunnel } from './maps';
import { trainSprite, type CarSprite } from './sprite';
import styles from './switchyard.module.css';

/** How long the ring and the mark of an arrival stay on the station. */
export const ARRIVAL_SHOW_MS = 900;

const RAIL_OFFSET = 3.6;
/** How far a train has to run before its front clears the tunnel's portal. */
const TUNNEL_EXIT = 44;

export interface PuffView {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
}

export interface BoardProps {
  map: TrackMap;
  switches: readonly (0 | 1)[];
  trains: readonly Train[];
  puffs?: readonly PuffView[];
  /** Recent arrivals, drawn as a ring and a mark on their station. */
  arrivals?: readonly Arrival[];
  /** Game time, for the arrival animations. */
  now?: number;
  /** Flips a switch: each one gets a button. */
  onToggle: (index: number) => void;
  /** No smoke at all, and the arrival marks stand still. */
  reducedMotion?: boolean;
  /** A phone too slow for the decoration: `data-lite` on the board, where the CSS stops its decorative animations. */
  lite?: boolean;
  /** Width in CSS pixels; without it the board takes the width of its box (up to 420 px). */
  width?: number;
}

const pathOf = (points: readonly Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

/**
 * The track map, in three stacked drawings so the browser only repaints what moves: behind, the meadow, the tracks
 * and the switches; in the middle, the trains, their smoke and the arrival marks; in front, the stations and the
 * tunnel, which the trains roll into and out of. The fireflies and the beacons of the switches are page elements
 * animated by the browser on its own. Each switch gets a transparent button on top.
 */
export function Board({
  map,
  switches,
  trains,
  puffs = [],
  arrivals = [],
  now = 0,
  onToggle,
  reducedMotion = false,
  lite = false,
  width,
}: BoardProps) {
  const { t } = useTranslation();
  const uid = `sy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const viewBox = `0 0 ${BOARD.width} ${BOARD.height}`;

  return (
    <div
      className={styles.board}
      style={width === undefined ? undefined : { width }}
      role="group"
      aria-label={t('games.switchyard.board')}
      data-lite={lite ? '' : undefined}
    >
      <svg className={styles.layer} viewBox={viewBox} aria-hidden="true">
        <Defs uid={uid} />
        <g clipPath={`url(#${uid}-board)`}>
          <Ground map={map} uid={uid} />
        </g>
        <Tracks map={map} switches={switches} />
        <SwitchDisks map={map} switches={switches} />
      </svg>
      <svg className={styles.layer} viewBox={viewBox} aria-hidden="true">
        {trains.map((train) => (
          <TrainView key={train.id} map={map} train={train} uid={uid} />
        ))}
        {arrivals.map((a) => (
          <ArrivalMark key={a.trainId} at={map.stations[a.station].at} arrival={a} now={now} still={reducedMotion} />
        ))}
      </svg>
      {/* The smoke rises from the chimneys, above the trains, on a canvas cheap enough to redraw on every frame. It is
          decoration, so reduced motion has none. */}
      {!reducedMotion && <SmokeCanvas puffs={puffs} width={width} />}
      <svg className={styles.layer} viewBox={viewBox} aria-hidden="true">
        <Front map={map} uid={uid} />
      </svg>
      <Fireflies map={map} />
      <SwitchButtons map={map} switches={switches} onToggle={onToggle} />
    </div>
  );
}

/** A transparent button over each switch, named after its number and where it points. */
const SwitchButtons = memo(function SwitchButtons({
  map,
  switches,
  onToggle,
}: {
  map: TrackMap;
  switches: readonly (0 | 1)[];
  onToggle: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {map.switches.map((sw) => {
        const option = switches[sw.id];
        const direction = t(`games.switchyard.directions.${headingName(sw.exitAngles[option])}`);
        return (
          <button
            key={sw.id}
            type="button"
            className={styles.switch}
            style={{ left: `${(sw.at.x / BOARD.width) * 100}%`, top: `${(sw.at.y / BOARD.height) * 100}%` }}
            data-switch={sw.id}
            data-option={option}
            aria-label={t('games.switchyard.switch', { n: sw.id + 1, direction })}
            onClick={() => onToggle(sw.id)}
          >
            {sw.id < 9 && (
              <span className={styles.key} aria-hidden="true">
                {sw.id + 1}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
});

/** A soft round puff, drawn once and stamped for every puff of smoke. */
function puffStamp(): HTMLCanvasElement {
  const size = 64;
  const stamp = document.createElement('canvas');
  stamp.width = size;
  stamp.height = size;
  const ctx = stamp.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(241, 243, 255, 1)');
    g.addColorStop(0.55, 'rgba(223, 228, 247, 0.8)');
    g.addColorStop(1, 'rgba(201, 207, 230, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return stamp;
}

/** The smoke of the game, redrawn on every frame without touching the page's elements. */
function SmokeCanvas({ puffs, width }: { puffs: readonly PuffView[]; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stamp = useMemo(() => puffStamp(), []);
  const cssWidth = width ?? BOARD.width;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cssWidth * ratio);
    const h = Math.round(((cssWidth * BOARD.height) / BOARD.width) * ratio);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const scale = w / BOARD.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const p of puffs) {
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(stamp, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
  }, [puffs, cssWidth, stamp]);

  return <canvas ref={ref} className={styles.layer} aria-hidden="true" />;
}

/**
 * The portal is drawn facing down; turn it to face the way the trains come out, set a little back from the mouth. On
 * a side it is drawn a little shallower, so it fits between the mouth and the edge of the board.
 */
function portalTransform({ at, angle }: Tunnel): string {
  const rad = (angle * Math.PI) / 180;
  const x = at.x - 4 * Math.cos(rad);
  const y = at.y - 4 * Math.sin(rad);
  const depth = angle === 90 ? 1 : 0.8;
  return `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle - 90}) scale(1 ${depth})`;
}

/** The stations and the tunnel, in front of the trains. */
const Front = memo(function Front({ map, uid }: { map: TrackMap; uid: string }) {
  return (
    <g>
      {map.stations.map((st) => {
        const style = STATION_STYLES[st.style];
        return (
          <g
            key={st.id}
            transform={`translate(${st.at.x} ${st.at.y})`}
            data-station-id={st.id}
            data-route={st.route.map(([sw, option]) => `${sw}:${option}`).join(' ')}
          >
            <StationHouse color={style.color} shape={style.shape} glow={`${uid}-glow-${st.style}`} />
          </g>
        );
      })}
      <g transform={portalTransform(map.tunnel)}>
        <TunnelPortal />
      </g>
    </g>
  );
});

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      {/* The meadow keeps to the rounded board; only this still drawing is clipped. */}
      <clipPath id={`${uid}-board`}>
        <rect width={BOARD.width} height={BOARD.height} rx={24} />
      </clipPath>
      <linearGradient id={`${uid}-beam`} x1="15" y1="0" x2="45" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${uid}-beam-front`} x1="0" y1="-3" x2="0" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.45" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </linearGradient>
      {STATION_STYLES.map((style, i) => (
        <radialGradient key={i} id={`${uid}-glow-${i}`}>
          <stop offset="0" stopColor={style.color} stopOpacity="0.5" />
          <stop offset="1" stopColor={style.color} stopOpacity="0" />
        </radialGradient>
      ))}
      <radialGradient id={`${uid}-ground`} cx="0.5" cy="0.4" r="0.75">
        <stop offset="0" stopColor="#13282b" />
        <stop offset="1" stopColor="#0a151b" />
      </radialGradient>
      <radialGradient id={`${uid}-water`} cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#1b4a63" />
        <stop offset="1" stopColor="#0c263a" />
      </radialGradient>
      <pattern id={`${uid}-dots`} width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.9" fill="#ffffff" opacity="0.06" />
      </pattern>
    </defs>
  );
}

const Ground = memo(function Ground({ map, uid }: { map: TrackMap; uid: string }) {
  return (
    <g>
      <rect width={BOARD.width} height={BOARD.height} rx={24} fill={`url(#${uid}-ground)`} />
      <rect width={BOARD.width} height={BOARD.height} rx={24} fill={`url(#${uid}-dots)`} />
      <rect
        x={0.75}
        y={0.75}
        width={BOARD.width - 1.5}
        height={BOARD.height - 1.5}
        rx={23.5}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.08}
        strokeWidth={1.5}
      />
      {map.patches.map((p, i) => (
        <ellipse key={`patch${i}`} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="#1a3a33" opacity={0.45} />
      ))}
      {map.ponds.map((pond, i) => (
        <PondView key={`pond${i}`} pond={pond} water={`${uid}-water`} />
      ))}
      {map.decor.map((d, i) => (
        <DecorView key={i} {...d} />
      ))}
    </g>
  );
});

/** Fireflies over the meadow; they twinkle unless the person asked for less motion. */
const Fireflies = memo(function Fireflies({ map }: { map: TrackMap }) {
  return (
    <>
      {map.fireflies.map((f, i) => (
        <span
          key={i}
          className={styles.firefly}
          style={{
            left: `${(f.x / BOARD.width) * 100}%`,
            top: `${(f.y / BOARD.height) * 100}%`,
            animationDelay: `${((i * 0.73) % 3).toFixed(2)}s`,
          }}
          aria-hidden="true"
        />
      ))}
    </>
  );
});

interface TrackPaths {
  id: number;
  center: string;
  rails: [string, string];
}

/** A segment is lit when the switch it leaves points to it (the first one, out of the tunnel, always is). */
function isLit(map: TrackMap, switches: readonly (0 | 1)[], segmentId: number): boolean {
  const from = map.segments[segmentId].from;
  if (from === 'tunnel') return true;
  return map.switches[from.switch].exits[switches[from.switch]] === segmentId;
}

const Tracks = memo(function Tracks({ map, switches }: { map: TrackMap; switches: readonly (0 | 1)[] }) {
  const paths = useMemo<TrackPaths[]>(
    () =>
      map.segments.map((s) => ({
        id: s.id,
        center: pathOf(s.line.points),
        rails: [pathOf(offsetPolyline(s.line.points, RAIL_OFFSET)), pathOf(offsetPolyline(s.line.points, -RAIL_OFFSET))],
      })),
    [map],
  );
  const lit = paths.filter((p) => isLit(map, switches, p.id));
  const dim = paths.filter((p) => !isLit(map, switches, p.id));
  return (
    <g fill="none" strokeLinejoin="round">
      {paths.map((p) => (
        <path key={`bed${p.id}`} d={p.center} stroke="#1b2142" strokeWidth={17} strokeLinecap="round" />
      ))}
      {paths.map((p) => (
        <path key={`ties${p.id}`} d={p.center} stroke="#4a4160" strokeWidth={13} strokeDasharray="2.6 5.4" />
      ))}
      {dim.map((p) => (
        <g key={`dim${p.id}`} stroke="#4c5478" strokeWidth={1.8} strokeLinecap="round">
          <path d={p.rails[0]} />
          <path d={p.rails[1]} />
        </g>
      ))}
      {lit.map((p) => (
        <path key={`glow${p.id}`} className={styles.routeGlow} d={p.center} strokeWidth={9} strokeLinecap="round" />
      ))}
      {lit.map((p) => (
        <g key={`lit${p.id}`} stroke="#e4e9ff" strokeWidth={1.9} strokeLinecap="round">
          <path d={p.rails[0]} />
          <path d={p.rails[1]} />
        </g>
      ))}
    </g>
  );
});

const SwitchDisks = memo(function SwitchDisks({ map, switches }: { map: TrackMap; switches: readonly (0 | 1)[] }) {
  return (
    <>
      {map.switches.map((sw) => (
        <SwitchDisk key={sw.id} at={sw.at} angle={sw.exitAngles[switches[sw.id]]} />
      ))}
    </>
  );
});

/** The round point of a switch: a dark disc with a ring, and an arrow toward the exit it points to. */
function SwitchDisk({ at, angle }: { at: Point; angle: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <circle className={styles.halo} r={23} />
      <circle className={styles.disk} r={15} />
      <g className={styles.arrow} style={{ transform: `rotate(${angle}deg)` }}>
        <path
          d="M-7 0 H6.5 M1.5 -5.5 L7 0 L1.5 5.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

const carTransform = (car: CarSprite) =>
  `translate(${car.x.toFixed(2)} ${car.y.toFixed(2)}) rotate(${car.rotation.toFixed(1)}) scale(${car.facing} 1)`;

/** A train in two cars: the wagon first, so a locomotive coming toward us is drawn in front of it. */
function TrainView({ map, train, uid }: { map: TrackMap; train: Train; uid: string }) {
  const style = STATION_STYLES[map.stations[train.station].style];
  const { loco, wagon } = trainSprite(map, train);
  // The headlamp is off while the train is still in the tunnel (its beam would shine through the stones) and once
  // it is inside its station.
  const lampOn = !train.arrived && (train.route.length > 1 || train.distance > TUNNEL_EXIT);
  const beam = lampOn ? `${uid}-${loco.view === 'side' ? 'beam' : 'beam-front'}` : undefined;

  // Rolling in under the station: the train fades as it disappears into the building.
  const segmentLength = map.segments[train.route[train.route.length - 1]].line.length;
  const inside = train.arrived ? Math.min(1, (2 * (train.distance - segmentLength)) / TRAIN_LENGTH) : 0;

  return (
    <g data-train={train.id} data-station={train.station} opacity={1 - inside}>
      <g data-car="wagon" data-view={wagon.view} transform={carTransform(wagon)}>
        {wagon.view === 'side' ? <SideWagon color={style.color} shape={style.shape} /> : <FrontWagon color={style.color} />}
      </g>
      <g data-car="loco" data-view={loco.view} transform={carTransform(loco)}>
        {loco.view === 'side' ? (
          <SideLoco color={style.color} beam={beam} />
        ) : (
          <FrontLoco color={style.color} shape={style.shape} beam={beam} />
        )}
      </g>
    </g>
  );
}

function ArrivalMark({ at, arrival, now, still }: { at: Point; arrival: Arrival; now: number; still: boolean }) {
  const k = Math.min(1, Math.max(0, (now - arrival.at) / ARRIVAL_SHOW_MS));
  const color = arrival.correct ? '#4dffa6' : '#ff5d7a';
  const ring = still ? 26 : 20 + 18 * k;
  const rise = still ? 0 : -10 * k;
  return (
    <g data-arrival={arrival.correct ? 'correct' : 'wrong'} transform={`translate(${at.x} ${at.y})`}>
      <circle r={ring} fill="none" stroke={color} strokeWidth={3} opacity={1 - k} />
      {/* Up and to the side, clear of the track the train comes in on. */}
      <g transform={`translate(${at.x > BOARD.width - 60 ? -26 : 26} ${-30 + rise})`} opacity={k < 0.7 ? 1 : (1 - k) / 0.3}>
        <circle r={10} fill={color} />
        <path
          d={arrival.correct ? 'M-4.5 0.5 L-1.2 3.8 L4.8 -3.2' : 'M-3.8 -3.8 L3.8 3.8 M3.8 -3.8 L-3.8 3.8'}
          fill="none"
          stroke={INK}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {arrival.correct && arrival.points > 0 && (
          <text y={-16} textAnchor="middle" fill={color} fontSize={13} fontWeight={800}>
            +{arrival.points}
          </text>
        )}
      </g>
    </g>
  );
}
