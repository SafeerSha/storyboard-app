import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { correctEpicName } from "@/lib/ai/gemini";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const json = await req.json();
    const { name, description } = schema.parse(json);

    const result = await correctEpicName(name, description);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to correct epic name:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to correct epic name with AI." },
      { status: 500 }
    );
  }
}
