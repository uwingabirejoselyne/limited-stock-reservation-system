import { useState, useEffect } from 'react';

const RESERVATION_TTL_SECONDS = 5 * 60; // must match backend

interface CountdownResult {
  secondsLeft: number;
  minutes: number;
  seconds: number;
  /** 0–100, decreases as time runs out */
  progress: number;
  isExpired: boolean;
}

export function useCountdown(expiresAt: string | null): CountdownResult {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const calc = () =>
      Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

    setSecondsLeft(calc());

    const id = setInterval(() => {
      const left = calc();
      setSecondsLeft(left);
      if (left === 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt]);

  return {
    secondsLeft,
    minutes: Math.floor(secondsLeft / 60),
    seconds: secondsLeft % 60,
    progress: expiresAt ? (secondsLeft / RESERVATION_TTL_SECONDS) * 100 : 0,
    isExpired: expiresAt !== null && secondsLeft === 0,
  };
}
