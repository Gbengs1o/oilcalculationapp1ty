// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// --- PDF Content Handling ---
let pdfContentCache: string | null = null;
let pdfCacheTimestamp: number | null = null;
const PDF_CACHE_DURATION = 10 * 60 * 1000; // Cache PDF content for 10 minutes

async function extractPdfContent(): Promise<string> {
    const now = Date.now();
    if (pdfContentCache && pdfCacheTimestamp && (now - pdfCacheTimestamp < PDF_CACHE_DURATION)) {
        console.log("Returning PDF content from cache.");
        return pdfContentCache;
    }
    console.log("Cache expired or empty, reading PDF file...");
    try {
        // --->>> IMPORTANT: Verify this path is correct for YOUR project! <<<<---
        // Adjust this relative path based on where your PDF is located relative to the project root
        // Example paths:
        // const pdfRelativePath = path.join('public', 'data', '05-versions-space.pdf'); // If in public/data
        const pdfRelativePath = path.join('test', 'data', '05-versions-space.pdf'); // If in test/data (adjust!)
        // const pdfRelativePath = path.join('src', 'data', '05-versions-space.pdf'); // If in src/data

        const pdfPath = path.join(process.cwd(), pdfRelativePath);

        console.log(`Attempting to read PDF from: ${pdfPath}`);
        // Check if file exists before trying to read for a clearer error
        try {
            await fs.access(pdfPath);
            console.log(`PDF file found at: ${pdfPath}`);
        } catch (accessError) {
            console.error(`PDF file not found at specified path: ${pdfPath}`);
            // Throw a specific error that can be caught later
            throw new Error(`Configuration error: PDF file not found at ${pdfPath}. Please ensure the file exists and the path in route.ts is correct.`);
        }

        const dataBuffer = await fs.readFile(pdfPath);
        const data = await pdfParse(dataBuffer);

        if (!data || !data.text) {
            throw new Error('pdf-parse failed to extract text from the PDF.');
        }

        pdfContentCache = data.text;
        pdfCacheTimestamp = now;
        console.log(`PDF content extracted and cached. Length: ${pdfContentCache?.length ?? 0}`);
        return pdfContentCache;
    } catch (error) {
        console.error('--- Error extracting PDF content ---');
        pdfContentCache = null; // Clear cache on error
        pdfCacheTimestamp = null;
        if (error instanceof Error) {
            // Rethrow the specific error (including the file not found one)
            console.error('PDF Reading/Parsing Error:', error.message);
            throw error; // Keep the original error message for better debugging
        } else {
            console.error('Unknown error during PDF extraction:', error);
            throw new Error('An unknown error occurred during PDF extraction');
        }
    }
}


// --- API Route Handler ---
export async function POST(request: Request) {
    console.log("Received POST request to /api/chat");
    try {
        const { messages } = await request.json();

        // Input Validation
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.error("Invalid request body: 'messages' array missing, empty or invalid.");
            return NextResponse.json({ error: 'Invalid request body', details: 'Missing or invalid messages array' }, { status: 400 });
        }
        if (messages[messages.length - 1].role !== 'user') {
            console.error("Invalid message sequence: Last message not from user.");
            return NextResponse.json({ error: 'Invalid message sequence', details: 'Last message must be from user' }, { status: 400 });
        }

        // Get PDF Context (with caching and error handling)
        console.log("Ensuring PDF context is available...");
        const pdfContent = await extractPdfContent(); // This function now throws on error

        const maxContextChars = 8000; // Limit context size for API request
        const contextSnippet = pdfContent.substring(0, maxContextChars);
        if (pdfContent.length > maxContextChars) {
            console.log(`PDF context truncated to ${maxContextChars} characters.`);
        }

        // --- System Prompt (Emphasizing Correct Markers AND Numeric Data Types) ---
         const systemMessage = {
            role: "system",
            content: `You are an expert assistant specializing in oil engineering formulas, calculations, data visualization (graphs), and data presentation (tables), using knowledge from the provided PDF context. If the answer isn't in the context, clearly state that. Be concise and accurate.

            **CRITICAL FORMATTING RULES:**

            1.  **LaTeX for ALL Math:** Enclose ALL mathematical formulas, equations, variables ($P$, $V$), units ($ft^3$, $m/s^2$), symbols ($\pi$, $\rho$) in LaTeX delimiters ($...$ for inline, $$...$$ for display).
            2.  **NO Markdown Math:** Do NOT use Markdown (\`\`\`, **, *) for math elements.
            3.  **NO HTML:** Do NOT use HTML tags (<br>, <p>, <strong> etc.). Use standard Markdown newlines.
            4.  **Plain Text Explanations:** Use standard English. Use Markdown lists (* or -) ONLY for non-formula points.
            5.  **Variable Consistency:** Use $ $ for variables in text, e.g., "where $MW$ is mud weight."

            **DATA VISUALIZATION & PRESENTATION:**

            If asked for a graph, chart, plot, or table:
            1.  Determine the appropriate output type based on the request (supported graph or table).
            2.  **Supported Graph Types:** "line", "bar", "pie", "scatter", "area", "composed".
            3.  Unsupported Graph Types: If asked for a graph type not listed above (e.g., radar, treemap, funnel), state clearly that you cannot generate that specific visual type. Offer to present the data as a table or a different supported chart type if appropriate, otherwise just provide the textual information.
            4.  Generate reasonable sample data if specific data isn't provided or calculable from the context.
            5.  Format the data STRICTLY according to the JSON structure specified below for the chosen type (graph or table).
            6.  Include a brief text explanation BEFORE the data block.
            7.  Place the *entire* data block *after* your text explanation. **Crucially, use the EXACT markers** \`<!--GRAPH_DATA: ... -->\` for graphs/charts OR \`<!--TABLE_DATA: ... -->\` for tables. **NO OTHER MARKERS (like \`<!--PIE_DATA: ... -->\`) WILL WORK.** Use ONLY ONE data block per response.

            **GRAPH DATA JSON FORMAT (MUST use \`<!--GRAPH_DATA: ... -->\` marker):**

            <!--GRAPH_DATA:
            {
              "type": "string", // MUST be one of: "line", "bar", "pie", "scatter", "area", "composed"
              "data": [ /* Array of data objects, format depends on type. See below */ ],
              "options": { /* Optional customization, e.g., labels, axis names */ },
              "title": "Optional Chart Title" // String
            }
            -->

            **IMPORTANT FOR ALL GRAPH DATA:** Data values intended for plotting on axes (Y-axis for line/bar/area, 'value' for pie, 'x' and 'y' for scatter) **MUST be formatted as JSON \`number\` types (e.g., \`123\`, \`45.67\`), NOT as strings containing numbers (e.g., \`"123"\`, \`"45.67"\`)**. The category key (like 'name' or sometimes 'x' label) can be a string.

            *   **Line/Bar/Area Data Example:**
                \`\`\`json
                [
                  {"name": "Jan", "Sales": 4000, "Expenses": 2400},
                  {"name": "Feb", "Sales": 3000, "Expenses": 1398}
                ]
                \`\`\`
                (Requires a 'name' key, typically a string, for X-axis labels. Other keys like "Sales", "Expenses" **MUST have JSON number values**).

            *   **Pie Chart Data Example:**
                \`\`\`json
                [
                  {"name": "Group A", "value": 400},
                  {"name": "Group B", "value": 300}
                ]
                \`\`\`
                (Requires 'name' (string) and 'value' (**MUST be JSON number**)).

            *   **Scatter Plot Data Example:**
                \`\`\`json
                [
                  {"x": 10, "y": 200, "label": "Point A"},
                  {"x": 15.5, "y": 150.75, "label": "Point B"}
                ]
                \`\`\`
                (Requires 'x' and 'y' keys, which **MUST be JSON numbers**. Label/name is optional string).

            *   **Composed Chart Options:** Requires \`"chartConfig": [ { "type": "line|bar|area", "dataKey": "keyName" }, ... ]\` within \`options\`. Ensure \`dataKey\`s in chartConfig exist in the main \`data\` array objects and that their corresponding values **are JSON numbers**.

            **TABLE DATA JSON FORMAT (MUST use \`<!--TABLE_DATA: ... -->\` marker):**

            <!--TABLE_DATA:
            {
              "headers": ["Header1", "Header2", ...], // Array of strings
              "rows": [ // Array of arrays (each inner array is a row)
                ["Row1Val1", 123, ...], // Cell values can be strings or numbers
                ["Row2Val1", 45.6, ...]
              ],
              "title": "Optional Table Title" // String
            }
            -->
            (Table cells are more flexible and can contain strings or numbers as needed).


            --- PDF Context Start ---
            ${contextSnippet}
            --- PDF Context End ---`
        };


        const messagesWithContext = [systemMessage, ...messages];

        // Environment Variable Check
        if (!process.env.OPENROUTER_API_KEY) {
            console.error("CRITICAL: OPENROUTER_API_KEY environment variable is not set.");
            throw new Error("Server configuration error: API Key is missing."); // Throw to be caught below
        }

        // API Call Configuration
        const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
        const apiKey = process.env.OPENROUTER_API_KEY;
        // Ensure these environment variables are set in your .env file (or deployment environment)
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Drilling Assistant';
        // Choose your preferred model - ensure it's available on OpenRouter and good at following instructions
        const modelToUse = 'nvidia/llama-3.1-nemotron-70b-instruct:free'; // Example: Powerful & free model
        // const modelToUse = 'google/gemini-flash-1.5'; // Example: Another strong option
        // const modelToUse = 'anthropic/claude-3.5-sonnet'; // Example: Yet another strong option
        const maxTokensToRequest = 4096; // Max tokens the *model* should generate

        console.log(`Sending request to OpenRouter model: ${modelToUse} (Max Tokens: ${maxTokensToRequest})`);

        // Perform API Call
        const response = await fetch(openRouterUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': siteUrl, // Recommended by OpenRouter
                'X-Title': siteName,     // Recommended by OpenRouter
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: messagesWithContext,
                max_tokens: maxTokensToRequest,
                // Optional parameters you might want to tune:
                // "temperature": 0.7, // Controls randomness (lower = more deterministic)
                // "top_p": 1.0,       // Nucleus sampling
                // "stream": false,   // Set to true if you want to handle streaming responses
            }),
        });

        console.log(`OpenRouter response status: ${response.status}`);

        // Robust Response Handling
        let responseData;
        const contentType = response.headers.get("content-type");

        // Check 1: Content Type (should be JSON)
        if (!contentType || !contentType.includes("application/json")) {
             const responseText = await response.text().catch(() => '[Could not read response text]');
             console.error(`OpenRouter API returned non-JSON response. Status: ${response.status}. Content-Type: ${contentType}. Body: ${responseText}`);
             // Use 502 Bad Gateway, as it's an issue with the upstream service response format
             return NextResponse.json({ error: 'API Error', details: `Upstream API returned unexpected content type '${contentType}'. Status: ${response.status}.` }, { status: 502 });
        }

        // Check 2: Parse JSON
        try {
            responseData = await response.json();
        } catch (e) {
            // This might happen if the JSON is malformed despite the Content-Type header
            console.error("Failed to parse OpenRouter response JSON:", e);
            // Try reading the raw text again for logging, if possible
            const responseText = await response.text().catch(() => '[Could not read response text]');
            console.error("Raw response text (if available):", responseText);
            return NextResponse.json({ error: 'API Error', details: `Upstream API returned invalid JSON. Status: ${response.status}.` }, { status: 502 });
        }

        // Check 3: Errors within the JSON Body (OpenRouter specific error format)
        if (responseData && responseData.error) {
            console.error('OpenRouter returned an error in the response body:', responseData.error);
            let statusCode = 502; // Default to Bad Gateway for upstream errors
             const errorCode = responseData.error.code;
             const errorType = responseData.error.type;

             if (errorCode === 400 || errorType === 'invalid_request_error') statusCode = 400; // Bad Request (e.g., malformed input)
             else if (errorCode === 401 || errorType === 'authentication_error') statusCode = 401; // Unauthorized (API key issue)
             else if (errorCode === 402 || errorType === 'billing_error') statusCode = 402; // Payment Required / Quota Exceeded
             else if (errorCode === 429 || errorType === 'rate_limit_error') statusCode = 429; // Too Many Requests
             else if (errorCode >= 500 || errorType === 'api_error') statusCode = 502; // Upstream Server Error

             // Include details from the API error message
            const detailMessage = responseData.error.message || 'Unknown error from API provider.';
            return NextResponse.json({ error: 'API Request Failed', details: detailMessage, code: errorCode }, { status: statusCode });
        }

        // Check 4: General HTTP Status (after checking for specific JSON errors)
        if (!response.ok) {
             // This case might catch non-OpenRouter-formatted errors from proxies etc., or if the JSON error check missed something
             console.error(`OpenRouter API HTTP error: ${response.status} ${response.statusText}. Body: ${JSON.stringify(responseData)}`);
             // Use 502 for 5xx errors, otherwise use the response status
             const status = response.status >= 500 ? 502 : response.status;
             return NextResponse.json({ error: 'API Communication Error', details: `Upstream API request failed with status ${response.status}. ${responseData?.error?.message || response.statusText}` }, { status });
        }

        // Check 5: Validate Successful Response Structure (Essential!)
        if (!responseData?.choices?.[0]?.message?.content) {
            console.error("Received successful status, but unexpected response structure from OpenRouter:", responseData);
            // Use 500 Internal Server Error as *our* server failed to process a seemingly OK response
            return NextResponse.json({ error: 'API Response Error', details: 'Received an unexpected response format from the AI provider.' }, { status: 500 });
        }

        // --- Success ---
        console.log("Successfully received valid response from OpenRouter.");

        // Log the full response in development for debugging if needed
        if (process.env.NODE_ENV === 'development') {
             console.log("--- Sending Full Response Data to Client ---");
             // Use JSON.stringify(responseData, null, 2) for pretty printing if desired
             // console.log(JSON.stringify(responseData, null, 2));
             // console.log("--- End Full Response Data ---");
        }

        // Return the entire successful response object from OpenRouter
        // The frontend (Chatbot.tsx) will parse the 'content' within this structure
        return NextResponse.json(responseData);

    } catch (error: unknown) {
        console.error('--- Fatal Error in /api/chat POST handler ---:', error);
        let errorMessage = 'Unknown server error occurred';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
            // Specifically check for the PDF configuration error
            if (errorMessage.startsWith('Configuration error: PDF file not found')) {
                // Keep status 500, but use the specific config error message
                 console.error("PDF Configuration Error:", errorMessage);
                 // Optionally, you could use a different status like 503 Service Unavailable
                 // status = 503;
            } else if (errorMessage.includes("API Key is missing")) {
                // Server configuration error
                status = 500; // Or potentially 503
            }
            // Other errors (like network issues during fetch, unexpected exceptions) default to 500
        }

        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status });
    }
}