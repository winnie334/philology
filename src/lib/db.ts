import Dexie, { Table } from 'dexie';

export interface AppDocument {
    id?: number;
    name: string;
    data: Blob;
    size: number;
    type: string;
    createdAt: number;
    transcriptions: string[]; // per page: JSON string of {text, box_2d}[]
}

export interface AppMapping {
    id?: number;
    docAId: number;
    docBId: number;
    createdAt: number;
    // globalLineA (string key) → globalLineB
    mapAtoB: Record<string, number>;
    // globalLineB (string key) → globalLineA
    mapBtoA: Record<string, number>;
}

class PhilologyDB extends Dexie {
    documents!: Table<AppDocument>;
    mappings!: Table<AppMapping>;

    constructor() {
        super('PhilologyDB');
        // v1 — original documents table
        this.version(1).stores({
            documents: '++id, name, createdAt',
        });
        // v2 — adds mappings table; documents untouched
        this.version(2).stores({
            documents: '++id, name, createdAt',
            mappings: '++id, docAId, docBId, createdAt',
        });
    }
}

export const db = new PhilologyDB();