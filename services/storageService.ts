import { LibraryContext } from '../types';

const DB_NAME = 'AntelitoDB';
const STORE_NAME = 'libraryStore';
const DB_VERSION = 1;

// Helper to open the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error("IndexedDB not supported"));
        return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error("IndexedDB Open Error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Save the entire library context
export const saveLibrary = async (library: LibraryContext): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Put is generally atomic
    const request = store.put(library, 'currentLibrary');

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
          resolve();
      };
      transaction.onerror = () => {
          console.error("IndexedDB Transaction Error:", transaction.error);
          reject(transaction.error);
      };
      request.onerror = () => {
          console.error("IndexedDB Put Error:", request.error);
      };
    });
  } catch (error) {
    console.error("Error saving library to IndexedDB:", error);
    throw error;
  }
};

// Load the library context
export const loadLibrary = async (): Promise<LibraryContext | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('currentLibrary');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
          if (request.result) {
              resolve(request.result as LibraryContext);
          } else {
              // Valid connection, but no data yet (first run)
              resolve(null);
          }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error loading library from IndexedDB:", error);
    // Important: Re-throw error so App knows loading FAILED, not just "empty"
    throw error;
  }
};