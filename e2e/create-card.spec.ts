import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const card = {
  "Full Name": "John Smith",
  "Organization Name": "Acme Solutions Ltd",
  "Organization ID": "GB123456",
  "Organization Address": "221B Baker Street, London",
  Role: "Senior Software Engineer",
  Phone: "+44 20 7946 0000",
  Email: "john.smith@acme.example",
};

async function fillCreationForm(page: Page, values: Partial<typeof card>) {
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label, { exact: false }).fill(value);
  }
}

test("creates a card manually and opens it offline after install", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter details manually" }).click();
  await fillCreationForm(page, card);
  await page.getByRole("button", { name: "Create Business Card" }).click();

  await expect(page.getByRole("heading", { name: "Your card is ready" })).toBeVisible();
  await page.getByRole("link", { name: "Open your card" }).click();

  await expect(page).toHaveURL(/\/cards\/[A-Za-z0-9_-]{22}\/index\.html$/);
  await expect(page.getByRole("heading", { name: "John Smith" })).toBeVisible();
  await expect(page.getByLabel("QR code with contact details").locator("svg")).toBeVisible();
  await expect(page.getByRole("link", { name: "Save contact" })).toHaveAttribute("href", /card\.vcf$/);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await page.request.get(manifestHref ?? "")).json();
  expect(manifest).toMatchObject({ name: "John Smith", display: "standalone" });

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve));
    }
    return registration.scope;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "John Smith" })).toBeVisible();
  await expect(page.getByLabel("QR code with contact details").locator("svg")).toBeVisible();
});

test("prefills the creation form from a recognized photo", async ({ page }) => {
  await page.route("**/api/rpc", async (route) => {
    const body = route.request().postDataJSON() as { method: string; id: string };
    if (body.method !== "complete.recognizePaperCard") {
      return route.continue();
    }
    await route.fulfill({
      json: {
        jsonrpc: "2.0",
        id: body.id,
        result: {
          paperCard: {
            fullName: "John Smith",
            organizationName: "Acme Solutions Ltd",
            organizationAddress: "221B Baker Street, London",
            role: "Senior Software Engineer",
            phone: "+44 20 7946 0000",
            email: "john.smith@acme.example",
          },
        },
      },
    });
  });

  await page.goto("/");
  await page.getByLabel("Image").setInputFiles(path.join(__dirname, "fixtures", "paper-card.png"));
  await page.getByRole("button", { name: "Recognize Paper Card" }).click();

  await expect(page.getByRole("heading", { name: "Card Creation" })).toBeVisible();
  await expect(page.getByLabel("Full Name")).toHaveValue("John Smith");
  await expect(page.getByLabel("Email")).toHaveValue("john.smith@acme.example");
  await expect(page.getByLabel("Organization ID")).toHaveValue("");
});

test("shows validation errors for an invalid email", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter details manually" }).click();
  await fillCreationForm(page, { ...card, Email: "not-an-email" });
  await page.getByRole("button", { name: "Create Business Card" }).click();

  await expect(page.getByText("Invalid email")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Card Creation" })).toBeVisible();
});
