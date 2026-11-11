export type EventType = "BusinessCardCreated" | "PaperCardRecognized";

export type DomainEvent = {
  type: EventType;
  createdAt: string;
  version: number;
  payload: Record<string, unknown>;
};

type Listener = (event: DomainEvent) => void;

export function createEventBus(now: () => Date = () => new Date()) {
  const listeners = new Set<Listener>();
  let version = 0;

  return {
    emit(type: EventType, payload: Record<string, unknown>): DomainEvent {
      version += 1;
      const event: DomainEvent = { type, createdAt: now().toISOString(), version, payload };
      for (const listener of listeners) {
        listener(event);
      }
      return event;
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus>;

const globalForEvents = globalThis as typeof globalThis & { firmcardEvents?: EventBus };

export const eventBus: EventBus = (globalForEvents.firmcardEvents ??= createEventBus());
