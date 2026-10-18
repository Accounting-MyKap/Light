import { playTone } from './sound';

test('playTone is a no-op without AudioContext', () => {
  expect(() => playTone('correct')).not.toThrow();
  expect(() => playTone('wrong')).not.toThrow();
  expect(() => playTone('finish')).not.toThrow();
});
