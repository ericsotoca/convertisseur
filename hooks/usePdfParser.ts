
import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFRef } from 'pdfjs-dist';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData, concatAudioBuffers } from '../utils/audio';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// FIX: Define and export the ProcessedOutlineItem type to resolve an import error in the unused OutlineViewer.tsx component.
export interface ProcessedOutlineItem {
    title: string;
    pageNumber: number | null;
    items: ProcessedOutlineItem[];
}

export interface Chapter {
    id: string;
    title: string;
    pageNumber: number;
    endPageNumber: number;
    status: 'pending' | 'converting' | 'ready' | 'error';
    audioBuffer?: AudioBuffer;
    error?: string;
    progress?: number; // percentage
    duration?: number; // in seconds
}

interface OutlineItem {
    title: string;
    dest: string | any[] | null;
    items: OutlineItem[];
}

const TEXT_CHUNK_SIZE = 4000; // Character limit for TTS API calls

async function processOutline(pdf: PDFDocumentProxy, outlineItems: OutlineItem[]): Promise<Omit<Chapter, 'endPageNumber' | 'status' | 'id' | 'audioBuffer' | 'error' | 'progress' | 'duration'>[]> {
    if (!outlineItems) return [];
    
    let chapters: Omit<Chapter, 'endPageNumber' | 'status' | 'id' | 'audioBuffer' | 'error' | 'progress' | 'duration'>[] = [];
    for (const item of outlineItems) {
        let pageNumber = null;
        if (item.dest) {
            try {
                const destination = typeof item.dest === 'string'
                    ? await pdf.getDestination(item.dest)
                    : item.dest;

                if (destination && destination[0]) {
                    const pageRef = destination[0] as PDFRef;
                    const pageIndex = await pdf.getPageIndex(pageRef);
                    pageNumber = pageIndex + 1;
                }
            } catch (e) {
                console.error("Could not resolve destination for outline item", item.title, e);
            }
        }

        if (pageNumber !== null) {
            chapters.push({ title: item.title, pageNumber });
        }
        
        if (item.items.length > 0) {
            const subChapters = await processOutline(pdf, item.items);
            chapters = chapters.concat(subChapters);
        }
    }
    return chapters;
};

async function getTextForPageRange(pdf: PDFDocumentProxy, startPageNum: number, endPageNum: number): Promise<string> {
    const endPage = Math.min(endPageNum, pdf.numPages);
    let fullText = '';
    for (let i = startPageNum; i <= endPage; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const pageHeight = viewport.height;
        const content = await page.getTextContent();
        
        const filteredItems = content.items.filter(item => {
            if (!('str' in item)) return false;

            const text = item.str.trim();
            if (!text) return false;

            // Check if text is purely numeric
            const isNumeric = /^\d+$/.test(text);
            if (!isNumeric) return true; // Keep non-numeric text

            // Get y-coordinate from transform matrix
            const y = item.transform[5];
            
            // Check if it's in the bottom 10% of the page
            const isFooter = y < pageHeight * 0.1;
            
            // If it's a numeric string in the footer, exclude it
            if (isFooter) {
                return false;
            }

            return true;
        });

        const pageText = filteredItems.map(item => 'str' in item ? item.str : '').join(' ');
        fullText += pageText + '\n';
    }
    return fullText;
}


export const useChapterConverter = (file: File | null) => {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
    const aiRef = useRef<GoogleGenAI | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
    }, []);

    const resetState = useCallback(() => {
        setChapters([]);
        setError(null);
        setIsProcessing(false);
        if (pdfDocRef.current) {
            pdfDocRef.current.destroy();
            pdfDocRef.current = null;
        }
    }, []);
    
    useEffect(() => {
        if (!file) {
            resetState();
            return;
        }

        const setupChapters = async () => {
            resetState();
            setIsProcessing(true);
            try {
                const typedArray = new Uint8Array(await file.arrayBuffer());
                const loadingTask = pdfjsLib.getDocument(typedArray);
                const pdf = await loadingTask.promise;
                pdfDocRef.current = pdf;
                
                const rawOutline = await pdf.getOutline() as OutlineItem[];
                if (!rawOutline || rawOutline.length === 0) {
                    setError("Ce PDF n'a pas de plan (table des matières). Impossible de le diviser en chapitres.");
                    setIsProcessing(false);
                    return;
                }

                const processedOutline = await processOutline(pdf, rawOutline);
                
                // FIX: Add an explicit 'Chapter' return type to the map callback. This provides a contextual type
                // to the returned object literal, preventing TypeScript from widening the 'status' property to 'string'.
                const chapterList: Chapter[] = processedOutline.map((chapter, index): Chapter => {
                    const endPageNumber = (index + 1 < processedOutline.length)
                        ? processedOutline[index + 1].pageNumber - 1
                        : pdf.numPages;
                    return {
                        ...chapter,
                        id: crypto.randomUUID(),
                        endPageNumber,
                        status: 'pending',
                    };
                }).filter(ch => ch.pageNumber <= ch.endPageNumber);

                setChapters(chapterList);
            } catch (err) {
                console.error("Error setting up chapters: ", err);
                setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'analyse du PDF.");
            } finally {
                setIsProcessing(false);
            }
        };

        setupChapters();
        return () => { resetState(); };
    }, [file, resetState]);

    const convertChapter = useCallback(async (chapter: Chapter) => {
        if (!pdfDocRef.current || !aiRef.current || !audioContextRef.current) return;

        setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, status: 'converting', progress: 0, error: undefined } : c));
        
        try {
            const text = await getTextForPageRange(pdfDocRef.current, chapter.pageNumber, chapter.endPageNumber);
            if (!text.trim()) {
                 setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, status: 'ready', audioBuffer: audioContextRef.current?.createBuffer(1,1,24000), duration: 0 } : c));
                 return;
            }
            
            const textChunks: string[] = [];
            let currentChunk = '';
            const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
            for (const sentence of sentences) {
                if ((currentChunk + sentence).length > TEXT_CHUNK_SIZE) {
                    textChunks.push(currentChunk);
                    currentChunk = sentence;
                } else {
                    currentChunk += sentence;
                }
            }
            if (currentChunk) textChunks.push(currentChunk);

            const audioBuffers: AudioBuffer[] = [];

            for (let i = 0; i < textChunks.length; i++) {
                const chunk = textChunks[i];
                const prompt = `Lis ce texte à voix haute en français avec une intonation naturelle : "${chunk}"`;
                
                const response = await aiRef.current.models.generateContent({
                    model: "gemini-2.5-flash-preview-tts",
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    },
                });

                const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (!base64Audio) throw new Error("No audio data received from API for chunk.");
                
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContextRef.current, 24000, 1);
                audioBuffers.push(audioBuffer);

                setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, progress: Math.round(((i + 1) / textChunks.length) * 100) } : c));
            }
            
            const finalBuffer = concatAudioBuffers(audioBuffers, audioContextRef.current);
            setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, status: 'ready', audioBuffer: finalBuffer, duration: finalBuffer.duration } : c));

        } catch (err) {
            console.error(`Error converting chapter ${chapter.id}:`, err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, status: 'error', error: errorMessage } : c));
        }
    }, []);

    return { chapters, isProcessing, error, convertChapter };
};
