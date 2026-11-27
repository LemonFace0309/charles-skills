import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  const { phone } = await req.json();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await client.messages.create({ to: phone, from: process.env.TWILIO_FROM!, body: `Your PawPal code is ${code}` });
  // TODO store the code
  return Response.json({ ok: true });
}
