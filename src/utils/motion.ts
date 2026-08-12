import { useReducedMotion } from 'motion/react';

export const motionTokens = {
  duration: {
    instant: 0.09,
    quick: 0.14,
    base: 0.22,
    slow: 0.42,
    plot: 1.10,
  },
  easing: {
    standard: [0.2, 0, 0, 1] as [number, number, number, number],
    entrance: [0.3, 0, 0.1, 1] as [number, number, number, number],
  },
  spring: {
    type: 'spring' as const,
    stiffness: 420,
    damping: 34,
  },
};

export function useInstrumentTransition() {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return {
      quick: { duration: 0 },
      base: { duration: 0 },
      slow: { duration: 0 },
      plot: { duration: 0 },
      spring: { duration: 0 },
    };
  }

  return {
    quick: { duration: motionTokens.duration.quick, ease: motionTokens.easing.standard },
    base: { duration: motionTokens.duration.base, ease: motionTokens.easing.standard },
    slow: { duration: motionTokens.duration.slow, ease: motionTokens.easing.standard },
    plot: { duration: motionTokens.duration.plot, ease: motionTokens.easing.entrance },
    spring: motionTokens.spring,
  };
}
