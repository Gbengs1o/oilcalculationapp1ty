// c:/Users/USER/Documents/code/next.js/BrotherOla's site/oilapp1ty/types/cosine-similarity.d.ts

declare module 'cosine-similarity' {
    /**
     * Calculates the cosine similarity between two vectors (arrays of numbers).
     * @param vec1 The first vector.
     * @param vec2 The second vector.
     * @returns The cosine similarity score (a number between -1 and 1).
     */
    function cosineSimilarity(vec1: number[], vec2: number[]): number;
    export default cosineSimilarity; // Assuming it's a default export
  }