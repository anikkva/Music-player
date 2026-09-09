// Pure playlist index arithmetic. No DOM, no audio — safe to unit-test.

export function nextIndex(current, length) {
  return (current + 1) % length;
}

export function prevIndex(current, length) {
  return (current - 1 + length) % length;
}
