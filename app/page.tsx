"use client";

import React, { useState, ChangeEvent } from 'react';

export default function PdfUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validierung auf Client-Seite (Fakten-Check: spart Server-Ressourcen)
      if (selectedFile.type !== 'application/pdf') {
        setMessage('Bitte nur PDF-Dateien auswählen.');
        return;
      }
      
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    }
  };

  const uploadFile = async () => {
    if (!file) return;

    setStatus('uploading');
    
    // FormData ist notwendig für Datei-Uploads
    const formData = new FormData();
    formData.append('file', file); // Der Key 'file' muss mit dem Backend übereinstimmen

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        // Hinweis: Keinen Content-Type Header manuell setzen! 
        // Der Browser setzt multipart/form-data inkl. Boundary automatisch.
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(`Erfolg: ${data.fileName} wurde hochgeladen.`);
      } else {
        setStatus('error');
        setMessage(data.error || 'Upload fehlgeschlagen.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Verbindungsfehler zum Server.');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-800">DPP Flash Upload</h2>
      <p className="text-sm text-gray-500">Laden Sie Ihr Produktzertifikat hoch, um den digitalen Pass zu erstellen.</p>
      
      <input 
        type="file" 
        accept=".pdf" 
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {file && status !== 'success' && (
        <button 
          onClick={uploadFile}
          disabled={status === 'uploading'}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {status === 'uploading' ? 'Verarbeite PDF...' : 'Jetzt hochladen'}
        </button>
      )}

      {message && (
        <div className={`p-3 rounded text-sm ${status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
    </div>
  );
}