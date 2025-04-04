// src/app/components/Chatbot.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// Ensure 'katex/dist/katex.min.css' is imported globally (e.g., in layout.tsx or globals.css)

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

// --- ChatMessageContent Component (Remains the same) ---
function ChatMessageContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
         // a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}


// --- Main Chatbot Component ---
export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref for the input element if needed for focus, instead of querySelector
  // const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default form submission which causes a page reload
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    // Optimistic update: Add user message immediately
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Send the *updated* message list to the API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the messages list including the latest user message
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) {
          let errorDetails = response.statusText;
          try {
              const errorData = await response.json();
              // Try to get more specific error details if available
              errorDetails = errorData.details || errorData.error?.message || errorData.error || errorDetails;
          } catch (_) { /* Ignore if response isn't valid JSON */ }
          throw new Error(`API error ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();

      // Robust check for the expected response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
          console.error("Unexpected API response format:", data);
          throw new Error("Received unexpected data format from the assistant.");
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content.trim(),
      };

      // Update state with the assistant's response
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      // Add an error message to the chat interface
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, there was an error communicating with the assistant. ${error instanceof Error ? error.message : 'Please try again.'}` }
      ]);
    } finally {
      setIsLoading(false);
       // Focus the input field after submission/error
       // Using querySelector is okay, but a ref is often preferred in React
       const inputElement = document.querySelector<HTMLInputElement>('input[aria-label="Chat input"]'); // Using aria-label selector
       inputElement?.focus();
       // Alternative using ref:
       // inputRef.current?.focus();
    }
  };

  // --- JSX Structure ---
  return (
    <div className="flex flex-col h-[750px] w-full max-w-4xl mx-auto border border-slate-300 rounded-lg shadow-xl bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-sm">
        <h2 className="text-lg font-semibold text-center tracking-wide">Drilling Formula Assistant</h2>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-5 md:p-8 space-y-5 overflow-y-auto bg-white custom-scrollbar">
        {/* Welcome Message */}
        {messages.length === 0 && !isLoading ? (
          <div className="text-center text-slate-500 mt-12">
             <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="mt-3 text-lg font-medium text-slate-700">Welcome!</p>
            <p className="text-slate-500">Ask about drilling formulas, calculations, or concepts.</p>
            <p className="mt-4 text-sm text-slate-400 italic">e.g., "Calculate hydrostatic pressure for 12000 ft TVD with 11.5 ppg mud."</p>
          </div>
        ) : (
          /* Message mapping */
          messages.map((message, index) => (
            <div
              // Using index as key is acceptable if list only grows at the end
              key={index}
              className={`flex ${ message.role === 'user' ? 'justify-end' : 'justify-start' }`}
            >
              <div
                className={`px-4 py-3 rounded-xl shadow-sm max-w-xl md:max-w-2xl lg:max-w-3xl break-words ${ message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 border border-slate-200' }`}
              >
                {message.role === 'assistant' ? (
                  <div className="whitespace-pre-wrap"> <ChatMessageContent content={message.content} /> </div>
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
             <div className="flex justify-start">
                 <div className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
                     <span className="text-sm italic">Calculating...</span>
                     <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                 </div>
             </div>
        )}
        {/* Element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-100 border-t border-slate-200">
        <div className="flex items-center space-x-3">
          {/* Input Field - Removed onKeyDown */}
          <input
            // ref={inputRef} // Optional: use ref for focusing
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter formula name or question..."
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-200 transition duration-150 ease-in-out text-slate-900 placeholder:text-slate-400"
            disabled={isLoading}
            aria-label="Chat input" // Used this for querySelector focus, ensure it's unique if needed
          />
          {/* Submit Button */}
          <button
            type="submit"
            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}