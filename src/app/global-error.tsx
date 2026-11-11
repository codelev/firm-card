"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-10">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground">Please reload the page.</p>
          <div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
