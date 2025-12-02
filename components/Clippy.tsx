import React, { useEffect, useState } from 'react';
import { AntelitoState } from '../types';

interface AntelitoProps {
  state: AntelitoState;
  message?: string;
  onClick?: () => void;
}

export const Antelito: React.FC<AntelitoProps> = ({ state, message, onClick }) => {
  const [bubbleText, setBubbleText] = useState<string>('');

  useEffect(() => {
    if (message) {
      setBubbleText(message);
    } else {
      switch (state) {
        case AntelitoState.THINKING:
          setBubbleText("Mmm... procesando...");
          break;
        case AntelitoState.IDLE:
          setBubbleText("¡Hola! Soy todo oídos.");
          break;
        case AntelitoState.SPEAKING:
          setBubbleText("¡Tengo la respuesta!");
          break;
        case AntelitoState.EXCITED:
          setBubbleText("¡Me encanta esa pregunta!");
          break;
        default:
          setBubbleText("");
      }
    }
  }, [state, message]);

  // Animation classes based on state
  const getEyeClass = () => {
    if (state === AntelitoState.THINKING) return 'animate-pulse';
    return 'animate-blink';
  };

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none sm:pointer-events-auto"
      style={{ filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.2))' }}
    >
      {/* Speech Bubble Context (The actual thought bubble above the character) */}
      {bubbleText && (
        <div className="mb-2 mr-10 bg-white border-2 border-yellow-500 rounded-2xl rounded-br-none p-4 max-w-[200px] relative antelito-font text-sm font-bold animate-float shadow-lg text-gray-800">
          {bubbleText}
        </div>
      )}

      {/* Antelito Character (Yellow Message Bubble) */}
      <div 
        onClick={onClick}
        className={`w-32 h-32 sm:w-40 sm:h-40 transition-transform duration-300 cursor-pointer hover:scale-105 origin-bottom ${state === AntelitoState.SPEAKING ? 'animate-bounce' : ''}`}
      >
        <svg 
          viewBox="0 0 200 200" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full h-full overflow-visible"
        >
          {/* Main Bubble Body */}
          <path 
            d="M 20 80 A 60 60 0 0 1 180 80 C 180 125 150 150 100 150 C 80 150 60 145 50 155 L 30 175 L 40 145 C 20 130 20 110 20 80 Z"
            fill="#FACC15" /* Yellow-400 */
            stroke="#EAB308" /* Yellow-600 */
            strokeWidth="4" 
            strokeLinejoin="round"
          />

          {/* Highlight (Shine) */}
          <path 
            d="M 40 50 Q 50 30 90 35"
            fill="none"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Face Container */}
          <g transform="translate(0, 0)">
             {/* Left Eye */}
             <ellipse cx="70" cy="85" rx="8" ry="12" fill="black" className={getEyeClass()} />
             <circle cx="72" cy="80" r="3" fill="white" />
             
             {/* Right Eye */}
             <ellipse cx="130" cy="85" rx="8" ry="12" fill="black" className={getEyeClass()} style={{ animationDelay: '0.1s' }} />
             <circle cx="132" cy="80" r="3" fill="white" />
          </g>

          {/* Mouth (Changes based on state) */}
          {state === AntelitoState.SPEAKING ? (
             <circle cx="100" cy="120" r="10" fill="#374151" /> 
          ) : state === AntelitoState.THINKING ? (
             <circle cx="100" cy="120" r="5" fill="#374151" />
          ) : state === AntelitoState.EXCITED ? (
             <path d="M 80 115 Q 100 135 120 115" fill="none" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
          ) : (
             <path d="M 85 120 Q 100 130 115 120" fill="none" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
          )}

        </svg>
      </div>
    </div>
  );
};