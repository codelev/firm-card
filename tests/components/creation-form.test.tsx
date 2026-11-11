// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreationForm } from "@/components/creation-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CreationForm", () => {
  it("prefills recognized values", () => {
    render(
      <CreationForm
        initialValues={{ fullName: "John Smith", email: "john@acme.example" }}
        onCreated={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Full Name/)).toHaveProperty("value", "John Smith");
    expect(screen.getByLabelText(/Email/)).toHaveProperty("value", "john@acme.example");
  });

  it("shows validation errors without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CreationForm initialValues={{ email: "nope" }} onCreated={() => {}} onBack={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Create Business Card" }));

    expect(await screen.findByText("Invalid email")).toBeDefined();
    expect(screen.getByLabelText(/Email/).getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates the card and reports the app URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ jsonrpc: "2.0", id: "1", result: { businessCard: {}, appUrl: "/cards/abc/index.html" } }),
      ),
    );
    const onCreated = vi.fn();
    render(
      <CreationForm
        initialValues={{
          fullName: "John Smith",
          organizationName: "Acme Ltd",
          organizationID: "GB1",
          organizationAddress: "1 Main St",
          phone: "+44 20 7946 0000",
          email: "john@acme.example",
        }}
        onCreated={onCreated}
        onBack={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Business Card" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("/cards/abc/index.html"));
  });
});
