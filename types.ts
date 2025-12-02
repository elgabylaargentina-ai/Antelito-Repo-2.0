export enum Sender {
  USER = 'USER',
  BOT = 'BOT'
}

export enum AntelitoState {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  LISTENING = 'LISTENING',
  EXCITED = 'EXCITED'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
}

export interface DocumentFile {
  id: string;
  name: string;
  content: string; // The extracted text
  type: 'pdf' | 'text' | 'md';
}

export interface LibraryContext {
  title: string;
  documents: DocumentFile[];
}