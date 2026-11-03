import { trainPose, type Train } from './engine';
import type { Point } from './geometry';
import type { TrackMap } from './maps';

/*
 * Trains are drawn like toy trains, in two cars that each rest on the track by both ends, the way real cars rest on
 * their wheels: so they bend together through a curve instead of cutting across it. A car running across the board,
 * or down a diagonal, is seen from the side and tilts exactly with the track; a car running down the board comes
 * toward the viewer and is seen from the front.
 */

/** The stretch of track each car covers, measured back from the front of the train. */
export const LOCO_SPAN = { front: 0, back: 34 } as const;
export const WAGON_SPAN = { front: 38, back: 59 } as const;

/** Steeper than this (degrees from level), a car shows its front instead of its side. */
const FRONT_VIEW_FROM = 50;

/** The top of the chimney in the locomotive's own drawing, from the side (facing right) and from the front. */
const CHIMNEY_SIDE: Point = { x: 5, y: -28 };
const CHIMNEY_FRONT: Point = { x: 0, y: -34 };

export interface CarSprite {
  /** Midway between the car's two ends on the track. */
  x: number;
  y: number;
  view: 'side' | 'front';
  /** Seen from the side: 1 when it heads right, −1 when it heads left. Seen from the front: 1. */
  facing: 1 | -1;
  /** Degrees, clockwise, applied after facing: positive dips the nose of a car heading right. */
  rotation: number;
}

export interface TrainSprite {
  loco: CarSprite;
  wagon: CarSprite;
}

function carSprite(map: TrackMap, train: Train, span: { front: number; back: number }): CarSprite {
  const a = trainPose(map, train, span.front);
  const b = trainPose(map, train, span.back);
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const angle = Math.atan2(a.y - b.y, a.x - b.x);
  const steepness = (Math.asin(Math.min(1, Math.abs(Math.sin(angle)))) * 180) / Math.PI;
  if (steepness > FRONT_VIEW_FROM) return { x, y, view: 'front', facing: 1, rotation: 0 };
  const facing: 1 | -1 = Math.cos(angle) >= 0 ? 1 : -1;
  const degrees = (angle * 180) / Math.PI;
  // Facing left, the drawing is mirrored: its nose dips with a turn the other way round.
  const rotation = facing === 1 ? degrees : ((((degrees - 180) % 360) + 540) % 360) - 180;
  return { x, y, view: 'side', facing, rotation };
}

export function trainSprite(map: TrackMap, train: Train): TrainSprite {
  return { loco: carSprite(map, train, LOCO_SPAN), wagon: carSprite(map, train, WAGON_SPAN) };
}

/** Where the top of the locomotive's chimney is on the board, for the smoke. */
export function chimneyOf(sprite: TrainSprite): Point {
  const { loco } = sprite;
  if (loco.view === 'front') return { x: loco.x + CHIMNEY_FRONT.x, y: loco.y + CHIMNEY_FRONT.y };
  const rad = (loco.rotation * Math.PI) / 180;
  const lx = CHIMNEY_SIDE.x * loco.facing;
  const ly = CHIMNEY_SIDE.y;
  return {
    x: loco.x + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: loco.y + lx * Math.sin(rad) + ly * Math.cos(rad),
  };
}
