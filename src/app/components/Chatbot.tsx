// src/app/components/Chatbot.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import GraphRenderer from './GraphRenderer'; // Adjust path if needed

// Import katex CSS in layout.tsx or global CSS
// import 'katex/dist/katex.min.css';

// --- Type Definitions ---
type GraphData = {
    type: string;
    data: any;
    options?: any;
    title?: string;
};

// --->>> NEW: Define TableData Type <<<---
type TableData = {
    headers: string[];
    rows: any[][]; // Array of arrays, cells can be any type
    title?: string;
};
// --->>> END NEW <<<---

type Message = {
    role: 'user' | 'assistant';
    content: string;
    graphData?: GraphData;
    // --->>> MODIFIED: Add tableData <<<---
    tableData?: TableData;
    // --->>> END MODIFIED <<<---
};


// --- ChatMessageContent Component (MODIFIED FOR TABLES) ---
function ChatMessageContent({ content, graphData, tableData }: { // Added tableData prop
    content: string;
    graphData?: GraphData;
    // --->>> MODIFIED: Add tableData prop type <<<---
    tableData?: TableData;
    // --->>> END MODIFIED <<<---
}) {
    return (
        <div className="text-slate-900 max-w-none" style={{ whiteSpace: 'pre-wrap' }}>
            {/* Render Markdown Content */}
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" />,
                    // Optional: Add styles for paragraphs if needed, but pre-wrap might handle spacing
                    // p: ({ node, ...props }) => <p {...props} className="mb-2" />,
                }}
            >
                {content}
            </ReactMarkdown>

            {/* Render Graph */}
            {graphData && (
                <GraphRenderer
                    type={graphData.type}
                    data={graphData.data}
                    options={graphData.options}
                    title={graphData.title}
                />
            )}

            {/* --->>> NEW: Render Table <<<--- */}
            {tableData && tableData.headers && tableData.rows && (
                <div className="mt-4 mb-2 overflow-x-auto bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    {tableData.title && <h4 className="text-md font-semibold text-center mb-3 text-slate-800">{tableData.title}</h4>}
                    <table className="min-w-full divide-y divide-slate-300 border border-slate-200">
                        <thead className="bg-slate-100">
                            <tr>
                                {tableData.headers.map((header, hIndex) => (
                                    <th key={hIndex} scope="col" className="px-4 py-2 text-left text-sm font-semibold text-slate-900">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {tableData.rows.map((row, rIndex) => (
                                <tr key={rIndex} className="hover:bg-slate-50">
                                    {row.map((cell, cIndex) => (
                                        <td key={cIndex} className="whitespace-nowrap px-4 py-2 text-sm text-slate-700">
                                            {/* Basic cell rendering, handles strings/numbers. Might need refinement for complex objects */}
                                            {typeof cell === 'object' && cell !== null ? JSON.stringify(cell) : String(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* --->>> END NEW <<<--- */}
        </div>
    );
}


// --- Main Chatbot Component ---
export default function Chatbot() {
    const CHAT_HISTORY_KEY = 'chatbot_history_v3'; // Increment key if structure changes
    const [messages, setMessages] = useState<Message[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load history effect (runs once) - No changes needed here
    useEffect(() => {
        // ... existing code ...
        try {
            const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
            if (savedHistory) {
                // --->>> MODIFIED: Include tableData in validation if needed, but basic check is often fine <<<---
                const parsedHistory: Message[] = JSON.parse(savedHistory);
                 // Add more robust validation if you store complex table data that might break parsing
                if (Array.isArray(parsedHistory) && parsedHistory.every(m => m.role && typeof m.content === 'string')) {
                    console.log("Loaded chat history from localStorage.");
                    setMessages(parsedHistory);
                } else {
                    console.warn("localStorage history was malformed. Starting fresh.");
                    localStorage.removeItem(CHAT_HISTORY_KEY);
                }
            }
        } catch (error) {
            console.error("Failed to load/parse chat history:", error);
            localStorage.removeItem(CHAT_HISTORY_KEY);
        } finally {
             setIsHydrated(true);
        }
    }, []);


    // Scroll effect - No changes needed here
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Save history effect - No changes needed here, JSON.stringify handles the new optional field
    useEffect(() => {
        if (isHydrated) {
            try {
                localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
            } catch (error) {
                console.error("Failed to save chat history:", error);
            }
        }
    }, [messages, isHydrated]);

    // --- Handle Submit (MODIFIED FOR TABLES) ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !isHydrated) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        const messagesToSend = [...messages, userMessage];

        setMessages(messagesToSend);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesToSend }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                const errorDetails = responseData?.details || responseData?.error || `API error ${response.status}`;
                console.error("API Error Response:", responseData);
                throw new Error(errorDetails);
            }

            if (!responseData.choices?.[0]?.message?.content) {
                console.error("Unexpected successful API response format:", responseData);
                throw new Error("Received unexpected data format from the assistant.");
            }

            let content = responseData.choices[0].message.content; // Start with raw content
            let graphData: GraphData | undefined = undefined;
            // --->>> NEW: Initialize tableData <<<---
            let tableData: TableData | undefined = undefined;
            // --->>> END NEW <<<---

            // --- Try to Parse Graph Data ---
            const graphDataMatch = content.match(/<!--GRAPH_DATA:(.*?)-->/s);
            if (graphDataMatch?.[1]) {
                try {
                    const potentialGraphData = JSON.parse(graphDataMatch[1]);
                    // Validate basic graph structure
                    if (potentialGraphData?.type && potentialGraphData?.data) {
                        graphData = potentialGraphData;
                        // Remove marker from content
                        content = content.replace(/<!--GRAPH_DATA:(.*?)-->/s, '').trim();
                        console.log("Parsed graph data:", graphData);
                    } else {
                        console.warn("Found graph marker but content invalid:", graphDataMatch[1]);
                    }
                } catch (error) {
                    console.error("Failed to parse graph data JSON:", error, "\nData:", graphDataMatch[1]);
                }
            }

            // --->>> NEW: Try to Parse Table Data (only if graph wasn't found or failed) <<<---
            // We assume only one type of data block per message for simplicity now
            if (!graphData) { // Only look for table if no graph was successfully parsed
                const tableDataMatch = content.match(/<!--TABLE_DATA:(.*?)-->/s);
                if (tableDataMatch?.[1]) {
                    try {
                        const potentialTableData = JSON.parse(tableDataMatch[1]);
                        // Validate basic table structure
                        if (potentialTableData?.headers && Array.isArray(potentialTableData.headers) &&
                            potentialTableData?.rows && Array.isArray(potentialTableData.rows))
                        {
                            tableData = potentialTableData;
                             // Remove marker from content
                            content = content.replace(/<!--TABLE_DATA:(.*?)-->/s, '').trim();
                            console.log("Parsed table data:", tableData);
                        } else {
                             console.warn("Found table marker but content invalid:", tableDataMatch[1]);
                        }
                    } catch (error) {
                        console.error("Failed to parse table data JSON:", error, "\nData:", tableDataMatch[1]);
                    }
                }
            }
            // --->>> END NEW <<<---

            // --- Final Assistant Message ---
            const assistantMessage: Message = {
                role: 'assistant',
                content: content.trim(), // Use the cleaned content
                graphData: graphData,
                // --->>> MODIFIED: Attach parsed table data <<<---
                tableData: tableData,
                // --->>> END MODIFIED <<<---
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Error sending message or processing response:', error);
            const displayError = error instanceof Error ? error.message : 'An unknown error occurred.';
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `Sorry, there was an error: ${displayError}` }
            ]);
        } finally {
            setIsLoading(false);
            document.querySelector<HTMLInputElement>('input[aria-label="Chat input"]')?.focus();
        }
    };

    // --- JSX Structure ---
    return (
        <div className="flex flex-col h-[750px] w-full max-w-4xl mx-auto border border-slate-300 rounded-lg shadow-xl bg-slate-50 overflow-hidden">
            {/* Header (MODIFIED TITLE SLIGHTLY) */}
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-sm flex items-center justify-center">
                 {/* ... svg icon ... */}
                <h2 className="text-lg font-semibold text-center tracking-wide">Drilling Formula, Graph & Table Assistant</h2>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-5 md:p-8 space-y-5 overflow-y-auto bg-white custom-scrollbar">
                {!isHydrated ? (
                    <div className="text-center text-slate-500 mt-12"><p>Loading chat...</p></div>
                ) : messages.length === 0 && !isLoading ? (
                     // --->>> MODIFIED: Welcome Message Examples <<<---
                    <div className="text-center text-slate-500 mt-12">
                       {/* ... svg icon ... */}
                        <p className="mt-3 text-lg font-medium text-slate-700">Welcome!</p>
                        <p className="text-slate-500">Ask for calculations, concepts, graphs, or tables.</p>
                        <p className="mt-4 text-sm text-slate-400 italic">e.g., "Calculate ECD", "Show pressure vs depth as a line chart", "Create a table of mud properties"</p>
                    </div>
                    // --->>> END MODIFIED <<<---
                ) : (
                    // Render Messages
                    messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`px-4 py-3 rounded-xl shadow-sm max-w-xl md:max-w-2xl lg:max-w-[85%] break-words ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200'}`}>
                                {message.role === 'assistant' ? (
                                     // --->>> MODIFIED: Pass tableData to ChatMessageContent <<<---
                                    <ChatMessageContent
                                        content={message.content}
                                        graphData={message.graphData}
                                        tableData={message.tableData} // Pass the table data
                                    />
                                     // --->>> END MODIFIED <<<---
                                ) : (
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Loading Indicator - No changes needed */}
                {/* ... existing code ... */}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-4 bg-slate-100 border-t border-slate-200">
                <div className="flex items-center space-x-3">
                    {/* --->>> MODIFIED: Input placeholder text <<<--- */}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isHydrated ? "Ask a question, request a graph or table..." : "Loading..."}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200 disabled:cursor-not-allowed transition duration-150 ease-in-out text-slate-900 placeholder:text-slate-400"
                        disabled={isLoading || !isHydrated}
                        aria-label="Chat input"
                        autoComplete="off"
                    />
                    {/* --->>> END MODIFIED <<<--- */}
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                        disabled={isLoading || !input.trim() || !isHydrated}
                        aria-label="Send message"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}

// --- NOTE: GraphRenderer.tsx requires NO changes for table support ---