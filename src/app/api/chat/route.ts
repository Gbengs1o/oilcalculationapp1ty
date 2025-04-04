// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// Cache for PDF content
let pdfContentCache: string | null = null;

// Function to extract text from PDF (keep your existing robust version)
async function extractPdfContent(): Promise<string> {
  if (pdfContentCache) {
    console.log("Returning PDF content from cache.");
    return pdfContentCache;
  }
  try {
    const pdfRelativePath = path.join('test', 'data', '05-versions-space.pdf');
    const pdfPath = path.join(process.cwd(), pdfRelativePath);
    console.log(`Attempting to read PDF from: ${pdfPath}`);
    await fs.access(pdfPath); // Check access
    console.log(`PDF file found at: ${pdfPath}`);
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    pdfContentCache = data.text;
    console.log(`PDF content extracted and cached. Length: ${pdfContentCache?.length ?? 0}`);
    return pdfContentCache;
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    if (error instanceof Error) {
        // Add more specific error info if file not found
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             throw new Error(`PDF file not found at specified path: ${path.join(process.cwd(), 'test', 'data', '05-versions-space.pdf')}`);
        }
        throw error;
    } else {
        throw new Error(String(error) || 'Unknown error during PDF extraction');
    }
  }
}

export async function POST(request: Request) {
  console.log("Received POST request to /api/chat");
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
        console.error("Invalid request body: 'messages' array missing or invalid.");
        return NextResponse.json({ error: 'Invalid request body: Missing messages array' }, { status: 400 });
    }

    console.log("Ensuring PDF content is available...");
    const pdfContent = await extractPdfContent();

    const maxChars = 10000;
    const contextSnippet = pdfContent.substring(0, maxChars);
    if (pdfContent.length > maxChars) {
        console.log(`PDF content truncated to ${maxChars} characters for context.`);
    }

    // --- *** EVEN MORE EXPLICIT SYSTEM MESSAGE *** ---
    const systemMessage = {
      role: "system",
      content: `You are an expert assistant specializing in oil engineering formulas and calculations, using knowledge ONLY from the provided PDF context. If the answer isn't in the context, say so.

      **CRITICAL FORMATTING RULES:**

      1.  **LaTeX for ALL Math:** ALL mathematical formulas, equations, variables (even single letters like V, r, P), units (like ft³, m/s²), and symbols (like π, ρ) MUST be enclosed in LaTeX delimiters.
          *   Use $...$ for inline math (within a sentence). Example: "The volume is calculated using $V = \pi r^2 L$."
          *   Use $$...$$ for display math (equations on their own line). Example:
              $$ SA = 2 \pi r (r + L) $$
      2.  **NO MARKDOWN FOR MATH:** Do NOT use Markdown like **, ##, \`\`\`, or * for lists when presenting formulas or mathematical content. Use LaTeX delimiters ONLY as described above.
      3.  **NO HTML TAGS:** Do NOT use HTML tags like <br />, <p>, <strong>, etc. Use standard newline characters for paragraph breaks where appropriate in explanatory text.
      4.  **Standard Text for Explanations:** Use plain text for descriptions and explanations. Use standard Markdown lists (* or -) ONLY for non-formula lists if needed.
      5.  **Consistency:** Ensure all variables mentioned in explanations are also enclosed in $ $, e.g., "where $P$ is pressure and $A$ is area."

      **Example of CORRECT Formatting:**
      ## Fluid Pressure
      The pressure $P$ exerted by a fluid is calculated using the formula:
      $$ P = \rho g h $$
      where:
      *   $P$ = Pressure (units of force per unit area)
      *   $\rho$ = Density of the fluid (units of mass per unit volume)
      *   $g$ = Acceleration due to gravity (e.g., $9.81 \, m/s^2$)
      *   $h$ = Depth of the fluid (linear units)

      **Example of INCORRECT Formatting (DO NOT DO THIS):**
      **Fluid Pressure (P):** <br /> **P = ρ \* g \* h** <br /> where: <br/> * P = ...

      Follow these formatting rules STRICTLY.

      --- PDF Context Start ---
      ${contextSnippet}
      --- PDF Context End ---`
    };
    // --- *** END OF REVISED SYSTEM MESSAGE *** ---


    const messagesWithContext = [systemMessage, ...messages];

    if (!process.env.OPENROUTER_API_KEY) {
        console.error("CRITICAL: OPENROUTER_API_KEY environment variable is not set.");
        throw new Error("Server configuration error: Missing API Key.");
    }

    const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
    const apiKey = process.env.OPENROUTER_API_KEY;
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const siteName = process.env.SITE_NAME || 'Drilling Formula Assistant';

    // Consider trying a model known for better instruction following if Gemini still fails
    // const modelToUse = 'anthropic/claude-3-haiku';
    // const modelToUse = 'google/gemini-flash-1.5';
    const modelToUse = 'google/gemini-pro';


    console.log(`Sending request to OpenRouter model: ${modelToUse}`);
    const response = await fetch(openRouterUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: messagesWithContext,
      }),
    });

    console.log(`OpenRouter response status: ${response.status}`);

    if (!response.ok) {
        let errorBody = 'Could not read error body.';
        try { errorBody = await response.text(); } catch (_) { /* ignore */ }
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        throw new Error(`OpenRouter API request failed with status ${response.status}: ${errorBody.substring(0, 500)}`);
    }

    const data = await response.json();

    // Log the raw response here *before* sending it to the client
    // This helps verify if the AI adhered to the new instructions
    if (data?.choices?.[0]?.message?.content) {
         console.log("--- Raw AI Response Received ---");
         console.log(data.choices[0].message.content);
         console.log("--- End Raw AI Response ---");
    } else {
         console.log("AI response structure might be different or empty.");
         console.log("Raw data:", JSON.stringify(data));
    }


    console.log("Successfully received response from OpenRouter. Sending to client.");
    return NextResponse.json(data);

  } catch (error) {
    console.error('--- Error in /api/chat POST handler ---:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred';
    if (process.env.NODE_ENV === 'development' && error instanceof Error) {
        console.error('Error stack:', error.stack);
    }
    return NextResponse.json({
      error: 'Failed to process chat request',
      details: errorMessage,
    }, { status: 500 });
  }
}