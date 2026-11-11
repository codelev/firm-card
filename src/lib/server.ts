import { createBusinessCardService } from "@/lib/business-card-service";
import { dataDir } from "@/lib/paths";
import { eventBus } from "@/lib/events";
import { recognizeLines } from "@/lib/recognition";

export const businessCardService = createBusinessCardService({
  dataDir,
  events: eventBus,
  recognizeLines,
});
