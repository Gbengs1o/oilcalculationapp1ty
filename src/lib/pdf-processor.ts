// src/lib/pdf-processor.ts
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
// Optional: Only if calculating similarity manually
import cosineSimilarity from 'cosine-similarity';

// --- Configuration ---
const PDF_PATH = path.join(process.cwd(), "src", "pdfs", "Formulas and Calculations in Drilling.pdf"); // IMPORTANT: Update this path!
const CHUNK_SIZE = 1000; // Approx. characters per chunk (adjust as needed)
const CHUNK_OVERLAP = 100; // Overlap between chunks (helps context flow)

// --- In-Memory Storage ---
// CAUTION: This data will be lost if the server restarts.
// For production, use a proper vector database (Pinecone, ChromaDB, etc.)
interface PdfChunk {
    text: string;
    embedding: number[]; // Array of numbers representing the vector
}
let processedChunks: PdfChunk[] = [];
let isProcessingComplete = false;

// --- Placeholder for Embedding Function ---
// This needs to call your chosen embedding model API (e.g., via OpenRouter or another service)
async function getEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`Requesting embeddings for ${texts.length} text chunks...`);
    // ---- START: Replace with actual API call ----
    // Example structure assuming an OpenRouter endpoint for embeddings
    // You'll need to find a suitable embedding model on OpenRouter
    // and adjust the API endpoint and request structure accordingly.
    const embeddingModel = 'openai/text-embedding-ada-002'; // EXAMPLE MODEL - CHECK OPENROUTER DOCS

    try {
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', { // CHECK Endpoint
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, // Use the same key? Check OR docs
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: embeddingModel,
                input: texts,
            }),
        });

        if (!response.ok) {
            throw new Error(`Embedding API request failed: ${response.statusText}`);
        }
        const data = await response.json();

        // --- IMPORTANT: Adjust based on actual API response structure ---
        if (data.data && Array.isArray(data.data)) {
             console.log(`Received ${data.data.length} embeddings.`);
             return data.data.map((item: any) => item.embedding); // Assumes structure { data: [ { embedding: [...] }, ... ] }
        } else {
             throw new Error("Unexpected embedding API response structure");
        }
       // ---- END: Replace with actual API call ----

    } catch (error) {
        console.error("Failed to get embeddings:", error);
        // Return empty arrays or handle error appropriately
        return texts.map(() => []); // Return empty embeddings on error
    }
}

// --- Text Chunking Function ---
function chunkText(text: string, size: number, overlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + size, text.length);
        chunks.push(text.slice(i, end));
        i += size - overlap;
        if (end === text.length) break; // Reached the end
    }
    return chunks;
}


// --- Main Processing Function ---
export async function processAndEmbedPdf() {
    if (isProcessingComplete) {
        console.log("PDF already processed.");
        return;
    }
    console.log("Starting PDF processing...");
    try {
        // 1. Read PDF
        const dataBuffer = await fs.readFile(PDF_PATH);
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;
        console.log(`Extracted ${text.length} characters from PDF.`);

        // 2. Chunk Text
        // Simple split by double newline first, then refine might be better
        // Or use a dedicated library like langchain/text_splitter
        const textChunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
        console.log(`Split text into ${textChunks.length} chunks.`);

        if (textChunks.length === 0) {
            throw new Error("No text chunks generated. Check PDF content and chunking logic.");
        }

        // 3. Get Embeddings for Chunks
        const embeddings = await getEmbeddings(textChunks);

        if (embeddings.length !== textChunks.length) {
             throw new Error("Mismatch between number of chunks and embeddings received.");
        }

        // 4. Store Chunks and Embeddings in Memory
        processedChunks = textChunks.map((chunkText, index) => ({
            text: chunkText,
            embedding: embeddings[index],
        })).filter(chunk => chunk.embedding && chunk.embedding.length > 0); // Filter out potential errors

         if (processedChunks.length === 0 && textChunks.length > 0) {
            throw new Error("No valid embeddings were stored. Check embedding API call and response.");
        }

        isProcessingComplete = true;
        console.log(`PDF processing complete. Stored ${processedChunks.length} chunks with embeddings.`);

    } catch (error) {
        console.error("Error processing PDF:", error);
        // Decide how to handle failure: maybe retry, log, or prevent app start
        isProcessingComplete = false; // Ensure we know processing failed
        processedChunks = []; // Clear any partial data
    }
}

// --- Similarity Search Function ---
// Finds the top N chunks most similar to the query embedding
export async function findSimilarChunks(query: string, topN: number = 3): Promise<string[]> {
    if (!isProcessingComplete || processedChunks.length === 0) {
        console.warn("PDF not processed or no chunks available for search.");
        return []; // Return empty if PDF isn't ready
    }

    try {
        // 1. Embed the query
        const queryEmbeddingResult = await getEmbeddings([query]);

        if (!queryEmbeddingResult || queryEmbeddingResult.length === 0 || queryEmbeddingResult[0].length === 0) {
             console.error("Failed to get embedding for the query.");
             return [];
        }
        const queryEmbedding = queryEmbeddingResult[0];


        // 2. Calculate Similarities (using cosine similarity)
        const similarities = processedChunks.map((chunk, index) => {
            // Ensure chunk embedding is valid before calculating similarity
            if (!chunk.embedding || chunk.embedding.length !== queryEmbedding.length) {
                console.warn(`Skipping chunk index ${index} due to invalid embedding.`);
                return { score: -1, index }; // Assign a low score for invalid embeddings
            }
            // --- Cosine Similarity Calculation ---
            // You might use a library or implement it manually if needed.
            // The 'cosine-similarity' library expects simple arrays.
             const score = cosineSimilarity(queryEmbedding, chunk.embedding);
             return { score, index };
        });


        // 3. Sort by Score and Get Top N
        similarities.sort((a, b) => b.score - a.score); // Sort descending

        const topResults = similarities.slice(0, topN);

        // 4. Return the text of the top chunks
        return topResults.map(result => processedChunks[result.index]?.text).filter(Boolean); // Filter out undefined texts

    } catch (error) {
        console.error("Error finding similar chunks:", error);
        return [];
    }
}