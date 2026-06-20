'use client';

import { useState, useCallback } from 'react';

/**
 * useOnboardingState — manages onboarding checklist state.
 *
 * @returns {{
 *   onboarding: {showChecklist: boolean, steps: Object},
 *   initOnboarding: () => void,
 *   completeOnboardingStep: (step: string) => void,
 *   dismissOnboarding: () => void,
 * }}
 */
export default function useOnboardingState() {
  const [onboarding, setOnboarding] = useState({
    showChecklist: false,
    steps: {
      invited: false,
      teamCreated: false,
      meetingUploaded: false,
      tasksReviewed: false,
      analyticsViewed: false,
    },
  });

  const initOnboarding = useCallback(() => {
    setOnboarding({
      showChecklist: true,
      steps: {
        invited: false,
        teamCreated: false,
        meetingUploaded: false,
        tasksReviewed: false,
        analyticsViewed: false,
      },
    });
  }, []);

  const completeOnboardingStep = useCallback((step) => {
    setOnboarding((prev) => ({
      ...prev,
      steps: { ...prev.steps, [step]: true },
    }));
  }, []);

  const dismissOnboarding = useCallback(() => {
    setOnboarding((prev) => ({ ...prev, showChecklist: false }));
  }, []);

  return {
    onboarding,
    initOnboarding,
    completeOnboardingStep,
    dismissOnboarding,
  };
}
