import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampYaw, clampPitch, clampZoom,
  YAW_LIMIT, PITCH_LIMIT, ZOOM_MIN, ZOOM_MAX,
} from '../src/cameraMath.js';

test('yaw is clamped to +-100 degrees', () => {
  assert.equal(clampYaw(0), 0);
  assert.equal(clampYaw(10), YAW_LIMIT);
  assert.equal(clampYaw(-10), -YAW_LIMIT);
  assert.ok(Math.abs(YAW_LIMIT - (100 * Math.PI) / 180) < 1e-12);
});

test('pitch is clamped to +-45 degrees', () => {
  assert.equal(clampPitch(10), PITCH_LIMIT);
  assert.equal(clampPitch(-10), -PITCH_LIMIT);
  assert.ok(Math.abs(PITCH_LIMIT - (45 * Math.PI) / 180) < 1e-12);
});

test('zoom is clamped to the configured range', () => {
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(clampZoom(100), ZOOM_MAX);
  assert.equal(clampZoom(1), 1);
});
