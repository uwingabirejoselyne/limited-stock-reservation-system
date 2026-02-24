import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 and isExpired=false when expiresAt is null', () => {
    const { result } = renderHook(() => useCountdown(null));

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it('calculates correct initial secondsLeft from a future expiresAt', () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.secondsLeft).toBe(300);
    expect(result.current.minutes).toBe(5);
    expect(result.current.seconds).toBe(0);
    expect(result.current.progress).toBe(100);
    expect(result.current.isExpired).toBe(false);
  });

  it('decrements secondsLeft every second', () => {
    const expiresAt = new Date(Date.now() + 10 * 1000).toISOString(); // 10 s

    const { result } = renderHook(() => useCountdown(expiresAt));
    expect(result.current.secondsLeft).toBe(10);

    act(() => { vi.advanceTimersByTime(3000); }); // +3 s
    expect(result.current.secondsLeft).toBe(7);

    act(() => { vi.advanceTimersByTime(5000); }); // +5 s
    expect(result.current.secondsLeft).toBe(2);
  });

  it('sets isExpired=true when timer reaches zero', () => {
    const expiresAt = new Date(Date.now() + 2 * 1000).toISOString(); // 2 s

    const { result } = renderHook(() => useCountdown(expiresAt));
    expect(result.current.isExpired).toBe(false);

    act(() => { vi.advanceTimersByTime(3000); }); // past expiry
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('returns isExpired=true immediately for a past expiresAt', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // already expired

    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });

  it('progress decreases as time passes', () => {
    const expiresAt = new Date(Date.now() + 300 * 1000).toISOString(); // 300 s = 100%

    const { result } = renderHook(() => useCountdown(expiresAt));
    expect(result.current.progress).toBe(100);

    act(() => { vi.advanceTimersByTime(150 * 1000); }); // 150 s elapsed → 50%
    expect(result.current.progress).toBeCloseTo(50, 0);
  });

  it('cleans up the interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    const { unmount } = renderHook(() => useCountdown(expiresAt));
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
