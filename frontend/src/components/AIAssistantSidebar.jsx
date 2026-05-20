import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Loader, Sparkles } from 'lucide-react';
import api from '../api';

export default function AIAssistantSidebar({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'model', content: 'Hello! I am the MicroTender AI Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // We pass the history except the very first greeting
      const history = messages.slice(1);
      
      const response = await api.request('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg, history })
      });

      setMessages(prev => [...prev, { role: 'model', content: response.response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I am having trouble connecting to the server right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm glass-strong border-l border-border-primary shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-border-primary flex items-center justify-between bg-gradient-to-r from-accent-purple/20 to-accent-pink/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-cyan to-accent-pink p-[2px]">
                  <div className="w-full h-full bg-bg-primary rounded-lg flex items-center justify-center">
                    <Bot className="text-white" size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-text-primary flex items-center gap-1">
                    AI Assistant <Sparkles size={14} className="text-accent-pink animate-pulse" />
                  </h3>
                  <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-white/5 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-secondary-600 to-accent-purple text-white rounded-tr-sm' 
                      : 'bg-bg-secondary border border-border-primary text-text-secondary rounded-tl-sm shadow-soft'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-bg-secondary border border-border-primary rounded-2xl rounded-tl-sm p-4 shadow-soft flex items-center gap-2">
                    <Loader size={16} className="text-accent-cyan animate-spin" />
                    <span className="text-xs text-text-tertiary font-bold animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border-primary bg-bg-primary/50 backdrop-blur-md">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 bg-bg-secondary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="bg-accent-cyan hover:bg-accent-cyan/80 text-white p-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
