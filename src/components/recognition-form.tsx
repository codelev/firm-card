"use client";

import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaperCard } from "@/lib/business-card";
import { imageFileToJpegDataUrl } from "@/lib/image-to-data-url";
import { friendlyRpcMessage, recognizePaperCard } from "@/lib/rpc-client";

type Props = {
  onRecognized: (paperCard: PaperCard) => void;
  onSkip: () => void;
};

export function RecognitionForm({ onRecognized, onSkip }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo of your paper card.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const image = await imageFileToJpegDataUrl(file);
      const { paperCard } = await recognizePaperCard(image);
      onRecognized(paperCard);
    } catch (caught) {
      setError(
        friendlyRpcMessage(
          caught,
          "Couldn't read this photo. Try a sharper, well-lit photo or enter the details yourself.",
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>
            <h2>Card Recognition</h2>
          </CardTitle>
          <CardDescription>Take a photo of your paper card.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Label htmlFor="image">Image</Label>
          <Input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Recognizing…" : "Recognize Paper Card"}
          </Button>
          <Button type="button" variant="ghost" onClick={onSkip} disabled={pending}>
            Enter details manually
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
