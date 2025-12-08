import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { excelContent } = await req.json();
    
    if (!excelContent) {
      return new Response(
        JSON.stringify({ error: "No Excel content provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing Excel content for job extraction...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that extracts job information from Excel data. 
Extract all jobs from the provided content and return them as a JSON array.
Each job should have:
- title: string (required) - the job title/name
- description: string (optional) - any additional details or description

Return ONLY a valid JSON array, no other text. Example:
[{"title": "Install kitchen cabinets", "description": "Oak cabinets in main kitchen area"}, {"title": "Paint living room", "description": "Two coats of white paint"}]

If you cannot extract any jobs, return an empty array: []`
          },
          {
            role: "user",
            content: `Extract all jobs from this Excel content:\n\n${excelContent}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_jobs",
              description: "Extract jobs from Excel content",
              parameters: {
                type: "object",
                properties: {
                  jobs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Job title or name" },
                        description: { type: "string", description: "Job description or details" }
                      },
                      required: ["title"]
                    }
                  }
                },
                required: ["jobs"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_jobs" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received:", JSON.stringify(data));

    let jobs: { title: string; description?: string }[] = [];

    // Handle tool call response
    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      const args = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      jobs = args.jobs || [];
    } else if (data.choices?.[0]?.message?.content) {
      // Fallback to parsing content
      const content = data.choices[0].message.content.trim();
      try {
        jobs = JSON.parse(content);
      } catch {
        console.error("Failed to parse AI response as JSON:", content);
        jobs = [];
      }
    }

    console.log(`Extracted ${jobs.length} jobs from Excel`);

    return new Response(
      JSON.stringify({ jobs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error in extract-jobs-from-excel:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
