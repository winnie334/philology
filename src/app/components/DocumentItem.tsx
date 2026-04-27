import { useState } from 'react';
import { AppDocument } from "@/lib/db";

export default function DocumentItem({ doc, onDelete, onRename }: {
    doc: AppDocument;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(doc.name);

    const openPdf = () => {
        const url = URL.createObjectURL(doc.data);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    return (
        <div className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm">
            {isEditing ? (
                <input
                    className="border p-1 rounded flex-1"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => { onRename(doc.id!, tempName); setIsEditing(false); }}
                    autoFocus
                />
            ) : (
                <div onClick={openPdf} className="cursor-pointer flex-1">
                    <p className="font-medium text-gray-800">📄 {doc.name}</p>
                </div>
            )}

            <div className="flex gap-2 ml-4">
                <button onClick={() => setIsEditing(!isEditing)} className="text-blue-500 text-sm">Rename</button>
                <button onClick={() => onDelete(doc.id!)} className="text-red-500 text-sm">Delete</button>
            </div>
        </div>
    );
}