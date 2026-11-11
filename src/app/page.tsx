import type { Metadata } from "next";
import { CardWizard } from "@/components/card-wizard";

export const metadata: Metadata = {
  title: "Firmcard",
  description: "Turn your paper business card into an installable app you can share by QR, even offline.",
};

const steps = [
  "Take a photo of your paper card.",
  "Check the details it read and correct any mistakes.",
  "Install your card and share it by QR, even offline.",
  "Scan cards other people give you to save their contacts.",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Firmcard</h1>
        <p className="text-muted-foreground">Turn your paper business card into an installable app.</p>
        <ol className="list-decimal pl-5 text-sm text-muted-foreground">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </header>
      <CardWizard />
    </main>
  );
}
