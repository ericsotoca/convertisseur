
import React, { useEffect, useRef } from 'react';
import { Chapter } from '../hooks/usePdfParser';
import { PlayIcon, PauseIcon, DownloadIcon, RetryIcon, LoadingSpinner } from './icons';

interface ChapterListProps {
    chapters: Chapter[];
    currentlyPlayingId: string | null;
    onPlay: (chapter: Chapter) => void;
    onDownload: (chapter: Chapter) => void;
    onRetry: (chapterId: string) => void;
    isBulkConverting: boolean;
    selectedChapterIds: Set<string>;
    selectableCount: number;
    onToggleChapter: (chapterId: string) => void;
    onToggleSelectAll: () => void;
    onConvertSelected: () => void;
}

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ChapterItem: React.FC<{ chapter: Chapter } & Omit<ChapterListProps, 'chapters' | 'selectableCount' | 'onToggleSelectAll' | 'onConvertSelected' | 'isBulkConverting'>> = ({
    chapter,
    currentlyPlayingId,
    onPlay,
    onDownload,
    onRetry,
    selectedChapterIds,
    onToggleChapter,
}) => {
    const renderStatus = () => {
        switch (chapter.status) {
            case 'pending':
                return <span className="text-sm text-gray-400">Prêt à convertir</span>;
            case 'converting':
                return (
                    <div className="flex items-center space-x-2 text-sm text-purple-400">
                        <LoadingSpinner className="w-4 h-4" />
                        <span>Conversion... ({chapter.progress || 0}%)</span>
                    </div>
                );
            case 'ready':
                return (
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => onPlay(chapter)}
                            className="p-2 rounded-full text-gray-300 bg-gray-600 hover:bg-purple-600 hover:text-white transition-colors"
                            aria-label={currentlyPlayingId === chapter.id ? 'Pause' : 'Play'}
                        >
                            {currentlyPlayingId === chapter.id ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => onDownload(chapter)}
                            className="p-2 rounded-full text-gray-300 bg-gray-600 hover:bg-indigo-600 hover:text-white transition-colors"
                             aria-label="Download"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    </div>
                );
            case 'error':
                 return (
                    <div className="flex items-center space-x-3">
                        <span className="text-sm text-red-400 truncate" title={chapter.error}>Erreur</span>
                        <button
                            onClick={() => onRetry(chapter.id)}
                            className="p-2 rounded-full text-gray-300 bg-gray-600 hover:bg-yellow-600 hover:text-white transition-colors"
                            aria-label="Retry"
                        >
                            <RetryIcon className="w-5 h-5" />
                        </button>
                    </div>
                );
        }
    };
    
    const isSelectable = chapter.status === 'pending' || chapter.status === 'error';

    return (
        <li className="flex items-center p-4 bg-gray-900/50 rounded-lg animate-fade-in space-x-4">
            <div className="flex-shrink-0">
                {isSelectable ? (
                     <input
                        type="checkbox"
                        checked={selectedChapterIds.has(chapter.id)}
                        onChange={() => onToggleChapter(chapter.id)}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        aria-label={`Select chapter ${chapter.title}`}
                    />
                ) : (
                    <div className="w-5 h-5" /> // Placeholder for alignment
                )}
            </div>
            <div className="flex flex-col min-w-0 flex-grow">
                <span className="font-semibold text-gray-200 truncate pr-2" title={chapter.title}>{chapter.title}</span>
                 <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>Page {chapter.pageNumber}</span>
                    {chapter.duration !== undefined && chapter.duration > 0 && (
                        <>
                            <span aria-hidden="true">&bull;</span>
                            <span>{formatDuration(chapter.duration)}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 ml-auto">{renderStatus()}</div>
        </li>
    );
};


const ChapterList: React.FC<ChapterListProps> = (props) => {
    const { chapters, selectedChapterIds, selectableCount, onToggleSelectAll, onConvertSelected, isBulkConverting } = props;

    const numSelected = selectedChapterIds.size;
    const allSelected = selectableCount > 0 && numSelected === selectableCount;

    const checkboxRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.checked = allSelected;
            checkboxRef.current.indeterminate = numSelected > 0 && !allSelected;
        }
    }, [numSelected, allSelected]);

    return (
        <div className="h-full flex flex-col">
            {chapters.length > 0 && (
                 <div className="flex-shrink-0 p-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10 gap-4">
                    <div className="flex items-center space-x-3">
                        <input
                            ref={checkboxRef}
                            type="checkbox"
                            onChange={onToggleSelectAll}
                            disabled={selectableCount === 0}
                            className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Select all chapters"
                        />
                        <label htmlFor="select-all" className="text-gray-400 text-sm sm:text-base">
                           {numSelected} / {selectableCount} sélectionné(s)
                        </label>
                    </div>
                    <button
                        onClick={onConvertSelected}
                        disabled={numSelected === 0 || isBulkConverting}
                        className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {isBulkConverting ? (
                            <>
                                <LoadingSpinner className="w-5 h-5 mr-2 -ml-1" />
                                Conversion...
                            </>
                        ) : (
                            `Convertir ${numSelected > 0 ? `(${numSelected})` : ''}`
                        )}
                    </button>
                </div>
            )}
            <div className="flex-grow overflow-y-auto">
                <ul className="space-y-3 p-1 sm:p-4">
                    {props.chapters.map(chapter => (
                        <ChapterItem key={chapter.id} {...props} chapter={chapter} />
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default ChapterList;
