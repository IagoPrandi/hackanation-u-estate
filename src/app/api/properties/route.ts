import { NextResponse } from "next/server";
import {
  createPropertyDraft,
  listPropertyDrafts,
  savePropertyMockVerification,
  saveOnchainPropertyRegistration,
} from "@/offchain/repository";
import {
  propertyIntakeSchema,
  propertyOnchainSyncSchema,
} from "@/offchain/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const properties = await listPropertyDrafts();

  return NextResponse.json({ properties });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsedPayload = propertyIntakeSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid property payload.",
          details: parsedPayload.error.flatten(),
        },
        { status: 400 },
      );
    }

    const record = await createPropertyDraft(parsedPayload.data);

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const parsedPayload = propertyOnchainSyncSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return NextResponse.json(
        {
          error: "Invalid on-chain sync payload.",
          details: parsedPayload.error.flatten(),
        },
        { status: 400 },
      );
    }

    const record =
      parsedPayload.data.kind === "registration"
        ? await saveOnchainPropertyRegistration(parsedPayload.data)
        : await savePropertyMockVerification(parsedPayload.data);

    return NextResponse.json({ record });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    const status =
      message === "Property draft not found."
        ? 404
        : message === "Property draft already linked to an on-chain property." ||
            message === "Property draft is already mock-verified." ||
            message === "Property draft is not registered on-chain." ||
            message === "On-chain property id does not match the saved draft."
          ? 409
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
