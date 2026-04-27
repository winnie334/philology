import { AppDocument } from "@/lib/db";
import DocumentItem from './DocumentItem';

interface Props {
    documents: AppDocument[];
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
}

export default function DocumentList({ documents, onDelete, onRename }: Props) {
    return (
        <div className="space-y-3">
            {documents.length === 0 ? (
                <p className="text-center text-gray-400">No documents found.</p>
            ) : (
                documents.map(doc => (
                    <DocumentItem
                        key={doc.id}
                        doc={doc}
                        onDelete={onDelete}
                        onRename={onRename}
                    />
                ))
            )}
        </div>
    );
}