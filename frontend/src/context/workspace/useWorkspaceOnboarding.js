import { useCallback, useState } from 'react';

const initialSteps = {
  invited: false,
  teamCreated: false,
  meetingUploaded: false,
  tasksReviewed: false,
  analyticsViewed: false,
};

export function useWorkspaceOnboarding() {
  const [onboarding, setOnboarding] = useState({
    showChecklist: false,
    steps: initialSteps,
  });

  const initOnboarding = useCallback(() => {
    setOnboarding({
      showChecklist: true,
      steps: initialSteps,
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
