import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Not found · Firmcard",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="text-primary underline-offset-4 hover:underline">
        Create a card
      </Link>
    </main>
  );
}
