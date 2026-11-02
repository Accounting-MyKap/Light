import { vibrate } from './vibrate';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate');
});

test('vibrate passes the pattern to navigator.vibrate', () => {
  const spy = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true });
  vibrate([30, 50, 30]);
  expect(spy).toHaveBeenCalledExactlyOnceWith([30, 50, 30]);
});

test('vibrate is a no-op where navigator.vibrate does not exist', () => {
  expect(() => vibrate(12)).not.toThrow();
});

test('vibrate never throws even if the browser refuses', () => {
  Object.defineProperty(navigator, 'vibrate', {
    value: () => {
      throw new Error('not allowed');
    },
    configurable: true,
  });
  expect(() => vibrate(12)).not.toThrow();
});
