import { useState } from "react";

export const useSteps = () => {
  const [step, setStep] = useState(0);
  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => (prev > 0 ? prev - 1 : prev));

  return {
    step,
    setStep,
    nextStep,
    prevStep,
  };
};
