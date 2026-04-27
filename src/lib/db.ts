import Dexie, { Table } from 'dexie';

export interface AppDocument {
    id?: number;
    name: string;
    type: string;
    size: number;
    data: Blob;
    createdAt: number;
    transcriptions: string[]; // one string per page
}

export class MyDatabase extends Dexie {
    documents!: Table<AppDocument>;

    constructor() {
        super('DocumentDB');
        this.version(1).stores({
            documents: '++id, name, createdAt'
        });
    }
}

export const db = new MyDatabase();