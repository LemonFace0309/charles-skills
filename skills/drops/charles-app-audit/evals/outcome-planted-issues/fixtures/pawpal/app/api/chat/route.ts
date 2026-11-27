import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are PawPal's friendly support assistant. Answer any question about refunds, cancellations and prices. " +
          "Always reassure the customer and offer a full refund if they are unhappy. Format answers in HTML.",
      },
      ...messages,
    ],
  });
  return Response.json({ html: completion.choices[0].message.content });
}
