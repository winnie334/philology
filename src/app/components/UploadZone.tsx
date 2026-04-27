import React, { useRef, useState } from 'react';

interface Props {
    onUpload: (files: File[]) => void; // Changed to accept an array
}

export default function UploadZone({ onUpload }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            processFiles(Array.from(e.dataTransfer.files));
        }
    };

    const processFiles = (files: File[]) => {
        // Filter for PDFs only
        const pdfs = files.filter(f => f.type === "application/pdf");

        if (pdfs.length > 0) {
            onUpload(pdfs);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }

        if (pdfs.length < files.length) {
            alert(`${files.length - pdfs.length} files were skipped (not PDFs).`);
        }
    };

    return (
        <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group cursor-pointer p-6 border-2 border-dashed rounded-2xl transition-all text-center ${
                isDragging ? "bg-blue-100 border-blue-500" : "bg-gray-50 border-gray-300 hover:border-blue-300"
            }`}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="application/pdf"
                multiple // CRITICAL: Allows selecting multiple files in the dialog
                className="hidden"
            />
            <div className="flex flex-col items-center gap-1 pointer-events-none">
                <span className="text-2xl">📥</span>
                <p className="text-sm font-medium text-blue-600">Upload multiple PDFs</p>
                <p className="text-[10px] text-gray-400">Drag them all in at once</p>
            </div>
        </div>
    );
}