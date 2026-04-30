import { NextResponse } from "next/server";
import {
  createPropertyDraft,
  listPropertyDrafts,
} from "@/offchain/repository";
import { propertyIntakeSchema } from "@/offchain/schemas";

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
