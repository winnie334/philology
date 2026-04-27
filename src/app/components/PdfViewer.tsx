import React from 'react';

interface Props {
    blob: Blob | null;
    onClose: () => void;
}

export default function PdfViewer({ blob, onClose }: Props) {
    if (!blob) return null;

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col z-50">
            <div className="bg-white p-4 flex justify-between items-center shadow-md">
                <h3 className="font-bold">Document Preview</h3>
                <button
                    onClick={onClose}
                    className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
                >
                    Close
                </button>
            </div>
            <div className="flex-1 w-full h-full bg-gray-800">
                <iframe
                    src={`${url}#toolbar=0`}
                    className="w-full h-full"
                    title="PDF Preview"
                />
            </div>
        </div>
    );
}