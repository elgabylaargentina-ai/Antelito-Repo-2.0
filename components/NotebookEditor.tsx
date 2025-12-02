import React, { useRef, useState } from 'react';
import { LibraryContext, DocumentFile } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// CRITICAL FIX: Handle the worker import for Vite + PDFJS v4 + Electron
import * as pdfWorkerModule from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Determine the worker URL safely
// @ts-ignore
const workerSrc = pdfWorkerModule.default || pdfWorkerModule;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface NotebookEditorProps {
  context: LibraryContext;
  onUpdate: (newContext: LibraryContext) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export const NotebookEditor: React.FC<NotebookEditorProps> = ({ context, onUpdate, onBack, isSaving = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- PDF & FILE HANDLING ---

  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Página ${i} ---\n${pageText}`;
      }
      return fullText;
    } catch (e) {
      console.error("PDF Extraction Failed", e);
      throw new Error("No se pudo leer el PDF. ¿Está dañado o protegido?");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    try {
      const newDocs: DocumentFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let content = "";
        let type: 'pdf' | 'text' | 'md' = 'text';

        try {
          if (file.type === 'application/pdf') {
            type = 'pdf';
            content = await extractTextFromPdf(file);
          } else {
            type = file.name.endsWith('.md') ? 'md' : 'text';
            content = await file.text();
          }

          newDocs.push({
            id: Date.now().toString() + Math.random().toString(),
            name: file.name,
            content: content,
            type: type
          });
        } catch (err) {
          alert(`Error leyendo ${file.name}: ${(err as Error).message}`);
        }
      }

      if (newDocs.length > 0) {
        onUpdate({
          ...context,
          documents: [...context.documents, ...newDocs]
        });
      }

    } catch (error) {
      console.error("Error global reading files", error);
      alert("¡Uy! Hubo un problema general leyendo los archivos.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDocument = (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este documento?")) {
      onUpdate({
        ...context,
        documents: context.documents.filter(d => d.id !== id)
      });
    }
  };

  // --- IMPORT / EXPORT HANDLING ---

  const handleExport = () => {
    const dataStr = JSON.stringify(context, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `antelito_backup_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ ATENCIÓN: Se reemplazarán todos los documentos actuales con los del archivo que vas a subir.\n\n¿Continuar?")) {
        if (importInputRef.current) importInputRef.current.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target?.result as string);
            if (json.documents && Array.isArray(json.documents)) {
                onUpdate(json);
                alert("✅ ¡Biblioteca cargada correctamente!");
            } else {
                alert("❌ El archivo no es válido.");
            }
        } catch (err) {
            console.error(err);
            alert("❌ Error al leer el archivo.");
        }
        if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
      {/* Admin Header */}
      <header className="bg-slate-800 text-white shadow-md px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 text-slate-900 p-2 rounded-lg">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
             </svg>
          </div>
          <div>
             <h1 className="text-xl font-bold flex items-center gap-2">
               Panel de Administración
               {isSaving && (
                 <span className="text-xs font-normal bg-yellow-500 text-slate-900 px-2 py-0.5 rounded-full animate-pulse">
                   Guardando...
                 </span>
               )}
               {!isSaving && (
                  <span className="text-xs font-normal text-green-400 flex items-center gap-1 opacity-70">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                    Sincronizado
                  </span>
               )}
             </h1>
             <p className="text-xs text-slate-400">Configuración de Biblioteca Antelito</p>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="text-sm bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md transition-colors flex items-center gap-2 border border-slate-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Volver al Inicio
        </button>
      </header>
      
      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        
        {/* INFO CARD */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-blue-700">
                        <b>Modo Local:</b> Los cambios se guardan automáticamente en esta computadora.
                        <br/>
                        Para llevar tus documentos a otra PC, usa la sección de <b>"Portabilidad"</b> abajo.
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Collection Name */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex flex-col justify-center">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la Colección</label>
                <input
                    type="text"
                    value={context.title}
                    onChange={(e) => onUpdate({ ...context, title: e.target.value })}
                    className="w-full text-lg border-b-2 border-gray-200 focus:border-yellow-500 outline-none py-2 px-1 transition-colors bg-transparent"
                    placeholder="Ej. Mis Guías de Trabajo"
                />
            </div>

            {/* PORTABILITY / BACKUP CARD */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-bl">PORTABILIDAD</div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Mover a otro Equipo / USB</label>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExport}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm group"
                        title="Guardar todo en un archivo .json"
                    >
                        <div className="bg-green-100 text-green-600 p-1.5 rounded group-hover:bg-green-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div>
                            <span className="block font-bold">Descargar</span>
                            <span className="text-[10px] text-gray-400">Guardar archivo</span>
                        </div>
                    </button>
                    
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={importInputRef} 
                        className="hidden" 
                        onChange={handleImport} 
                    />
                    <button 
                        onClick={() => importInputRef.current?.click()}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm group"
                        title="Cargar un archivo .json guardado anteriormente"
                    >
                         <div className="bg-orange-100 text-orange-600 p-1.5 rounded group-hover:bg-orange-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                        </div>
                        <div>
                            <span className="block font-bold">Cargar</span>
                            <span className="text-[10px] text-gray-400">Restaurar copia</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>

        {/* Upload & List Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
           <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                  <h2 className="text-lg font-bold text-gray-800">Documentos Activos</h2>
                  <p className="text-sm text-gray-500">Antelito usará estos archivos para responder.</p>
              </div>
              <div>
                  <input 
                    type="file" 
                    accept=".txt,.md,.json,.pdf" 
                    multiple
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50 hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                     {isProcessing ? 'Procesando...' : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                           </svg>
                           Agregar Documentos
                        </>
                     )}
                  </button>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto">
              {context.documents.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-gray-300">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                    </div>
                    <p className="font-medium">Tu biblioteca está vacía.</p>
                    <p className="text-sm opacity-70">Sube PDFs o archivos de texto para empezar.</p>
                 </div>
              ) : (
                 <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0">
                       <tr>
                          <th className="px-6 py-3">Nombre</th>
                          <th className="px-6 py-3">Tipo</th>
                          <th className="px-6 py-3">Tamaño</th>
                          <th className="px-6 py-3 text-right">Acciones</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {context.documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-yellow-50/30 transition-colors bg-white">
                             <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                <div className={`p-2 rounded-md ${doc.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                   {doc.type === 'pdf' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM12.75 12a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V18a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V12z" clipRule="evenodd" />
                                      </svg>
                                   ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M3 4.875C3 3.839 3.84 3 4.875 3h4.5c1.036 0 1.875.84 1.875 1.875v1.875c0 1.036.84 1.875 1.875 1.875H15a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H4.875A1.875 1.875 0 013 19.875V4.875zM6 8.25a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 016 8.25z" clipRule="evenodd" />
                                      </svg>
                                   )}
                                </div>
                                {doc.name}
                             </td>
                             <td className="px-6 py-4 text-sm text-gray-500 uppercase">{doc.type}</td>
                             <td className="px-6 py-4 text-sm text-gray-500">{Math.round(doc.content.length / 1024)} KB</td>
                             <td className="px-6 py-4 text-right">
                                <button 
                                   onClick={() => removeDocument(doc.id)}
                                   className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all"
                                   title="Eliminar documento"
                                >
                                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                   </svg>
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};