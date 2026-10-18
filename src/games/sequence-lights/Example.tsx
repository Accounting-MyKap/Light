import { Board } from './Board';

export function SequenceLightsExample() {
  return <Board size={3} lit={new Set([0, 4, 8])} marks={{ 0: '1', 4: '2', 8: '3' }} small />;
}
