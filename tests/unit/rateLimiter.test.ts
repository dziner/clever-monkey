import { describe, expect, it } from 'vitest';
import {
  getRateLimitStateSizeForDiagnostics,
  pruneIdleRateLimitEntries,
  tooManyRequestsByIp,
} from '../../netlify/functions/lib/shared';

describe('IP rate limiter pruning', () => {
  it('keeps active windows intact and removes expired idle IPs', () => {
    const ip = `unit-prune-${Date.now()}-${Math.random()}`;
    const beforeSize = getRateLimitStateSizeForDiagnostics();

    for (let i = 0; i < 30; i++) {
      expect(tooManyRequestsByIp(ip)).toBe(false);
    }
    expect(tooManyRequestsByIp(ip)).toBe(true);
    expect(getRateLimitStateSizeForDiagnostics()).toBeGreaterThanOrEqual(beforeSize + 1);

    pruneIdleRateLimitEntries(Date.now());
    expect(tooManyRequestsByIp(ip)).toBe(true);

    const removed = pruneIdleRateLimitEntries(Date.now() + 120_000);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(tooManyRequestsByIp(ip)).toBe(false);
  });
});
