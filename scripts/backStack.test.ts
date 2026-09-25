/**
 * The hardware back button.
 *
 * The rules that matter: one press closes exactly one layer, a layer closed
 * by its own button does not leave a stale history entry behind, and the app
 * only exits once there is genuinely nothing left to go back to.
 *
 * Run: npx esbuild scripts/backStack.test.ts --bundle --platform=node --outfile=/tmp/bs.cjs && node /tmp/bs.cjs
 */

/* A history and a window, small enough to reason about. */
const listeners: (() => void)[] = [];
let entries = 1;

const fakeWindow = {
  history: {
    pushState: () => {
      entries++;
    },
    back: () => {
      if (entries > 1) entries--;
      // The browser fires popstate asynchronously; synchronously is close
      // enough here and keeps the test readable.
      for (const fn of listeners) fn();
    },
  },
  addEventListener: (type: string, fn: () => void) => {
    if (type === 'popstate') listeners.push(fn);
  },
  setTimeout: (fn: () => void) => {
    void fn;
    return 0;
  },
};

(globalThis as any).window = fakeWindow;

import {
  installBackHandler,
  layerCount,
  popLayer,
  pushLayer,
  resetBackStack,
} from '../src/lib/backStack';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${
      ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    }`
  );
}

function ok(name: string, condition: boolean): void {
  check(name, condition, true);
}

/** What the phone's back button does. */
const pressBack = () => {
  for (const fn of listeners) fn();
};

console.log('--- one press closes one layer ---');

{
  resetBackStack();
  const closed: string[] = [];

  const sheet = pushLayer(() => closed.push('sheet'));
  const modal = pushLayer(() => closed.push('modal'));
  check('two layers are open', layerCount(), 2);

  pressBack();
  check('the topmost closes first', closed, ['modal']);
  check('and the one under it is still open', layerCount(), 1);

  pressBack();
  check('the next press closes that one', closed, ['modal', 'sheet']);
  check('leaving nothing open', layerCount(), 0);

  void sheet;
  void modal;
}

console.log('\n--- closing from the app leaves no ghost ---');

{
  resetBackStack();
  const closed: string[] = [];

  const id = pushLayer(() => closed.push('sheet'));
  popLayer(id);

  check('the layer is gone', layerCount(), 0);
  check('and it was not closed twice', closed, []);

  // The history entry it pushed was unwound, so this press must reach the
  // root rather than being swallowed.
  let rootPresses = 0;
  installBackHandler(() => {
    rootPresses++;
    return true;
  });
  pressBack();
  check('the next press reaches the root', rootPresses, 1);
}

console.log('\n--- a layer closed out of turn ---');

{
  resetBackStack();
  const closed: string[] = [];

  const under = pushLayer(() => closed.push('under'));
  pushLayer(() => closed.push('over'));

  // The lower one is dismissed by something else entirely — a toast timing
  // out, a save completing. It must not take the visible layer with it.
  popLayer(under);
  check('only the one on top is left', layerCount(), 1);

  pressBack();
  check('and back closes that one', closed, ['over']);
}

console.log('\n--- the root decides whether the app exits ---');

{
  resetBackStack();
  let presses = 0;

  installBackHandler(() => {
    presses++;
    // First press is handled (step back to Home); the second is not.
    return presses === 1;
  });

  pressBack();
  check('the first press is handled', presses, 1);

  pressBack();
  check('the second reaches the root as well', presses, 2);
  ok('and nothing is left holding the app open', layerCount() === 0);
}

console.log('\n--- a layer never closes itself twice ---');

{
  resetBackStack();
  let closes = 0;

  const id = pushLayer(() => closes++);
  pressBack();
  check('back closed it once', closes, 1);

  // React's cleanup runs after the state change, calling popLayer for a
  // layer the press already removed. That must be a no-op.
  popLayer(id);
  check('and the cleanup does not close it again', closes, 1);
  check('nor leave a layer behind', layerCount(), 0);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
