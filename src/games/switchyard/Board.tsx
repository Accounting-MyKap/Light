import { memo, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Locomotive, ShapeMark, StationHouse, TreeTop, TunnelPortal, Wagon, INK } from './art';
import { TRAIN_LENGTH, trainPose, type Arrival, type Train } from './engine';
import { headingName, offsetPolyline, type Point } from './geometry';
import { BOARD, STATION_STYLES, TUNNEL, type TrackMap } from './maps';
import styles from './switchyard.module.css';

/** How long the ring and the mark of an arrival stay on the station. */
export const ARRIVAL_SHOW_MS = 900;

/** The drawings of the locomotive and the wagon are scaled up by these factors. */
const LOCO_SCALE = 1.25;
const WAGON_SCALE = 1.3;
/** 28 × 1.25: the locomotive drawing is 28 long. */
const LOCO_LENGTH = 35;
const WAGON_GAP = 5;

/** Where the chimney is, measured back from the front of the train (it sits 8.5 ahead of the locomotive's center). */
export const CHIMNEY_BACK = LOCO_LENGTH / 2 - 8.5 * LOCO_SCALE;
const RAIL_OFFSET = 3.6;

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
  /** Buttons over the switches. Without it the board is only looked at (the example). */
  onToggle?: (index: number) => void;
  reducedMotion?: boolean;
  /** Width in CSS pixels; without it the board takes the width of its box (up to 420 px). */
  width?: number;
  className?: string;
}

const pathOf = (points: readonly Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

const angleBetween = (from: Point, to: Point) => (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

/**
 * The track map: ground, tracks, switches, trains, smoke, stations and tunnel, drawn in that order so trains roll
 * over the switches and under the stations and the tunnel. Each switch gets a transparent button on top.
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
  width,
  className = '',
}: BoardProps) {
  const { t } = useTranslation();
  const uid = `sy${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className={`${styles.board} ${className}`}
      style={width === undefined ? undefined : { width }}
      role="group"
      aria-label={t('games.switchyard.board')}
    >
      <svg className={styles.svg} viewBox={`0 0 ${BOARD.width} ${BOARD.height}`} aria-hidden="true">
        <Defs uid={uid} />
        <Ground map={map} uid={uid} />
        <Tracks map={map} switches={switches} />
        {map.switches.map((sw) => (
          <SwitchDisk key={sw.id} at={sw.at} angle={sw.exitAngles[switches[sw.id]]} />
        ))}
        {/* The smoke trail goes under the trains, so it never hides a locomotive. */}
        {puffs.map((p) => (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill={`url(#${uid}-puff)`} opacity={p.opacity} />
        ))}
        {trains.map((train) => (
          <TrainView key={train.id} map={map} train={train} beam={`${uid}-beam`} />
        ))}
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
        <g transform={`translate(${TUNNEL.x} ${TUNNEL.y - 4})`}>
          <TunnelPortal />
        </g>
        {arrivals.map((a) => (
          <ArrivalMark key={a.trainId} at={map.stations[a.station].at} arrival={a} now={now} still={reducedMotion} />
        ))}
      </svg>
      {onToggle &&
        map.switches.map((sw) => {
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
    </div>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-beam`} x1="14" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </linearGradient>
      {STATION_STYLES.map((style, i) => (
        <radialGradient key={i} id={`${uid}-glow-${i}`}>
          <stop offset="0" stopColor={style.color} stopOpacity="0.5" />
          <stop offset="1" stopColor={style.color} stopOpacity="0" />
        </radialGradient>
      ))}
      <radialGradient id={`${uid}-puff`}>
        <stop offset="0" stopColor="#f1f3ff" stopOpacity="1" />
        <stop offset="0.55" stopColor="#dfe4f7" stopOpacity="0.8" />
        <stop offset="1" stopColor="#c9cfe6" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-ground`} cx="0.5" cy="0.42" r="0.7">
        <stop offset="0" stopColor="#141a36" />
        <stop offset="1" stopColor="#0b0e20" />
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
      {map.trees.map((tree, i) => (
        <TreeTop key={i} {...tree} />
      ))}
    </g>
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

/** The round point of a switch: a beacon ring that invites a tap, and an arrow toward the exit it points to. */
function SwitchDisk({ at, angle }: { at: Point; angle: number }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <circle className={styles.halo} r={23} />
      <circle className={styles.beacon} r={15} />
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

function TrainView({ map, train, beam }: { map: TrackMap; train: Train; beam: string }) {
  const style = STATION_STYLES[map.stations[train.station].style];
  const front = trainPose(map, train, 0);
  const locoBack = trainPose(map, train, LOCO_LENGTH);
  const wagonFront = trainPose(map, train, LOCO_LENGTH + WAGON_GAP);
  const wagonBack = trainPose(map, train, TRAIN_LENGTH);
  const loco = { x: (front.x + locoBack.x) / 2, y: (front.y + locoBack.y) / 2 };
  const wagon = { x: (wagonFront.x + wagonBack.x) / 2 - loco.x, y: (wagonFront.y + wagonBack.y) / 2 - loco.y };
  const locoAngle = angleBetween(locoBack, front);
  const wagonAngle = angleBetween(wagonBack, wagonFront);

  // Rolling in under the station: the headlight goes off and the train fades as it disappears into the building.
  const segmentLength = map.segments[train.route[train.route.length - 1]].line.length;
  const inside = train.arrived ? Math.min(1, (2 * (train.distance - segmentLength)) / TRAIN_LENGTH) : 0;

  return (
    <g
      data-train={train.id}
      data-station={train.station}
      transform={`translate(${loco.x.toFixed(2)} ${loco.y.toFixed(2)})`}
      opacity={1 - inside}
    >
      <line
        x1={locoBack.x - loco.x}
        y1={locoBack.y - loco.y}
        x2={wagonFront.x - loco.x}
        y2={wagonFront.y - loco.y}
        stroke="#2a2f48"
        strokeWidth={3}
      />
      <g transform={`translate(${wagon.x.toFixed(2)} ${wagon.y.toFixed(2)})`}>
        <g transform={`rotate(${wagonAngle.toFixed(1)}) scale(${WAGON_SCALE})`}>
          <Wagon color={style.color} />
        </g>
        <ShapeMark shape={style.shape} size={6} fill={INK} />
      </g>
      <g transform={`rotate(${locoAngle.toFixed(1)}) scale(${LOCO_SCALE})`}>
        <Locomotive color={style.color} beam={train.arrived ? undefined : beam} />
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
        {arrival.correct && (
          <text y={-16} textAnchor="middle" fill={color} fontSize={13} fontWeight={800}>
            +{arrival.points}
          </text>
        )}
      </g>
    </g>
  );
}
