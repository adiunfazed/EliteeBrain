/**
 * Record persistence.
 *
 * Firebase is stubbed out, so this exercises exactly the path a signed-out
 * user takes — and the path a signed-in user falls back to when a write is
 * refused, which is the case that used to lose records.
 *
 * Run: npx esbuild scripts/trainingStore.test.ts --bundle --platform=node \
 *        --alias:./firebase=./scripts/stub/firebase.ts --outfile=/tmp/ts.cjs && node /tmp/ts.cjs
 */

// A minimal localStorage, installed before the store is imported.
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

import { saveRecord, subscribeRecords, localRecords } from '../src/lib/trainingStore';
import { recordValues } from '../src/lib/personalRecords';

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

const at = '2026-09-18T12:00:00.000Z';

async function main() {
  console.log('--- a record reaches the screen immediately ---');

  // What the component does: subscribe, then save.
  const seen: Record<string, number>[] = [];
  const stop = subscribeRecords(null, (map) => seen.push(recordValues(map)));

  check('subscribing yields the current records at once', seen.length, 1);
  check('and there are none to begin with', seen[0], {});

  await saveRecord(null, { exerciseId: 'pushups', value: 30, achievedAt: at });

  // This is the behaviour the user was missing: no reload, no snapshot, no
  // round trip — the listener hears about it during the save.
  check('saving a record notifies the subscriber', seen.length, 2);
  check('with the new record in it', seen[1], { pushups: 30 });

  console.log('\n--- records only ever go up ---');

  await saveRecord(null, { exerciseId: 'pushups', value: 12, achievedAt: at });
  check('a lower value is ignored', recordValues(localRecords()), { pushups: 30 });
  check('and no pointless notification is sent', seen.length, 2);

  await saveRecord(null, { exerciseId: 'pushups', value: 30, achievedAt: at });
  check('an equal value is ignored', recordValues(localRecords()), { pushups: 30 });

  await saveRecord(null, { exerciseId: 'pushups', value: 31, achievedAt: at });
  check('a higher value replaces it', recordValues(localRecords()), { pushups: 31 });
  check('and does notify', seen.length, 3);

  console.log('\n--- bad input is refused, not stored ---');

  await saveRecord(null, { exerciseId: 'squats', value: 0, achievedAt: at });
  await saveRecord(null, { exerciseId: 'squats', value: -5, achievedAt: at });
  await saveRecord(null, { exerciseId: 'squats', value: Number.NaN, achievedAt: at });
  await saveRecord(null, { exerciseId: '', value: 20, achievedAt: at });
  check('nothing invalid was stored', recordValues(localRecords()), { pushups: 31 });

  console.log('\n--- it survives a reload ---');

  // A reload is a fresh subscription against the same local storage.
  const afterReload: Record<string, number>[] = [];
  const stop2 = subscribeRecords(null, (map) => afterReload.push(recordValues(map)));
  check('a new subscriber gets the stored record', afterReload[0], { pushups: 31 });

  console.log('\n--- several exercises ---');

  await saveRecord(null, { exerciseId: 'plank', value: 90, achievedAt: at });
  check('records are per exercise', recordValues(localRecords()), { pushups: 31, plank: 90 });

  console.log('\n--- unsubscribing stops delivery ---');

  const before = seen.length;
  stop();
  await saveRecord(null, { exerciseId: 'pushups', value: 40, achievedAt: at });
  check('a stopped listener hears nothing further', seen.length, before);
  check('but the record was still stored', recordValues(localRecords()).pushups, 40);
  stop2();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
