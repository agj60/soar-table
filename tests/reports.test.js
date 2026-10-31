import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReports } from '../js/reports.js';

test('reports are split, cleaned and ordered oldest first', () => {
  assert.deepEqual(parseReports('SBSJ 301400Z 23004KT 9999 SCT017 23/19 Q1015= SBSJ 301500Z 23007KT\n 9999 BKN030 24/19 Q1015=\n'),
    ['SBSJ 301400Z 23004KT 9999 SCT017 23/19 Q1015', 'SBSJ 301500Z 23007KT 9999 BKN030 24/19 Q1015']);
  assert.deepEqual(parseReports(''), []);
});
