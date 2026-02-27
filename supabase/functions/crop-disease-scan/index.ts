import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { imageBase64, cropType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert agricultural plant pathologist. Your task is to accurately identify the plant and its disease from the provided image.
        
        DIAGNOSTIC GUIDELINES:
        1. Identify the crop first, then the specific disease/pest/deficiency.
        2. If the plant is healthy, state "Healthy [Crop Name]".
        3. Be precise with scientific and common names.
        4. Focus on visual indicators: leaf spots, lesions, discoloration, wilting, or fungal growth.
        5. If multiple issues are present, identify the most significant one.

        REQUIRED OUTPUT FORMAT (JSON ONLY):
        {
          "disease": "Specific Disease Name (Common Name)",
          "confidence": number,
          "severity": "Low|Medium|High",
          "symptoms": ["list of visible symptoms"],
          "treatment": "Detailed treatment plan (Chemical + Organic)",
          "prevention": "Pratical prevention steps"
        }`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Identify the disease in this ${cropType || "crop"} leaf image. Be as accurate as possible.` },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        top_p: 0.95,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const result = JSON.parse(content.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
