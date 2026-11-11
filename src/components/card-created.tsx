import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  appUrl: string;
  onStartOver: () => void;
};

export function CardCreated({ appUrl, onStartOver }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Your card is ready</h2>
        </CardTitle>
        <CardDescription>Install your card and share it by QR, even offline.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>Open your card on your phone, then install it:</p>
        <ul className="list-disc pl-5">
          <li>iPhone: Share, then Add to Home Screen.</li>
          <li>Android: menu, then Install app.</li>
        </ul>
        <p>Others can scan your QR code with their camera to save your contact.</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <a
          href={appUrl}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Open your card
        </a>
        <Button type="button" variant="ghost" onClick={onStartOver}>
          Create another card
        </Button>
      </CardFooter>
    </Card>
  );
}
