// src/app/components/ChatMessageContent.tsx
'use client';

import React from 'react';
import ReactMarkdown, { Options } from 'react-markdown'; // Import Options for components typing
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import GraphRenderer from './GraphRenderer';

// --- Type Definitions ---
// (Keep GraphData, TableData, ChatMessageContentProps types as before)
type GraphData = { type: string; data: any[]; options?: Record<string, any>; title?: string; };
type TableData = { headers: string[]; rows: any[][]; title?: string; };
interface ChatMessageContentProps { content: any; graphData?: GraphData; tableData?: TableData; } // Temporarily allow 'any' for content prop due to error

// --- renderTableCell helper ---
const renderTableCell = (cell: any): React.ReactNode => { /* ... as before ... */ };

// --- Custom Code Component Renderer ---
interface CustomCodeProps extends React.HTMLAttributes<HTMLElement> { /* ... */ }
const CustomCodeRenderer: React.FC<CustomCodeProps> = ({ inline, className, children, node, ...props }) => { /* ... as before ... */ };

// --- Main Content Component ---
export function ChatMessageContent({ content, graphData, tableData }: ChatMessageContentProps) {

    const markdownComponents: Options['components'] = {
        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400" />,
        p: ({ node, ...props }) => <p {...props} className="mb-3 last:mb-0" />,
        ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside my-2 pl-4" />,
        ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside my-2 pl-4" />,
        li: ({ node, ...props }) => <li {...props} className="mb-1" />,
        code: CustomCodeRenderer,
    };

    // **FIX:** Forcefully coerce the 'content' prop to a string before passing to ReactMarkdown.
    // This is more aggressive than the 'typeof' check and handles potential edge cases.
    const contentAsString = String(content ?? ''); // Use String() constructor, fallback null/undefined to empty string

    // Optional: Log if the original content wasn't a string
    if (typeof content !== 'string') {
        console.warn(`[ChatMessageContent] Coerced non-string content to string. Original Type: ${typeof content}, Value:`, content);
    }


    return (
        <div className="text-slate-900 dark:text-slate-100 max-w-none prose prose-sm prose-slate break-words dark:prose-invert" style={{ whiteSpace: 'pre-wrap' }}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
            >
                {/* --- PASS THE COERCED STRING --- */}
                {contentAsString}
                {/* Was previously {validContent} or {content} */}
            </ReactMarkdown>

            {/* Render Graph */}
            {graphData && (
                <div className="not-prose mt-4 mb-2">
                    <GraphRenderer
                        type={graphData.type}
                        data={graphData.data}
                        options={graphData.options}
                        title={graphData.title}
                    />
                </div>
            )}

            {/* Render Table */}
            {tableData && tableData.headers && Array.isArray(tableData.rows) && (
                <div className="mt-4 mb-2 overflow-x-auto bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm not-prose">
                    {tableData.title && <h4 className="text-md font-semibold text-center mb-3 text-slate-800 dark:text-slate-200">{tableData.title}</h4>}
                    <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-600 border border-slate-200 dark:border-slate-700 text-sm">
                        {/* ... table thead/tbody structure ... */}
                         <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>{tableData.headers.map((header, hIndex) => ( <th key={`header-${hIndex}`} scope="col" className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-slate-100">{header}</th> ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-600 bg-white dark:bg-slate-800">
                            {tableData.rows.length > 0 ? (
                                tableData.rows.map((row, rIndex) => (
                                    <tr key={`row-${rIndex}`} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                        {tableData.headers.map((_, cIndex) => ( <td key={`cell-${rIndex}-${cIndex}`} className="whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300">{renderTableCell(row[cIndex])}</td> ))}
                                    </tr> ))
                            ) : ( <tr><td colSpan={tableData.headers.length || 1} className="px-3 py-4 text-center text-slate-500 dark:text-slate-400 italic">No data available.</td></tr> )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}