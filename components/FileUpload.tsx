
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            if(files[0].type === 'application/pdf') {
                onFileSelect(files[0]);
            }
        }
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelect(files[0]);
        }
    };

    return (
        <div className="flex items-center justify-center h-full">
            <label
                htmlFor="pdf-upload"
                className={`w-full max-w-lg h-64 border-4 border-dashed rounded-2xl flex flex-col items-center justify-center
                            cursor-pointer transition-all duration-300 ease-in-out
                            ${isDragging ? 'border-purple-500 bg-gray-700' : 'border-gray-600 hover:border-purple-400 hover:bg-gray-700/50'}`}
            >
                <div
                    className="w-full h-full flex flex-col items-center justify-center"
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <UploadIcon className="w-16 h-16 text-gray-500 mb-4 transition-transform duration-300 group-hover:scale-110" />
                    <p className="text-xl font-semibold text-gray-300">
                        Glissez-déposez un fichier PDF ici
                    </p>
                    <p className="text-gray-500 mt-2">ou cliquez pour sélectionner un fichier</p>
                    <input
                        id="pdf-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf"
                        onChange={handleChange}
                    />
                </div>
            </label>
        </div>
    );
};

export default FileUpload;
