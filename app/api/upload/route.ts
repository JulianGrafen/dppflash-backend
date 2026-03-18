import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Debug: Prüfen, ob der Content-Type stimmt
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type muss multipart/form-data sein" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    
    // Debug: Alle Keys im FormData loggen
    console.log("Empfangene Felder:", Array.from(formData.keys()));

    const file = formData.get('file');

    // Validierung: Ist es eine Datei?
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Keine Datei unter dem Key 'file' gefunden." }, 
        { status: 400 }
      );
    }

    // Optional: Dateityp prüfen (application/pdf)
    if (file.type !== 'application/pdf') {
       return NextResponse.json(
        { error: `Ungültiger Typ: ${file.type}. Nur PDF erlaubt.` }, 
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`Datei empfangen: ${file.name}, Größe: ${buffer.length} Bytes`);

    // Hier würde die Speicherung oder OCR-Verarbeitung folgen
    return NextResponse.json({ 
      success: true, 
      fileName: file.name 
    });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}