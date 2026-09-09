import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, prevIndex } from '../src/playlist.js';

test('next wraps around the end', () => {
  assert.equal(nextIndex(0, 6), 1);
  assert.equal(nextIndex(5, 6), 0);
});

test('prev wraps around the start', () => {
  assert.equal(prevIndex(5, 6), 4);
  assert.equal(prevIndex(0, 6), 5);
});

test('a single-track playlist stays on the same index', () => {
  assert.equal(nextIndex(0, 1), 0);
  assert.equal(prevIndex(0, 1), 0);
});
