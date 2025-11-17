
import React, { useEffect, useRef } from 'react';

interface TextViewerProps {
    sentences: string[];
    currentSentenceIndex: number;
}

const TextViewer: React.FC<TextViewerProps> = ({ sentences, currentSentenceIndex }) => {
    const activeSentenceRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeSentenceRef.current && containerRef.current) {
            const container = containerRef.current;
            const activeElement = activeSentenceRef.current;
            
            const containerRect = container.getBoundingClientRect();
            const elementRect = activeElement.getBoundingClientRect();
            
            const isVisible =
                elementRect.top >= containerRect.top &&
                elementRect.bottom <= containerRect.bottom;

            if (!isVisible) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }, [currentSentenceIndex]);

    return (
        <div ref={containerRef} className="flex-grow bg-gray-900/50 rounded-lg p-6 overflow-y-auto text-lg leading-relaxed text-gray-300 scroll-smooth">
            <p>
                {sentences.map((sentence, index) => (
                    <span
                        key={index}
                        ref={index === currentSentenceIndex ? activeSentenceRef : null}
                        className={`transition-all duration-500 ${
                            index === currentSentenceIndex
                                ? 'bg-purple-500/30 text-white font-semibold rounded'
                                : ''
                        }`}
                    >
                        {sentence}{' '}
                    </span>
                ))}
            </p>
        </div>
    );
};

export default TextViewer;
