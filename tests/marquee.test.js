import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marqueeOffset } from '../src/marquee.js';

test('text that fits is never shifted', () => {
  assert.equal(marqueeOffset(100, 200, 5000, 40, 1000), 0);
});

test('long text stays still during the initial pause', () => {
  assert.equal(marqueeOffset(400, 200, 500, 40, 1000), 0);
});

test('long text scrolls after the pause', () => {
  assert.equal(marqueeOffset(400, 200, 2000, 40, 1000), 40);
});

test('scrolling never exceeds the overflow width', () => {
  assert.equal(marqueeOffset(400, 200, 999999, 40, 1000), 200);
});
