import React from 'react';
// FIX: The usePdfParser hook does not export ProcessedOutlineItem. This component seems to be based on an old implementation.
// It is currently unused in the application. To fix the error, we could define the type, but it's better to adapt it
// to use the existing `Chapter` type, although it will not render a nested list anymore as Chapter is a flat structure.
import type { Chapter } from '../hooks/usePdfParser';

interface OutlineViewerProps {
    outline: Chapter[];
    isVisible: boolean;
    onClose: () => void;
    onSelectItem: (item: Chapter) => void;
}

const OutlineSublist: React.FC<{ items: Chapter[], onSelectItem: (item: Chapter) => void; level: number }> = ({ items, onSelectItem, level }) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <ul className={level > 0 ? 'pl-4 border-l border-gray-600' : ''}>
            {items.map((item, index) => (
                <li key={item.id} className="my-1">
                    <button
                        onClick={() => onSelectItem(item)}
                        className="w-full text-left p-2 rounded-md transition-colors text-gray-300 hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                        <span className="truncate">{item.title}</span>
                        {item.pageNumber !== null && <span className="text-xs text-gray-500 float-right pt-1">{item.pageNumber}</span>}
                    </button>
                </li>
            ))}
        </ul>
    );
};

const OutlineViewer: React.FC<OutlineViewerProps> = ({ outline, isVisible, onClose, onSelectItem }) => {
    return (
        <>
            <div
                className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${
                    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            ></div>
            <aside
                className={`fixed top-0 left-0 h-full w-80 max-w-[90vw] bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
                    isVisible ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Plan du document</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">&times;</button>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
                    {outline.length > 0 ? (
                        <OutlineSublist items={outline} onSelectItem={onSelectItem} level={0} />
                    ) : (
                        <p className="text-gray-400">Aucun plan trouvé dans ce document.</p>
                    )}
                </div>
            </aside>
        </>
    );
};

export default OutlineViewer;