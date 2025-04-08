// scripts/extract-pdf-text.mjs
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';

// --- Configuration ---
// Path to the original PDF relative to the project root
const pdfSourceRelativePath = path.join('test', 'data', '05-versions-space.pdf');
// Output path for the generated JSON relative to the project root
const outputRelativePath = path.join('src', 'generated', 'pdf-content.json');
// --------------------

// Resolve absolute paths
const pdfPath = path.resolve(pdfSourceRelativePath);
const outputPath = path.resolve(outputRelativePath);
const outputDir = path.dirname(outputPath);

async function run() {
  console.log(`Starting PDF text extraction from: ${pdfPath}`);
  try {
    // Check if source file exists
    try {
        await fs.access(pdfPath);
        console.log(`Source PDF found.`);
    } catch (accessError) {
        console.error(`!!! Error: Source PDF file not found at ${pdfPath}`);
        console.error(`!!! Please ensure the file exists and the path in extract-pdf-text.mjs is correct.`);
        process.exit(1); // Exit with error code
    }

    // Read the source PDF
    const dataBuffer = await fs.readFile(pdfPath);
    console.log(`Read ${dataBuffer.byteLength} bytes from PDF.`);

    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    const content = data.text || ''; // Use extracted text or empty string

    console.log(`Extracted text length: ${content.length}`);
    if (content.length === 0) {
         console.warn(`Warning: Extracted text is empty. Check the PDF content.`);
    }

    // Ensure the output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Ensured output directory exists: ${outputDir}`);

    // Prepare the data to be saved as JSON
    const jsonData = JSON.stringify({ content: content }, null, 2); // Pretty print JSON

    // Write content to the JSON file
    await fs.writeFile(outputPath, jsonData);
    console.log(`✅ PDF content successfully written to: ${outputPath}`);

  } catch (error) {
    console.error('--- Fatal Error during PDF text extraction ---');
    console.error(error);
    process.exit(1); // Signal build failure
  }
}

// Execute the script
run();