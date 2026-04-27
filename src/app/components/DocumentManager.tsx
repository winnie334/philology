"use client";

import React, {useState} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db, AppDocument} from "@/lib/db";
import UploadZone from "@/app/components/UploadZone";
import DocumentList from "@/app/components/DocumentList";
import PdfViewer from "@/app/components/PdfViewer";


export default function DocumentManager() {
    const [activeFile, setActiveFile] = useState<Blob | null>(null);
    const documents = useLiveQuery(() => db.documents.toArray());

    // Inside DocumentManager component
    const handleUpload = async (files: File[]) => {
        const newDocs = files.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            data: file, // This is the Blob
            createdAt: Date.now(),
        }));

        try {
            await db.documents.bulkAdd(newDocs);
        } catch (error) {
            console.error("Failed to upload some documents:", error);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm("Delete this PDF?")) await db.documents.delete(id);
    };

    const handleRename = async (id: number, newName: string) => {
        const nameWithExt = newName.toLowerCase().endsWith(".pdf") ? newName : `${newName}.pdf`;
        await db.documents.update(id, {name: nameWithExt});
    };

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-10">
            <h1 className="text-3xl font-bold">Document Hub</h1>

            <UploadZone onUpload={handleUpload}/>

            <DocumentList
                documents={documents || []}
                onDelete={handleDelete}
                onRename={handleRename}
                onView={(doc) => setActiveFile(doc.data)} // Pass the blob to the viewer
            />

            {/* Embedded Viewer Modal */}
            {activeFile && (
                <PdfViewer
                    blob={activeFile}
                    onClose={() => setActiveFile(null)}
                />
            )}
        </div>
    );
}