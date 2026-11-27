import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  const event = await req.json();
  if (event.type === "checkout.session.completed") {
    const userId = event.data.object.client_reference_id;
    await admin.from("profiles").update({ plan: "pro" }).eq("id", userId);
  }
  return Response.json({ received: true });
}
