import React, { useState, FormEvent } from 'react';

interface PageNavigatorProps {
    maxPage: number;
    onPageSelect: (page: number) => void;
}

const PageNavigator: React.FC<PageNavigatorProps> = ({ maxPage, onPageSelect }) => {
    const [pageInput, setPageInput] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const pageNum = parseInt(pageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPage) {
            onPageSelect(pageNum);
            setPageInput('');
        }
    };

    if (maxPage === 0) return null;

    return (
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <input
                type="number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                min="1"
                max={maxPage}
                placeholder={`1-${maxPage}`}
                className="w-20 bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-center text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                aria-label="Numéro de page"
            />
            <button
                type="submit"
                className="px-3 py-1 bg-gray-600 hover:bg-purple-600 rounded-md text-white transition-colors"
            >
                Aller
            </button>
        </form>
    );
};

export default PageNavigator;
