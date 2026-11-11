import {
  cardCreationSchema,
  cardRecognitionSchema,
  decodeImageDataUrl,
  type BusinessCard,
  type PaperCard,
} from "@/lib/business-card";
import { generateCardApp } from "@/lib/card-app/generate";
import type { EventBus } from "@/lib/events";
import { parsePaperCard, type OcrLine } from "@/lib/paper-card-parser";

export type BusinessCardServiceDeps = {
  dataDir: string;
  events: EventBus;
  recognizeLines: (image: Buffer) => Promise<OcrLine[]>;
};

export function createBusinessCardService(deps: BusinessCardServiceDeps) {
  return {
    async createBusinessCard(cardCreation: unknown): Promise<{ businessCard: BusinessCard; appUrl: string }> {
      const businessCard = cardCreationSchema.parse(cardCreation);
      const { appUrl } = await generateCardApp(deps.dataDir, businessCard);
      deps.events.emit("BusinessCardCreated", {});
      return { businessCard, appUrl };
    },

    async recognizePaperCard(cardRecognition: unknown): Promise<{ paperCard: PaperCard }> {
      const { image } = cardRecognitionSchema.parse(cardRecognition);
      const lines = await deps.recognizeLines(decodeImageDataUrl(image));
      const paperCard = parsePaperCard(lines);
      deps.events.emit("PaperCardRecognized", {});
      return { paperCard };
    },
  };
}

export type BusinessCardService = ReturnType<typeof createBusinessCardService>;
