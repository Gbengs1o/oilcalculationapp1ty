// src/app/chat/page.tsx
import Chatbot from './components/Chatbot';

export default function ChatPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-center">AI Chat Assistant</h1>
      <Chatbot />
    </div>
  );
}