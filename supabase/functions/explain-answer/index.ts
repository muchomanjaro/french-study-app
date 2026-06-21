// Edge Function: explain-answer
// Calls Anthropic Claude Haiku to explain why an answer is correct/incorrect

import { Anthropic } from "https://esm.sh/@anthropic-ai/sdk@0.24.0";

interface ExplainRequest {
  prompt_sentence: string;
  entered: string;
  correct_answer: string;
  lesson_text: string;
}

interface ExplainResponse {
  explanation: string;
  is_correct: boolean;
  hints: string[];
}

Deno.serve(async (req: Request) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const body: ExplainRequest = await req.json();
    const { prompt_sentence, entered, correct_answer, lesson_text } = body;

    if (!prompt_sentence || !entered || !correct_answer) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers }
      );
    }

    const normalize = (s: string): string =>
      s.toLowerCase().replace(/\s+/g, " ").trim();

    const isCorrect = normalize(entered) === normalize(correct_answer);

    const systemPrompt = "You are a French language tutor. You help students understand why their answers are correct or incorrect. Explain the grammar rule or vocabulary point clearly and concisely in English. Be encouraging and educational. Keep explanations to 2-4 sentences. If the answer is wrong, give hints about what to correct.";

    const userPrompt = `The student was given this sentence to complete in French:\n"${prompt_sentence}"\n\nThey entered: "${entered}"\nThe correct answer was: "${correct_answer}"\n\n${lesson_text ? `Relevant lesson context: ${lesson_text}` : ""}\n\n${isCorrect ? "The student got it right! Briefly confirm their answer and explain why it is correct." : "The student got it wrong. Explain the mistake and provide a hint."}`;

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
      ],
    });

    const explanation = message.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n\n");

    const hints: string[] = [];
    if (!isCorrect) {
      if (explanation.toLowerCase().includes("tense")) hints.push("Check the tense");
      if (explanation.toLowerCase().includes("agreement")) hints.push("Check for gender/number agreement");
      if (explanation.toLowerCase().includes("conjugat")) hints.push("Verify the verb conjugation");
      if (explanation.toLowerCase().includes("preposition")) hints.push("Double-check the preposition");
      if (hints.length === 0) hints.push("Review the lesson material above");
    }

    const result: ExplainResponse = {
      explanation,
      is_correct: isCorrect,
      hints,
    };

    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    console.error("Error in explain-answer:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers }
    );
  }
});
