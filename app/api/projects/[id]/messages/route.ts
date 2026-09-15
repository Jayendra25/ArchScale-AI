import { NextResponse } from "next/server";
import { getData } from "@/lib/store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const p = new URL(req.url).searchParams;

  try {
    const { messages: all } = await getData(projectId);
    let messages = all;

    const source = p.get("source");
    const person = p.get("person");
    const query = p.get("query");

    if (source) messages = messages.filter((m) => m.source === source);
    if (person) messages = messages.filter((m) => m.sender.toLowerCase().includes(person.toLowerCase()));
    if (query) messages = messages.filter((m) => (m.content + m.tags.join(" ")).toLowerCase().includes(query.toLowerCase()));

    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load messages." }, { status: 500 });
  }
}
