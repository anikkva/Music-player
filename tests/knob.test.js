import { test } from 'node:test';
import assert from 'node:assert/strict';
import { angleToVolume, volumeToAngle, MIN_ANGLE, MAX_ANGLE } from '../src/knob.js';

test('angle maps linearly to volume', () => {
  assert.equal(angleToVolume(MIN_ANGLE, MIN_ANGLE, MAX_ANGLE), 0);
  assert.equal(angleToVolume(MAX_ANGLE, MIN_ANGLE, MAX_ANGLE), 1);
  assert.equal(angleToVolume((MIN_ANGLE + MAX_ANGLE) / 2, MIN_ANGLE, MAX_ANGLE), 0.5);
});

test('angle outside the range is clamped', () => {
  assert.equal(angleToVolume(MIN_ANGLE - 5, MIN_ANGLE, MAX_ANGLE), 0);
  assert.equal(angleToVolume(MAX_ANGLE + 5, MIN_ANGLE, MAX_ANGLE), 1);
});

test('volumeToAngle is the inverse of angleToVolume', () => {
  const angle = volumeToAngle(0.3, MIN_ANGLE, MAX_ANGLE);
  assert.ok(Math.abs(angleToVolume(angle, MIN_ANGLE, MAX_ANGLE) - 0.3) < 1e-9);
});

test('volumeToAngle clamps out-of-range volume', () => {
  assert.equal(volumeToAngle(-1, MIN_ANGLE, MAX_ANGLE), MIN_ANGLE);
  assert.equal(volumeToAngle(2, MIN_ANGLE, MAX_ANGLE), MAX_ANGLE);
});
