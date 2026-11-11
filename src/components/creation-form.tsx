"use client";

import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { cardCreationSchema, type CardCreation } from "@/lib/business-card";
import { createBusinessCard, friendlyRpcMessage, RpcError, type FieldErrors } from "@/lib/rpc-client";

type FieldName = keyof CardCreation;

const fields: { name: FieldName; label: string; type: string; autoComplete: string; required: boolean }[] = [
  { name: "fullName", label: "Full Name", type: "text", autoComplete: "name", required: true },
  { name: "organizationName", label: "Organization Name", type: "text", autoComplete: "organization", required: true },
  { name: "organizationID", label: "Organization ID", type: "text", autoComplete: "off", required: true },
  {
    name: "organizationAddress",
    label: "Organization Address",
    type: "text",
    autoComplete: "street-address",
    required: true,
  },
  { name: "role", label: "Role", type: "text", autoComplete: "organization-title", required: false },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", required: true },
  { name: "email", label: "Email", type: "email", autoComplete: "email", required: true },
];

type Props = {
  initialValues: Partial<CardCreation>;
  onCreated: (appUrl: string) => void;
  onBack: () => void;
};

export function CreationForm({ initialValues, onCreated, onBack }: Props) {
  const [values, setValues] = useState<Record<FieldName, string>>(
    () => Object.fromEntries(fields.map(({ name }) => [name, initialValues[name] ?? ""])) as Record<FieldName, string>,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = cardCreationSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const { appUrl } = await createBusinessCard(parsed.data);
      onCreated(appUrl);
    } catch (caught) {
      if (caught instanceof RpcError && Object.keys(caught.fieldErrors).length > 0) {
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(friendlyRpcMessage(caught, "Couldn't create your card. Please try again."));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>
            <h2>Card Creation</h2>
          </CardTitle>
          <CardDescription>Check the details it read and correct any mistakes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {fields.map(({ name, label, type, autoComplete, required }) => {
            const message = fieldErrors[name]?.[0];
            const errorId = `${name}-error`;
            return (
              <div key={name} className="flex flex-col gap-2">
                <Label htmlFor={name}>
                  {label}
                  {required && <span aria-hidden="true">*</span>}
                </Label>
                <Input
                  id={name}
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  required={required}
                  value={values[name]}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? errorId : undefined}
                  onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
                />
                {message && (
                  <p id={errorId} className="text-sm text-destructive">
                    {message}
                  </p>
                )}
              </div>
            );
          })}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Business Card"}
          </Button>
          <Button type="button" variant="ghost" onClick={onBack} disabled={pending}>
            Back
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
