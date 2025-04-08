// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
// REMOVED: No longer importing pdf-parse here for runtime execution
// import pdfParse from 'pdf-parse';
import pdfData from '@/generated/pdf-content.json'; // Import the pre-extracted data

// --- PDF Content Handling (Using Pre-extracted Data) ---
// Caching might be less critical now, but can still prevent repeated string access
let pdfContentCache: string | null = null;
let pdfCacheTimestamp: number | null = null;
const PDF_CACHE_DURATION = 10 * 60 * 1000; // Cache for 10 minutes (optional)

async function extractPdfContent(): Promise<string> {
    const now = Date.now();
    // Optional: Keep cache for performance if needed
    if (pdfContentCache && pdfCacheTimestamp && (now - pdfCacheTimestamp < PDF_CACHE_DURATION)) {
        // console.log("Returning PDF content from runtime cache."); // Less verbose log
        return pdfContentCache;
    }

    console.log("Loading pre-extracted PDF content from generated JSON...");
    try {
        // Access the content directly from the imported JSON
        // Make sure the structure matches what extract-pdf-text.mjs creates ({ "content": "..." })
        const content = pdfData.content;

        if (typeof content !== 'string') {
             console.error("Invalid or missing 'content' key in src/generated/pdf-content.json");
             throw new Error("Pre-extracted PDF content is invalid or missing 'content' key.");
        }

        if (content.length === 0) {
             console.warn("Warning: Pre-extracted PDF content loaded from JSON is empty.");
        }

        pdfContentCache = content;
        pdfCacheTimestamp = now; // Update cache timestamp if using cache
        console.log(`PDF content loaded from JSON. Length: ${pdfContentCache?.length ?? 0}`);
        return pdfContentCache;

    } catch (error) {
        console.error('--- Error loading pre-extracted PDF content ---');
        pdfContentCache = null; // Clear cache on error
        pdfCacheTimestamp = null;

        if (error instanceof Error) {
            console.error('Error details:', error.message);
             // Log stack trace for better debugging
            console.error('Stack Trace:', error.stack);
            // Re-throw a user-friendly error
            throw new Error(`Failed to load required PDF context from pre-generated data: ${error.message}`);
        } else {
            console.error('Unknown error loading PDF data:', error);
            throw new Error('An unknown error occurred while loading PDF context from pre-generated data');
        }
    }
}


// --- Enhanced Data Processing and Formatting ---

/**
 * Sanitizes graph data: corrects keys (incl. scatter x/y mapping), ensures numeric types.
 */
function sanitizeGraphData(graphData: any): any {
    // --- (This function remains exactly as it was) ---
    if (!graphData || typeof graphData !== 'object' || !graphData.type || !Array.isArray(graphData.data)) {
        console.warn("[sanitizeGraphData] Invalid graph data structure passed.");
        return graphData;
    }

    const graphType = graphData.type.toLowerCase();
    const dataArray = graphData.data;

    if (dataArray.length === 0 || typeof dataArray[0] !== 'object' || dataArray[0] === null) {
        console.warn("[sanitizeGraphData] Data array is empty or contains non-object items.");
        return graphData; // No data or invalid data items
    }

    const firstPoint = dataArray[0];
    let categoryKey = ''; // Primarily for non-scatter/pie charts
    let keyMappingNote = ""; // To track notes about key changes

    // --- Scatter Plot Specific Key Mapping ---
    if (graphType === 'scatter') {
        console.log("[sanitizeGraphData] Processing scatter plot...");
        let xAxisKeySource: string | null = null;
        let yAxisKeySource: string | null = null;

        // Attempt 1: Use options.xAxis.name / options.yAxis.name as hints
        const xAxisNameHint = graphData.options?.xAxis?.name;
        const yAxisNameHint = graphData.options?.yAxis?.name;

        if (xAxisNameHint && firstPoint.hasOwnProperty(xAxisNameHint)) {
            xAxisKeySource = xAxisNameHint;
            console.log(`Scatter: Identified '${xAxisNameHint}' as potential source for 'x'`);
        }
        if (yAxisNameHint && firstPoint.hasOwnProperty(yAxisNameHint)) {
            yAxisKeySource = yAxisNameHint;
            console.log(`Scatter: Identified '${yAxisNameHint}' as potential source for 'y'`);
        }

        // Attempt 2: Fallback - Find first two numeric keys if hints failed/missing
        if (!xAxisKeySource || !yAxisKeySource) {
            console.log("Scatter: Hints failed or missing, attempting fallback key identification.");
            const numericKeys = Object.keys(firstPoint).filter(key => typeof firstPoint[key] === 'number');
            if (!xAxisKeySource && numericKeys.length > 0) {
                xAxisKeySource = numericKeys[0];
                console.log(`Scatter Fallback: Using first numeric key '${xAxisKeySource}' for 'x'`);
            }
            if (!yAxisKeySource && numericKeys.length > 1 && numericKeys[1] !== xAxisKeySource) {
                yAxisKeySource = numericKeys[1];
                 console.log(`Scatter Fallback: Using second numeric key '${yAxisKeySource}' for 'y'`);
            }
        }

        // If we *still* don't have source keys, we cannot proceed with mapping
        if (!xAxisKeySource || !yAxisKeySource) {
            console.error("[sanitizeGraphData] Scatter plot: Failed to identify source keys for 'x' and 'y'. Data may not render correctly.");
            // Proceed with other sanitizations but mapping won't happen
        } else {
            // Map the data
            graphData.data = dataArray.map((dataPoint: any) => {
                 if (typeof dataPoint !== 'object' || dataPoint === null) return dataPoint;

                 const newDataPoint: Record<string, any> = {};
                 let xValue = dataPoint[xAxisKeySource!];
                 let yValue = dataPoint[yAxisKeySource!];

                 // Ensure numeric types for x and y
                 if (typeof xValue === 'string' && !isNaN(parseFloat(xValue))) xValue = parseFloat(xValue);
                 if (typeof yValue === 'string' && !isNaN(parseFloat(yValue))) yValue = parseFloat(yValue);

                 newDataPoint.x = xValue;
                 newDataPoint.y = yValue;

                 // Copy other properties (like labels, group identifiers, etc.)
                 for (const key in dataPoint) {
                     if (Object.prototype.hasOwnProperty.call(dataPoint, key) && key !== xAxisKeySource && key !== yAxisKeySource) {
                         // Sanitize other keys if needed (less critical for scatter unless used for labels/colors)
                         const sanitizedOtherKey = key.replace(/[\s.\-]+/g, '_');
                         newDataPoint[sanitizedOtherKey] = dataPoint[key];
                         if (sanitizedOtherKey !== key && !keyMappingNote.includes("Other keys sanitized")) {
                             keyMappingNote += " Other keys sanitized (e.g., spaces replaced with underscores).";
                         }
                     }
                 }
                 return newDataPoint;
            });
             keyMappingNote = `Keys mapped: '${xAxisKeySource}' -> 'x', '${yAxisKeySource}' -> 'y'.${keyMappingNote}`;
             console.log(`[sanitizeGraphData] Scatter plot data keys mapped: ${keyMappingNote}`);
              // Update axis labels in options if they were generic 'X'/'Y' but we used hints
              if (graphData.options?.xAxis?.name === 'X' && xAxisNameHint) graphData.options.xAxis.name = xAxisNameHint;
              if (graphData.options?.yAxis?.name === 'Y' && yAxisNameHint) graphData.options.yAxis.name = yAxisNameHint;
        }
    } else {
         // --- Identify Category Key for other chart types ---
         if (graphType === 'pie') categoryKey = 'name';
         else if (firstPoint.hasOwnProperty('name')) categoryKey = 'name';
         else { // Fallback for line/bar/area/composed without 'name'
             categoryKey = Object.keys(firstPoint).find(key => typeof firstPoint[key] === 'string') || '';
             if (categoryKey) console.log(`Using fallback category key '${categoryKey}' for ${graphType}`);
             else console.warn(`Could not determine category key for ${graphType}`);
         }
    }

    // --- General Sanitization (Keys, Numeric Types) - Applied AFTER scatter mapping ---
    const finalSanitizedData = (graphType === 'scatter' ? graphData.data : dataArray).map((dataPoint: any) => {
        if (typeof dataPoint !== 'object' || dataPoint === null) return dataPoint;

        const finalDataPoint: Record<string, any> = {};
        let keysSanitizedInPoint = false;

        for (const key in dataPoint) {
            if (!Object.prototype.hasOwnProperty.call(dataPoint, key)) continue;

            let currentKey = key;
            let value = dataPoint[key];

            // 1. Sanitize Keys (that aren't special scatter keys or category/label)
            if (graphType !== 'scatter' || (key !== 'x' && key !== 'y')) { // Don't rename x,y again
                 if (key !== categoryKey && key !== 'label' && key !== 'value') { // Exclude pie 'value' too
                     if (/[\s.\-]+/.test(key)) {
                         const sanitizedKey = key.replace(/[\s.\-]+/g, '_');
                         if (sanitizedKey !== key) {
                             currentKey = sanitizedKey;
                             keysSanitizedInPoint = true;
                         }
                     }
                 }
            }

            // 2. Ensure Numeric Types where expected (adjust logic slightly)
            const isPotentiallyNumericKey =
                (graphType === 'pie' && currentKey === 'value') ||
                (graphType === 'scatter' && (currentKey === 'x' || currentKey === 'y')) || // Check x,y are numbers
                (!['pie', 'scatter'].includes(graphType) && currentKey !== categoryKey && currentKey !== 'label'); // Non-cat keys for others

            if (isPotentiallyNumericKey && typeof value === 'string' && !isNaN(parseFloat(value))) {
                value = parseFloat(value);
            }

            finalDataPoint[currentKey] = value;
        }

         if (keysSanitizedInPoint && !keyMappingNote.includes("Keys sanitized") && graphType !== 'scatter') { // Avoid duplicate notes
             keyMappingNote = (keyMappingNote ? keyMappingNote + " " : "") + "Keys sanitized (e.g., spaces replaced with underscores).";
         }
        return finalDataPoint;
    });

    // Add note if keys were mapped/sanitized
     if (keyMappingNote) {
         if (!graphData.options) graphData.options = {};
         graphData.options.note = keyMappingNote.trim();
     }

    // Update chartConfig keys if necessary (for composed charts primarily)
     if (graphData.options?.note?.includes("Keys sanitized") && graphData.options?.chartConfig && Array.isArray(graphData.options.chartConfig)) {
          // Simplified check - assumes sanitation was consistent
          // A more robust check would involve building the full mapping again
          graphData.options.chartConfig = graphData.options.chartConfig.map(
              (config: any) => {
                  if (config.dataKey && /[\s.\-]+/.test(config.dataKey)) {
                      const sanitizedKey = config.dataKey.replace(/[\s.\-]+/g, '_');
                      // Check if the sanitized key actually exists in the final data
                       if (finalSanitizedData[0]?.hasOwnProperty(sanitizedKey)) {
                            console.log(`Sanitizing chartConfig key: '${config.dataKey}' -> '${sanitizedKey}'`);
                            return { ...config, dataKey: sanitizedKey };
                       }
                  }
                  return config;
              }
          );
      }

    return { ...graphData, data: finalSanitizedData };
}

/**
 * Sanitizes table data: ensures row length consistency.
 */
 function sanitizeTableData(tableData: any): any {
    // --- (This function remains exactly as it was) ---
    if (!tableData || typeof tableData !== 'object' || !Array.isArray(tableData.headers) || !Array.isArray(tableData.rows)) {
        console.warn("[sanitizeTableData] Invalid table data structure passed.");
        return tableData;
    }

    const headerCount = tableData.headers.length;
    let issuesFound = false;

    const sanitizedRows = tableData.rows.map((row: any, index: number) => {
        if (!Array.isArray(row)) {
            console.warn(`[sanitizeTableData] Table row ${index} is not an array, replacing with nulls.`);
            issuesFound = true;
            return new Array(headerCount).fill(null);
        }
        if (row.length !== headerCount) {
            console.warn(`[sanitizeTableData] Table row ${index} length mismatch (${row.length} vs ${headerCount}), padding/truncating.`);
            issuesFound = true;
            const correctedRow = new Array(headerCount).fill(null);
            for (let i = 0; i < Math.min(row.length, headerCount); i++) {
                correctedRow[i] = row[i];
            }
            return correctedRow;
        }
        return row;
    });

    if (issuesFound && !tableData.options?.note) {
        if (!tableData.options) tableData.options = {};
        tableData.options.note = "Table rows were corrected for consistency.";
    }

    return { ...tableData, rows: sanitizedRows };
}

/**
 * Processes AI response content to find, format, and sanitize graph/table data.
 * Attempts to add missing markers if valid JSON is found.
 */
function processAndEnsureDataFormatting(content: string): string {
    // --- (This function remains exactly as it was) ---
    const graphMarkerRegex = /<!--GRAPH_DATA:([\s\S]*?)-->/;
    const tableMarkerRegex = /<!--TABLE_DATA:([\s\S]*?)-->/;

    let graphMatch = content.match(graphMarkerRegex);
    let tableMatch = content.match(tableMarkerRegex);

    // Case 1: Correct markers exist
    if (graphMatch) {
        console.log("Found existing GRAPH_DATA marker. Processing...");
        try {
            let graphDataStr = graphMatch[1].trim();
            let graphData = JSON.parse(graphDataStr);
            graphData = sanitizeGraphData(graphData); // Apply enhanced sanitization
            return content.replace(graphMarkerRegex, `<!--GRAPH_DATA:${JSON.stringify(graphData, null, 2)}-->`);
        } catch (error) {
            console.warn("Failed to parse/sanitize existing graph data marker content:", error);
            return content;
        }
    } else if (tableMatch) {
        console.log("Found existing TABLE_DATA marker. Processing...");
        try {
            let tableDataStr = tableMatch[1].trim();
            let tableData = JSON.parse(tableDataStr);
            tableData = sanitizeTableData(tableData);
            return content.replace(tableMarkerRegex, `<!--TABLE_DATA:${JSON.stringify(tableData, null, 2)}-->`);
        } catch (error) {
            console.warn("Failed to parse/sanitize existing table data marker content:", error);
            return content;
        }
    } else {
        // Case 2: No markers, search for unmarked JSON
        console.log("No data markers found. Searching for potential unmarked JSON...");
        const potentialJsonRegex = /^\s*(\{[\s\S]*?(?:"type"|"data"|"options"|"title"|"headers"|"rows")[\s\S]*?\})\s*$|^\s*(\[[\s\S]*?(?:"name"|"value"|"x"|"y"|"label")[\s\S]*?\])\s*$/gm;
        let bestMatch: { data: any; originalString: string; type: 'graph' | 'table' } | null = null;
        let potentialMatch;
        potentialJsonRegex.lastIndex = 0;

        while ((potentialMatch = potentialJsonRegex.exec(content)) !== null) {
            const jsonString = (potentialMatch[1] || potentialMatch[2]).trim();
            try {
                const parsedData = JSON.parse(jsonString);
                if (parsedData && typeof parsedData === 'object') {
                    if (parsedData.type && parsedData.data && Array.isArray(parsedData.data)) {
                        console.log("Found potential unmarked graph JSON.");
                        bestMatch = { data: parsedData, originalString: jsonString, type: 'graph' };
                        break;
                    } else if (parsedData.headers && parsedData.rows && Array.isArray(parsedData.headers) && Array.isArray(parsedData.rows)) {
                        console.log("Found potential unmarked table JSON.");
                        bestMatch = { data: parsedData, originalString: jsonString, type: 'table' };
                        break;
                    }
                }
            } catch (e) { /* Ignore parsing errors for this segment */ }
        }

        // Case 3: Found valid unmarked data
        if (bestMatch) {
            console.log(`Processing and formatting unmarked ${bestMatch.type} data.`);
            try {
                const sanitizedData = bestMatch.type === 'graph'
                    ? sanitizeGraphData(bestMatch.data) // Apply enhanced sanitization
                    : sanitizeTableData(bestMatch.data);

                const marker = bestMatch.type === 'graph' ? '<!--GRAPH_DATA:' : '<!--TABLE_DATA:';
                const formattedBlock = `\n\n${marker}${JSON.stringify(sanitizedData, null, 2)}-->`;
                const cleanedContent = content.replace(bestMatch.originalString, '').trim();
                return cleanedContent + formattedBlock;
            } catch (processingError) {
                console.error(`Error processing/formatting the found unmarked ${bestMatch.type} data:`, processingError);
                return content;
            }
        } else {
            // Case 4: No markers, no suitable unmarked JSON
            console.log("No suitable unmarked JSON found to format.");
            return content;
        }
    }
}


// --- API Route Handler ---
export async function POST(request: Request) {
    // --- (This POST handler function remains exactly the same as before) ---
    // It will now call the *new* extractPdfContent which reads the JSON.
    console.log("Received POST request to /api/chat");
    try {
        const { messages } = await request.json();

        // Input Validation (Keep as is)
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.error("Invalid request body: 'messages' array missing, empty or invalid.");
            return NextResponse.json({ error: 'Invalid request body', details: 'Missing or invalid messages array' }, { status: 400 });
        }
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            console.error("Invalid message sequence: Last message not from user.");
            return NextResponse.json({ error: 'Invalid message sequence', details: 'Last message must be from user' }, { status: 400 });
        }

        // Get PDF Context (Uses the NEW JSON-reading function)
        console.log("Ensuring PDF context is available...");
        const pdfContent = await extractPdfContent(); // <-- Reads from imported JSON

        const maxContextChars = 8000; // Limit context size
        const contextSnippet = pdfContent.substring(0, maxContextChars);
        if (pdfContent.length > maxContextChars) {
            console.log(`PDF context truncated to ${maxContextChars} characters.`);
        }

        // --- System Prompt (Keep as is) ---
        // Ensure your full system prompt is pasted within the backticks
           // --- System Prompt (Keep your existing detailed prompt) ---
           const systemMessage = {
            role: "system",
            // --- PASTE YOUR FULL SYSTEM PROMPT HERE ---
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

             **CRITICAL FOR SCATTER PLOTS:** The data objects in the \`data\` array **MUST use the exact keys "x" and "y"** for the coordinate values. You can use \`options.xAxis.name\` and \`options.yAxis.name\` to provide human-readable labels for these axes. Other properties can be included for labels or grouping.
             *   **Correct Scatter Plot Data Example:**
                \`\`\`json
                [
                  {"x": 10, "y": 200, "label": "Point A", "group": "G1"},
                  {"x": 15.5, "y": 150.75, "label": "Point B", "group": "G2"}
                ]
                \`\`\`

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

            *   **Composed Chart Options:** Requires \`"chartConfig": [ { "type": "line|bar|area", "dataKey": "keyName" }, ... ]\` within \`options\`. Ensure \`dataKey\`s in chartConfig exist in the main \`data\` array objects and that their corresponding values **are JSON numbers**.

            **LINE GRAPH SPECIFIC INSTRUCTIONS:**
            For line graphs, ensure that:
            1. Each data point has a 'name' property (string) for X-axis labels.
            2. Each line series is represented by a property name in the data objects.
            3. CRITICAL: Property names for data series MUST NOT contain spaces, periods, or special characters. Use underscores instead.
               CORRECT: {"name": "Point 1", "series_1": 100, "series_2": 200}
               INCORRECT: {"name": "Point 1", "series 1": 100, "series.2": 200}
            4. ALL numeric values MUST be actual numbers (not strings).
            5. Set appropriate options for readability:
                * Include "xAxis" and "yAxis" labels in options
                * Consider adding a legend if multiple lines are present

            Line graph example with multiple series:
            \`\`\`json
            {
              "type": "line",
              "data": [
                {"name": "Depth 1000", "Pressure": 350.5, "Temperature": 45.2},
                {"name": "Depth 2000", "Pressure": 712.3, "Temperature": 65.8},
                {"name": "Depth 3000", "Pressure": 1045.7, "Temperature": 85.1}
              ],
              "options": {
                "xAxis": {"name": "Measurement Depth (ft)"},
                "yAxis": {"name": "Values"},
                "legend": true
              },
              "title": "Pressure and Temperature vs Depth"
            }
            \`\`\`

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
            // --- END OF SYSTEM PROMPT ---
        };

        const messagesWithContext = [systemMessage, ...messages];

        // Environment Variable Check (Keep as is)
        if (!process.env.OPENROUTER_API_KEY) {
            console.error("CRITICAL: OPENROUTER_API_KEY environment variable is not set.");
            throw new Error("Server configuration error: API Key is missing.");
        }

        // API Call Configuration (Keep as is)
        const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
        const apiKey = process.env.OPENROUTER_API_KEY;
        const siteUrlEnv = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Drilling Assistant';
        const modelToUse = 'nvidia/llama-3.1-nemotron-70b-instruct:free';
        const maxTokensToRequest = 4096;

        console.log(`Sending request to OpenRouter model: ${modelToUse} (Max Tokens: ${maxTokensToRequest})`);

        // Perform API Call (Keep as is)
        const response = await fetch(openRouterUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': siteUrlEnv,
                'X-Title': siteName,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: messagesWithContext,
                max_tokens: maxTokensToRequest,
            }),
        });
        console.log(`OpenRouter response status: ${response.status}`);

        // Robust Response Handling (Keep as is)
        let responseData;
        const contentType = response.headers.get("content-type");

        if (!contentType || !contentType.includes("application/json")) {
             const responseText = await response.text().catch(() => '[Could not read response text]');
             console.error(`OpenRouter API returned non-JSON response. Status: ${response.status}. Content-Type: ${contentType}. Body: ${responseText}`);
             return NextResponse.json({ error: 'API Error', details: `Upstream API returned unexpected content type '${contentType}'. Status: ${response.status}.` }, { status: 502 });
        }

        try {
            responseData = await response.json();
        } catch (e) {
            console.error("Failed to parse OpenRouter response JSON:", e);
            const responseText = await response.text().catch(() => '[Could not read response text]');
            console.error("Raw response text (if available):", responseText);
            return NextResponse.json({ error: 'API Error', details: `Upstream API returned invalid JSON. Status: ${response.status}.` }, { status: 502 });
        }

        // Handle OpenRouter's structured errors (Keep as is)
        if (responseData && responseData.error) {
            console.error('OpenRouter returned an error in the response body:', responseData.error);
            let statusCode = 502;
             const errorCode = responseData.error.code;
             const errorType = responseData.error.type;
             if (errorCode === 400 || errorType === 'invalid_request_error') statusCode = 400;
             else if (errorCode === 401 || errorType === 'authentication_error') statusCode = 401;
             else if (errorCode === 402 || errorType === 'billing_error') statusCode = 402;
             else if (errorCode === 429 || errorType === 'rate_limit_error') statusCode = 429;
             else if (errorCode >= 500 || errorType === 'api_error') statusCode = 502;
            const detailMessage = responseData.error.message || 'Unknown error from API provider.';
            return NextResponse.json({ error: 'API Request Failed', details: detailMessage, code: errorCode }, { status: statusCode });
        }

        // Handle general non-OK HTTP responses (Keep as is)
        if (!response.ok) {
             console.error(`OpenRouter API HTTP error: ${response.status} ${response.statusText}. Body: ${JSON.stringify(responseData)}`);
             const status = response.status >= 500 ? 502 : response.status;
             return NextResponse.json({ error: 'API Communication Error', details: `Upstream API request failed with status ${response.status}. ${responseData?.error?.message || response.statusText}` }, { status });
        }

        // Validate response structure (Keep as is)
        if (!responseData?.choices?.[0]?.message?.content) {
            console.error("Received successful status, but unexpected response structure from OpenRouter:", responseData);
            return NextResponse.json({ error: 'API Response Error', details: 'Received an unexpected response format from the AI provider.' }, { status: 500 });
        }

        // --- Apply Enhanced Formatting and Sanitization --- (Keep as is)
        console.log("--- Applying Enhanced Formatting/Sanitization ---");
        let originalContent = responseData.choices[0].message.content;
        let processedContent = processAndEnsureDataFormatting(originalContent);
        responseData.choices[0].message.content = processedContent;
        console.log("--- Finished Formatting/Sanitization ---");

        // --- Success --- (Keep as is)
        console.log("Successfully received and processed valid response from OpenRouter.");
        if (process.env.NODE_ENV === 'development') {
             if (originalContent !== processedContent) {
                 console.log("--- Content Modified by Formatting ---");
                 console.log("Processed:\n", processedContent);
                 console.log("--- End Content Modification ---");
             } else {
                  console.log("Content unchanged by formatting.")
             }
        }

        return NextResponse.json(responseData);

    } catch (error: unknown) {
        // --- Fatal Error Catch Block (Keep as is) ---
        // Should now only catch errors from JSON loading, API key, or OpenRouter call
        console.error('--- Fatal Error in /api/chat POST handler ---:', error);
        let errorMessage = 'An unknown server error occurred';
        let status = 500;

        if (error instanceof Error) {
            errorMessage = error.message;
             if (errorMessage.startsWith('Failed to load required PDF context')) {
                 console.error("Pre-extracted PDF Loading Error (caught by handler):", errorMessage);
             } else if (errorMessage.includes("API Key is missing")) {
                  console.error("API Key Configuration Error (caught by handler):", errorMessage);
             } else {
                 console.error(`Caught unexpected error in POST handler: ${errorMessage}`);
                 console.error('Stack Trace (if available):', error.stack);
             }
        } else {
             console.error(`Caught non-Error object in POST handler:`, error);
             errorMessage = 'An unexpected error type was encountered.'
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status });
    }
}