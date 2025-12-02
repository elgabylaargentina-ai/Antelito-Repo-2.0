import React, { useState, useRef, useEffect } from 'react';
import { generateResponse, setGeminiApiKey } from './services/geminiService';
import { loadLibrary, saveLibrary } from './services/storageService';
import { Antelito } from './components/Clippy';
import { NotebookEditor } from './components/NotebookEditor';
import { Message, Sender, AntelitoState, LibraryContext } from './types';
import { marked } from 'marked';
import { DEFAULT_LIBRARY } from './defaultLibrary';

type AppView = 'LOADING' | 'HOME' | 'CHAT' | 'ADMIN';

const App: React.FC = () => {
  // --- STATE ---
  const [currentView, setCurrentView] = useState<AppView>('LOADING');
  // Initialize with the DEFAULT_LIBRARY imported from the file
  const [libraryContext, setLibraryContext] = useState<LibraryContext>(DEFAULT_LIBRARY);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // API Key State (for portable mode)
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  // 1. Load Data on Startup
  useEffect(() => {
    const initData = async () => {
      try {
        // Load Library from IndexedDB
        const savedData = await loadLibrary();
        
        if (savedData && savedData.documents.length > 0) {
          // If the user has local data, use it
          setLibraryContext(savedData);
        } else {
          // If local data is empty (first visit), verify if we should save the default one
          // We set the state to DEFAULT_LIBRARY (already done in useState), 
          // and we trigger a save so next time it loads from DB.
          setLibraryContext(DEFAULT_LIBRARY);
        }

        // Check/Load API Key (Local Storage for portable persistence)
        const savedKey = localStorage.getItem('ANTELITO_API_KEY');
        if (savedKey) {
            setGeminiApiKey(savedKey);
        } else {
            // Check if env var exists (dev mode / vercel env), if not, ask user
            // @ts-ignore
             const envKey = (import.meta as any).env?.VITE_API_KEY;
             if (!envKey) {
                 setShowKeyPrompt(true);
             } else {
                 setGeminiApiKey(envKey);
             }
        }
      } catch (error) {
        console.warn("Error cargando datos locales:", error);
      } finally {
        setIsDataLoaded(true);
        setCurrentView('HOME');
      }
    };
    initData();
  }, []);

  // 2. Persist Library Changes
  useEffect(() => {
    if (!isDataLoaded) return;

    const saveData = async () => {
      setIsSaving(true);
      try {
        await saveLibrary(libraryContext);
      } catch (err) {
        console.error("Error guardando datos:", err);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    };

    const timer = setTimeout(saveData, 2000); // Debounce save
    return () => clearTimeout(timer);
  }, [libraryContext, isDataLoaded]);

  // Handle setting API Key manually
  const handleSetInitialKey = () => {
    if (!newApiKey.trim()) return;
    setGeminiApiKey(newApiKey);
    localStorage.setItem('ANTELITO_API_KEY', newApiKey);
    setShowKeyPrompt(false);
  };

  // --- ADMIN LOGIC ---
  const handleAdminLogin = () => {
    if (adminPassword === '1234') {
        setShowAdminLogin(false);
        setAdminPassword('');
        setLoginError(false);
        setCurrentView('ADMIN');
    } else {
        setLoginError(true);
        setTimeout(() => setLoginError(false), 2000);
    }
  };

  // --- RENDER VIEWS ---

  if (currentView === 'LOADING') {
    return (
      <div className="h-screen bg-yellow-50 flex flex-col items-center justify-center font-sans">
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Cargando Antelito...</p>
      </div>
    );
  }

  // KEY PROMPT MODAL
  if (showKeyPrompt) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl border-4 border-yellow-400">
                <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-2 text-white text-2xl font-bold antelito-font">A</div>
                    <h2 className="text-xl font-bold text-gray-800">¡Hola! Soy Antelito</h2>
                </div>
                <p className="text-gray-600 mb-4 text-sm text-center">
                    Para poder leer tus documentos y responderte, necesito una <b>Gemini API Key</b> de Google.
                    <br/><span className="text-xs text-gray-400">(Se guardará solo en este equipo)</span>
                </p>
                <input 
                    type="password" 
                    placeholder="Pega tu API Key aquí (AI Studio)" 
                    className="w-full border-2 border-gray-200 focus:border-yellow-400 p-3 rounded-lg mb-4 outline-none transition-colors"
                    value={newApiKey}
                    onChange={e => setNewApiKey(e.target.value)}
                />
                <button 
                    onClick={handleSetInitialKey} 
                    disabled={!newApiKey}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-colors shadow-md"
                >
                    Guardar y Empezar
                </button>
                <p className="mt-4 text-[10px] text-gray-400 text-center">
                    Consíguela gratis en <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline hover:text-yellow-600">Google AI Studio</a>
                </p>
            </div>
        </div>
      );
  }

  // VIEW: HOME
  if (currentView === 'HOME') {
    return (
      <div className="h-screen bg-yellow-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-yellow-200 rounded-full opacity-30 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-orange-200 rounded-full opacity-30 blur-3xl"></div>
        
        {/* API Key Reset (Small settings button) */}
        <button 
            onClick={() => setShowKeyPrompt(true)}
            className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 p-2"
            title="Cambiar API Key"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
        </button>

        <div className="z-10 text-center max-w-2xl w-full">
          <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border-4 border-white animate-float">
             <span className="text-5xl font-bold text-white antelito-font">A</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-2 antelito-font">Bienvenido a Antelito</h1>
          <p className="text-slate-500 mb-10 text-lg">¿Cómo quieres ingresar hoy?</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* User Card */}
            <button 
              onClick={() => setCurrentView('CHAT')}
              className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-yellow-400 group"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.18.057-2.09 1.024-2.09 2.201v2.853c0 1.18.91 2.164 2.09 2.201.23.01.46.02.69.026m9.468-9.514a6.38 6.38 0 01-3.877-1.47 17.5 17.5 0 01-2.05-1.77 15.905 15.905 0 01-1.638-1.77c-.96-1.199-.302-3.033 1.258-3.033.435 0 .86.082 1.263.22 1.096.375 1.956 1.157 2.479 2.217 1.054.21 2.148.058 3.196-.407.576-.256 1.257-.042 1.574.475a4.01 4.01 0 01.374 2.316l-.28 1.956" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Usuario</h3>
              <p className="text-gray-500 text-sm">Quiero hacer preguntas y chatear con la información.</p>
            </button>

            {/* Admin Card */}
            <button 
              onClick={() => { setShowAdminLogin(true); setLoginError(false); setAdminPassword(''); }}
              className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-slate-400 group"
            >
              <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Administrador</h3>
              <p className="text-gray-500 text-sm">Quiero subir documentos y configurar la biblioteca.</p>
            </button>
          </div>
        </div>
        
        {/* Helper Antelito */}
        <div className="absolute bottom-10 right-10 opacity-80 hover:opacity-100 transition-opacity">
            <Antelito state={AntelitoState.IDLE} message="¡Hola! Elige una opción." />
        </div>

        {/* Admin Login Modal */}
        {showAdminLogin && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className={`bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all ${loginError ? 'animate-shake' : ''}`}>
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                               <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                             </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Acceso Restringido</h2>
                        <p className="text-sm text-slate-500">Solo personal autorizado</p>
                    </div>

                    <input 
                        type="password" 
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setLoginError(false); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                        placeholder="Contraseña"
                        autoFocus
                        className={`w-full bg-slate-50 border ${loginError ? 'border-red-500 bg-red-50' : 'border-slate-200'} rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-6 transition-colors`}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setShowAdminLogin(false)}
                            className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleAdminLogin}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 font-medium transition-colors"
                        >
                            Entrar
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  if (currentView === 'ADMIN') {
    return (
      <NotebookEditor 
        context={libraryContext} 
        onUpdate={setLibraryContext} 
        onBack={() => setCurrentView('HOME')}
        isSaving={isSaving}
      />
    );
  }

  return <ChatInterface libraryContext={libraryContext} onBack={() => setCurrentView('HOME')} />;
};

const ChatInterface: React.FC<{ libraryContext: LibraryContext, onBack: () => void }> = ({ libraryContext, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "¡Hola! Soy Antelito. Estoy conectado a la biblioteca. ¿En qué puedo ayudarte?",
      sender: Sender.BOT,
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [antelitoState, setAntelitoState] = useState<AntelitoState>(AntelitoState.IDLE);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: Sender.USER,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAntelitoState(AntelitoState.THINKING);

    const history = messages.map(m => ({
      role: m.sender === Sender.USER ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const fullContext = libraryContext.documents.map(doc => 
      `--- INICIO DOCUMENTO: ${doc.name} --- \n${doc.content}\n--- FIN DOCUMENTO ---`
    ).join('\n\n');

    const responseText = await generateResponse(userMsg.text, fullContext, history);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: Sender.BOT,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMsg]);
    setAntelitoState(AntelitoState.SPEAKING);

    setTimeout(() => {
        setAntelitoState(AntelitoState.IDLE);
    }, 4000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessageContent = (text: string) => {
    const rawMarkup = marked.parse(text) as string;
    return { __html: rawMarkup };
  };

  return (
    <div className="flex flex-col h-screen bg-[#FDF8E4] relative font-sans">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center z-10 border-b border-yellow-200">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-yellow-600 shadow-sm">
                <span className="text-xl font-bold text-white antelito-font">A</span>
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-800 tracking-tight">Chat de Antelito</h1>
                <p className="text-xs text-gray-500 font-medium">Conectado a: {libraryContext.title}</p>
            </div>
        </div>
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
             <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
           </svg>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide">
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
            {messages.map((msg) => (
            <div 
                key={msg.id} 
                className={`flex w-full ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}
            >
                <div 
                className={`
                    relative max-w-[85%] sm:max-w-[75%] px-5 py-3 rounded-2xl shadow-sm text-sm sm:text-base leading-relaxed
                    ${msg.sender === Sender.USER 
                    ? 'bg-yellow-500 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}
                `}
                >
                    <div 
                        className={`prose ${msg.sender === Sender.USER ? 'prose-invert' : 'prose-stone'} max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0`}
                        dangerouslySetInnerHTML={renderMessageContent(msg.text)} 
                    />
                    <span className={`text-[10px] absolute bottom-1 ${msg.sender === Sender.USER ? 'left-2 text-yellow-100' : 'right-2 text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            type="text"
            className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-500 border-0 rounded-full px-5 py-3 focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all shadow-inner outline-none"
            placeholder="Pregúntale a Antelito sobre tus documentos..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setAntelitoState(AntelitoState.LISTENING)}
            onBlur={() => setAntelitoState(AntelitoState.IDLE)}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || antelitoState === AntelitoState.THINKING}
            className={`
                bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-3 transition-all transform hover:scale-105 shadow-md flex-shrink-0
                ${(!inputValue.trim() || antelitoState === AntelitoState.THINKING) ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>

      <Antelito 
        state={antelitoState} 
        onClick={() => setAntelitoState(AntelitoState.EXCITED)}
      />
    </div>
  );
};

export default App;