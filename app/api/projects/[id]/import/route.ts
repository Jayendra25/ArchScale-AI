import { NextResponse } from "next/server";
import { ingest } from "@/lib/store";
import type { Source } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let body: { rawText?: string; source?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.rawText?.trim()) {
    return NextResponse.json(
      { error: "Communication cannot be empty." },
      { status: 400 }
    );
  }

  console.log(
    `[POST /api/projects/${projectId}/import] source=${body.source}, label=${body.label}`
  );

  try {
    const result = await ingest(
      projectId,
      body.rawText,
      (body.source as Source) || "whatsapp",
      body.label
    );

    if (result.skippedMessages > 0) {
      console.log(
        `[POST /api/projects/${projectId}/import] ✓ Done. ` +
          `${result.messages.length} new messages, ${result.skippedMessages} duplicates skipped. ` +
          `Changes: ${result.changes.join("; ")}`
      );
    } else {
      console.log(
        `[POST /api/projects/${projectId}/import] ✓ Done. Changes: ${result.changes.join("; ")}`
      );
    }

    return NextResponse.json({
      state: result.state,
      changes: result.changes,
      messageCount: result.messages.length,
      skippedMessages: result.skippedMessages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[POST /api/projects/${projectId}/import] Error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
