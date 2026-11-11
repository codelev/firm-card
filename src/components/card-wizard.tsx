"use client";

import { useState } from "react";
import { CardCreated } from "@/components/card-created";
import { CreationForm } from "@/components/creation-form";
import { RecognitionForm } from "@/components/recognition-form";
import type { CardCreation } from "@/lib/business-card";

type Step =
  | { name: "recognition" }
  | { name: "creation"; initialValues: Partial<CardCreation> }
  | { name: "created"; appUrl: string };

export function CardWizard() {
  const [step, setStep] = useState<Step>({ name: "recognition" });

  if (step.name === "recognition") {
    return (
      <RecognitionForm
        onRecognized={(paperCard) => setStep({ name: "creation", initialValues: paperCard })}
        onSkip={() => setStep({ name: "creation", initialValues: {} })}
      />
    );
  }

  if (step.name === "creation") {
    return (
      <CreationForm
        initialValues={step.initialValues}
        onCreated={(appUrl) => setStep({ name: "created", appUrl })}
        onBack={() => setStep({ name: "recognition" })}
      />
    );
  }

  return <CardCreated appUrl={step.appUrl} onStartOver={() => setStep({ name: "recognition" })} />;
}
