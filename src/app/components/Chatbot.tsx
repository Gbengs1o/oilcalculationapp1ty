// src/app/components/Chatbot.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import GraphRenderer from './GraphRenderer'; // Adjust path if needed
import { 
    ChartBarIcon, 
    PaperAirplaneIcon, 
    SparklesIcon, 
    SunIcon, 
    MoonIcon, 
    TrashIcon 
} from '@heroicons/react/24/outline'; // Added more icons

// Import katex CSS in layout.tsx or global CSS
// import 'katex/dist/katex.min.css';

// --- Type Definitions ---
type GraphData = {
    type: string;
    data: any;
    options?: any;
    title?: string;
};

type TableData = {
    headers: string[];
    rows: any[][];
    title?: string;
};

type Message = {
    role: 'user' | 'assistant';
    content: string;
    graphData?: GraphData;
    tableData?: TableData;
};

// --->>> Define Visualization Types <<<---
type VizType = 'pie chart' | 'line graph' | 'table' | 'bar chart' | 'scatter plot';
const VIZ_OPTIONS: VizType[] = ['pie chart', 'line graph', 'bar chart', 'scatter plot', 'table'];

// --- ChatMessageContent Component ---
function ChatMessageContent({ content, graphData, tableData, darkMode }: {
    content: string;
    graphData?: GraphData;
    tableData?: TableData;
    darkMode: boolean;
}) {
    return (
        <div className={`max-w-none ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ whiteSpace: 'pre-wrap' }}>
            {/* Render Markdown Content */}
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className={`${darkMode ? 'text-blue-400 hover:underline' : 'text-blue-600 hover:underline'}`} />,
                }}
            >
                {content}
            </ReactMarkdown>

            {/* Render Graph */}
            {graphData && (
                <GraphRenderer
                    type={graphData.type}
                    data={graphData.data}
                    options={{
                        ...(graphData.options || {}),
                        // Optionally add dark mode specific chart options here
                        // For example: darkMode ? { backgroundColor: '#1e293b' } : {}
                    }}
                    title={graphData.title}
                />
            )}

            {/* Render Table */}
            {tableData && tableData.headers && tableData.rows && (
                <div className={`mt-4 mb-2 overflow-x-auto ${darkMode ? 'bg-slate-800' : 'bg-white'} p-4 rounded-lg ${darkMode ? 'border border-slate-700' : 'border border-slate-200'} shadow-sm`}>
                    {tableData.title && <h4 className={`text-md font-semibold text-center mb-3 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{tableData.title}</h4>}
                    <table className={`min-w-full divide-y ${darkMode ? 'divide-slate-700 border border-slate-700' : 'divide-slate-300 border border-slate-200'}`}>
                        <thead className={darkMode ? 'bg-slate-900' : 'bg-slate-100'}>
                            <tr>
                                {tableData.headers.map((header, hIndex) => (
                                    <th key={hIndex} scope="col" className={`px-4 py-2 text-left text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? 'divide-slate-700 bg-slate-800' : 'divide-slate-200 bg-white'}`}>
                            {tableData.rows.map((row, rIndex) => (
                                <tr key={rIndex} className={darkMode ? 'hover:bg-slate-900' : 'hover:bg-slate-50'}>
                                    {row.map((cell, cIndex) => (
                                        <td key={cIndex} className={`whitespace-nowrap px-4 py-2 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                            {typeof cell === 'object' && cell !== null ? JSON.stringify(cell) : String(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// --- Main Chatbot Component ---
export default function Chatbot() {
    const CHAT_HISTORY_KEY = 'chatbot_history_v3';
    const DARK_MODE_KEY = 'chatbot_dark_mode';
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(false);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // State for visualization options dropdown
    const [showVizOptions, setShowVizOptions] = useState(false);
    const vizButtonRef = useRef<HTMLButtonElement>(null);
    const vizOptionsRef = useRef<HTMLDivElement>(null);
    
    // Load history and theme preference effect
    useEffect(() => {
        try {
            // Load dark mode preference
            const savedDarkMode = localStorage.getItem(DARK_MODE_KEY);
            if (savedDarkMode) {
                setDarkMode(savedDarkMode === 'true');
            } else {
                // Check system preference if no saved preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setDarkMode(prefersDark);
                localStorage.setItem(DARK_MODE_KEY, prefersDark.toString());
            }
            
            // Load chat history
            const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
            if (savedHistory) {
                const parsedHistory: Message[] = JSON.parse(savedHistory);
                if (Array.isArray(parsedHistory) && parsedHistory.every(m => m.role && typeof m.content === 'string')) {
                    console.log("Loaded chat history from localStorage.");
                    setMessages(parsedHistory);
                } else {
                    console.warn("localStorage history was malformed. Starting fresh.");
                    localStorage.removeItem(CHAT_HISTORY_KEY);
                }
            }
        } catch (error) {
            console.error("Failed to load/parse chat history or theme preference:", error);
            localStorage.removeItem(CHAT_HISTORY_KEY);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    // Scroll effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Save history effect
    useEffect(() => {
        if (isHydrated) {
            try {
                localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
            } catch (error) {
                console.error("Failed to save chat history:", error);
            }
        }
    }, [messages, isHydrated]);

    // Save dark mode preference
    useEffect(() => {
        if (isHydrated) {
            try {
                localStorage.setItem(DARK_MODE_KEY, darkMode.toString());
            } catch (error) {
                console.error("Failed to save dark mode preference:", error);
            }
        }
    }, [darkMode, isHydrated]);

    // Effect to close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Close viz options when clicking outside
            if (
                showVizOptions &&
                vizButtonRef.current &&
                !vizButtonRef.current.contains(event.target as Node) &&
                vizOptionsRef.current &&
                !vizOptionsRef.current.contains(event.target as Node)
            ) {
                setShowVizOptions(false);
            }
        }
        
        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showVizOptions]);

    // Toggle dark mode
    const toggleDarkMode = () => {
        setDarkMode(prev => !prev);
    };

    // Clear chat history
    const clearChatHistory = () => {
        setMessages([]);
        setShowConfirmClear(false);
        try {
            localStorage.removeItem(CHAT_HISTORY_KEY);
        } catch (error) {
            console.error("Failed to clear chat history from localStorage:", error);
        }
    };

    // --- Shared API Call Logic ---
    const callChatApi = useCallback(async (currentMessages: Message[]) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: currentMessages }),
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

            let content = responseData.choices[0].message.content;
            let graphData: GraphData | undefined = undefined;
            let tableData: TableData | undefined = undefined;

            // Parse Graph Data
            const graphDataMatch = content.match(/<!--GRAPH_DATA:(.*?)-->/s);
            if (graphDataMatch?.[1]) {
                try {
                    const potentialGraphData = JSON.parse(graphDataMatch[1]);
                    if (potentialGraphData?.type && potentialGraphData?.data) {
                        graphData = potentialGraphData;
                        content = content.replace(/<!--GRAPH_DATA:(.*?)-->/s, '').trim();
                        console.log("Parsed graph data:", graphData);
                    } else { console.warn("Found graph marker but content invalid:", graphDataMatch[1]); }
                } catch (error) { console.error("Failed to parse graph data JSON:", error, "\nData:", graphDataMatch[1]); }
            }

            // Parse Table Data (only if graph not found)
            if (!graphData) {
                const tableDataMatch = content.match(/<!--TABLE_DATA:(.*?)-->/s);
                if (tableDataMatch?.[1]) {
                    try {
                        const potentialTableData = JSON.parse(tableDataMatch[1]);
                        if (potentialTableData?.headers && Array.isArray(potentialTableData.headers) &&
                            potentialTableData?.rows && Array.isArray(potentialTableData.rows)) {
                            tableData = potentialTableData;
                            content = content.replace(/<!--TABLE_DATA:(.*?)-->/s, '').trim();
                            console.log("Parsed table data:", tableData);
                        } else { console.warn("Found table marker but content invalid:", tableDataMatch[1]); }
                    } catch (error) { console.error("Failed to parse table data JSON:", error, "\nData:", tableDataMatch[1]); }
                }
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: content.trim(),
                graphData: graphData,
                tableData: tableData,
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Error sending message or processing response:', error);
            const displayError = error instanceof Error ? error.message : 'An unknown error occurred.';
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: `Sorry, there was an error processing the request: ${displayError}` }
            ]);
        } finally {
            setIsLoading(false);
            // Refocus on text input after any API call completes
            document.querySelector<HTMLInputElement>('input[aria-label="Chat input"]')?.focus();
        }
    }, []); // Dependencies for useCallback

    // --- Handle Submit (for typed user input) ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !isHydrated) return;

        const userMessage: Message = { role: 'user', content: input.trim() };
        const messagesToSend = [...messages, userMessage];

        setMessages(messagesToSend); // Show user message immediately
        setInput(''); // Clear input

        await callChatApi(messagesToSend); // Call the shared API logic
    };

    // --- Handle Visualize Request ---
    const handleVisualizeRequest = async (vizType: VizType) => {
        if (isLoading || !isHydrated || messages.length === 0) {
             // Optionally show a message if there's no history
             if(messages.length === 0) {
                 console.warn("Visualize requested with no chat history.");
                 // Maybe add a temporary user-facing message?
             }
             return; // Don't proceed if loading, not hydrated, or no messages to base visualization on
        }

        setShowVizOptions(false); // Close the dropdown

        // Construct the user message triggering the visualization
        const userRequestContent = `Based on our conversation history, please generate a ${vizType} to visualize the relevant data discussed.`;
        const userMessage: Message = { role: 'user', content: userRequestContent };
        const messagesToSend = [...messages, userMessage];

        setMessages(messagesToSend); // Show the generated user request

        await callChatApi(messagesToSend); // Call the shared API logic
    };

    // --- JSX Structure ---
    return (
        <div className={`flex flex-col h-[750px] w-full max-w-4xl mx-auto border rounded-lg shadow-xl overflow-hidden ${
            darkMode 
                ? 'bg-slate-900 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-300 text-slate-900'
        }`}>
            {/* Header */}
            <div className={`p-4 flex items-center justify-between border-b shadow-sm ${
                darkMode
                    ? 'border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800'
                    : 'border-slate-200 bg-gradient-to-r from-slate-700 to-slate-900 text-white'
            }`}>
                <div className="flex items-center space-x-2">
                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleDarkMode}
                        className={`p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            darkMode 
                                ? 'text-yellow-300 hover:bg-slate-800 focus:ring-yellow-400' 
                                : 'text-yellow-400 hover:bg-slate-800 focus:ring-yellow-400'
                        }`}
                        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                    </button>
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold text-center tracking-wide flex-1">
                    Drilling Formula, Graph & Table Assistant
                </h2>

                {/* Clear History Button / Confirmation */}
                <div className="relative">
                    {showConfirmClear ? (
                        <div className={`absolute right-0 top-0 p-2 rounded-md shadow-lg ${
                            darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
                        }`}>
                            <p className={`text-xs mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                Clear history?
                            </p>
                            <div className="flex space-x-1">
                                <button
                                    onClick={clearChatHistory}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setShowConfirmClear(false)}
                                    className={`px-2 py-1 text-xs rounded ${
                                        darkMode 
                                            ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' 
                                            : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                                    }`}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => messages.length > 0 && setShowConfirmClear(true)}
                            disabled={messages.length === 0}
                            className={`p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                darkMode 
                                    ? messages.length === 0 
                                        ? 'text-slate-700 cursor-not-allowed' 
                                        : 'text-red-400 hover:bg-slate-800 focus:ring-red-500' 
                                    : messages.length === 0 
                                        ? 'text-slate-400 cursor-not-allowed' 
                                        : 'text-red-500 hover:bg-slate-800 focus:ring-red-500'
                            }`}
                            aria-label="Clear chat history"
                            title={messages.length === 0 ? "No history to clear" : "Clear chat history"}
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 p-5 md:p-8 space-y-5 overflow-y-auto custom-scrollbar ${
                darkMode ? 'bg-slate-800' : 'bg-white'
            }`}>
                {!isHydrated ? (
                    <div className={`text-center mt-12 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <p>Loading chat...</p>
                    </div>
                ) : messages.length === 0 && !isLoading ? (
                    <div className={`text-center mt-12 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                         <SparklesIcon className={`h-12 w-12 mx-auto mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        <p className={`mt-3 text-lg font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            Welcome!
                        </p>
                        <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                            Ask for calculations, concepts, graphs, or tables.
                        </p>
                        <p className={`mt-4 text-sm italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            e.g., "Calculate ECD", "Show pressure vs depth as a line chart", "Create a table of mud properties"
                        </p>
                        <p className={`mt-2 text-sm italic ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Or use the <ChartBarIcon className="inline h-4 w-4 align-text-bottom" /> button to visualize current chat data.
                        </p>
                    </div>
                ) : (
                    // Render Messages
                    messages.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`px-4 py-3 rounded-xl shadow-sm max-w-xl md:max-w-2xl lg:max-w-[85%] break-words ${
                                message.role === 'user' 
                                    ? 'bg-blue-600 text-white' 
                                    : darkMode 
                                        ? 'bg-slate-700 text-slate-100 border border-slate-600' 
                                        : 'bg-slate-100 text-slate-900 border border-slate-200'
                            }`}>
                                {message.role === 'assistant' ? (
                                    <ChatMessageContent
                                        content={message.content}
                                        graphData={message.graphData}
                                        tableData={message.tableData}
                                        darkMode={darkMode}
                                    />
                                ) : (
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Loading Indicator */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className={`px-4 py-3 rounded-xl shadow-sm animate-pulse ${
                            darkMode 
                                ? 'bg-slate-700 text-slate-100 border border-slate-600' 
                                : 'bg-slate-100 text-slate-900 border border-slate-200'
                        }`}>
                            <div className="flex space-x-1 items-center">
                                <div className={`h-2 w-2 rounded-full animate-bounce [animation-delay:-0.3s] ${
                                    darkMode ? 'bg-slate-500' : 'bg-slate-400'
                                }`}></div>
                                <div className={`h-2 w-2 rounded-full animate-bounce [animation-delay:-0.15s] ${
                                    darkMode ? 'bg-slate-500' : 'bg-slate-400'
                                }`}></div>
                                <div className={`h-2 w-2 rounded-full animate-bounce ${
                                    darkMode ? 'bg-slate-500' : 'bg-slate-400'
                                }`}></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form Area */}
            <div className={`p-4 border-t ${
                darkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
                <form onSubmit={handleSubmit} className="flex items-center space-x-3 relative">
                     {/* Visualize Button */}
                     <div className="relative">
                         <button
                            ref={vizButtonRef}
                            type="button"
                            onClick={() => setShowVizOptions(!showVizOptions)}
                            className={`p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out ${
                                isLoading || !isHydrated || messages.length === 0
                                    ? darkMode 
                                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-slate-700'
                                        : 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-400'
                                    : darkMode
                                        ? 'bg-indigo-900 text-indigo-400 hover:bg-indigo-800 border-indigo-700 focus:ring-indigo-700' 
                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-300 focus:ring-indigo-500'
                            }`}
                            disabled={isLoading || !isHydrated || messages.length === 0}
                            aria-label="Visualize chat data"
                            title={messages.length === 0 ? "Chat history needed to visualize" : "Visualize chat data"}
                        >
                            <ChartBarIcon className="h-5 w-5" />
                        </button>

                        {/* Visualization Options Dropdown */}
                        {showVizOptions && (
                            <div
                                ref={vizOptionsRef}
                                className={`absolute bottom-full left-0 mb-2 w-48 rounded-md shadow-lg z-10 overflow-hidden ${
                                    darkMode 
                                        ? 'bg-slate-800 border border-slate-700'
                                        : 'bg-white border border-slate-300'
                                }`}
                            >
                                <ul className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-slate-200'}`}>
                                    {VIZ_OPTIONS.map((vizType) => (
                                        <li key={vizType}>
                                            <button
                                                type="button"
                                                onClick={() => handleVisualizeRequest(vizType)}
                                                className={`w-full text-left px-4 py-2 text-sm capitalize transition-colors duration-100 ease-in-out ${
                                                    darkMode 
                                                        ? 'text-slate-300 hover:bg-indigo-900 hover:text-indigo-300'
                                                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                                                }`}
                                            >
                                                {vizType}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                     </div>

                    {/* Input */}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isHydrated ? "Ask a question..." : "Loading..."}
                        className={`flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:cursor-not-allowed transition duration-150 ease-in-out ${
                            darkMode 
                                ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:ring-blue-600 disabled:bg-slate-900'
                                : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500 disabled:bg-slate-200'
                        }`}
                        disabled={isLoading || !isHydrated}
                        aria-label="Chat input"
                        autoComplete="off"
                    />
                    
                    {/* Send Button */}
                    <button
                        type="submit"
                        className={`inline-flex items-center justify-center p-3 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out ${
                            darkMode 
                                ? 'bg-blue-700 hover:bg-blue-800 text-white focus:ring-blue-600'
                                : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
                        }`}
                        disabled={isLoading || !input.trim() || !isHydrated}
                        aria-label="Send message"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}