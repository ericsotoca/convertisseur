
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useChapterConverter, Chapter } from './hooks/usePdfParser';
import { bufferToWav } from './utils/audio';
import FileUpload from './components/FileUpload';
import ChapterList from './components/PlayerControls';
import { LoadingSpinner } from './components/icons';

const App: React.FC = () => {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const { chapters, isProcessing, error: converterError, convertChapter } = useChapterConverter(pdfFile);

    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const [selectedChapterIds, setSelectedChapterIds] = useState(new Set<string>());
    const [isBulkConverting, setIsBulkConverting] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && !audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
    }, []);

    const stopPlayback = () => {
        if (currentSourceRef.current) {
            currentSourceRef.current.onended = null;
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
            currentSourceRef.current = null;
        }
        setCurrentlyPlayingId(null);
    };

    const handlePlay = (chapter: Chapter) => {
        if (!chapter.audioBuffer || !audioContextRef.current) return;

        if (currentlyPlayingId === chapter.id) {
            stopPlayback();
        } else {
            stopPlayback();
            if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }

            const source = audioContextRef.current.createBufferSource();
            source.buffer = chapter.audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            source.onended = () => {
                if (currentSourceRef.current === source) {
                    setCurrentlyPlayingId(null);
                    currentSourceRef.current = null;
                }
            };
            
            source.start();
            currentSourceRef.current = source;
            setCurrentlyPlayingId(chapter.id);
        }
    };

    const handleDownload = (chapter: Chapter) => {
        if (!chapter.audioBuffer) return;
        const wavBlob = bufferToWav(chapter.audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileSelect = (file: File) => {
        stopPlayback();
        setPdfFile(file);
        setSelectedChapterIds(new Set());
        setIsBulkConverting(false);
    };
    
    const handleToggleChapter = useCallback((chapterId: string) => {
        setSelectedChapterIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterId)) {
                newSet.delete(chapterId);
            } else {
                newSet.add(chapterId);
            }
            return newSet;
        });
    }, []);

    const selectableChapters = chapters.filter(c => c.status === 'pending' || c.status === 'error');

    const handleToggleSelectAll = useCallback(() => {
        if (selectedChapterIds.size === selectableChapters.length) {
            setSelectedChapterIds(new Set());
        } else {
            setSelectedChapterIds(new Set(selectableChapters.map(c => c.id)));
        }
    }, [selectableChapters, selectedChapterIds.size]);

    const handleConvertSelected = async () => {
        setIsBulkConverting(true);
        const chaptersToConvert = chapters
            .filter(c => selectedChapterIds.has(c.id))
            .sort((a, b) => a.pageNumber - b.pageNumber); // Convert in document order

        for (const chapter of chaptersToConvert) {
            if (chapter.status !== 'ready' && chapter.status !== 'converting') {
                await convertChapter(chapter);
            }
        }
        setIsBulkConverting(false);
        setSelectedChapterIds(new Set());
    };

    const handleRetry = async (chapterId: string) => {
        const chapter = chapters.find(c => c.id === chapterId);
        if (chapter) {
            await convertChapter(chapter);
        }
    };

    const renderContent = () => {
        if (isProcessing && chapters.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <LoadingSpinner />
                    <p className="text-lg text-gray-400">Analyse du PDF en cours...</p>
                </div>
            );
        }
        if (converterError) return <p className="text-red-400 text-center">{converterError}</p>;
        if (chapters.length > 0) {
            return (
                <ChapterList
                    chapters={chapters}
                    currentlyPlayingId={currentlyPlayingId}
                    onPlay={handlePlay}
                    onDownload={handleDownload}
                    onRetry={handleRetry}
                    isBulkConverting={isBulkConverting}
                    selectedChapterIds={selectedChapterIds}
                    onToggleChapter={handleToggleChapter}
                    onToggleSelectAll={handleToggleSelectAll}
                    onConvertSelected={handleConvertSelected}
                    selectableCount={selectableChapters.length}
                />
            );
        }
        return <FileUpload onFileSelect={handleFileSelect} />;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8 font-sans">
            <header className="mb-6 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
                    Convertisseur PDF en Livre Audio
                </h1>
                <p className="text-gray-400 mt-2">
                    Téléchargez un PDF et convertissez ses chapitres en fichiers audio à écouter ou à télécharger.
                </p>
            </header>

            <main className="flex-grow flex flex-col bg-gray-800 rounded-xl shadow-2xl overflow-hidden p-2 sm:p-6 relative">
                {renderContent()}
            </main>
        </div>
    );
};

export default App;
