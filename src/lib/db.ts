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
    mapAtoB: Record<string, number>;
    mapBtoA: Record<string, number>;
}

export interface AppAbbreviation {
    id?: number;
    abbr: string;    // short form,  e.g. "ppr"
    meaning: string; // expanded form, e.g. "proprio"
    createdAt: number;
}

class PhilologyDB extends Dexie {
    documents!: Table<AppDocument>;
    mappings!: Table<AppMapping>;
    abbreviations!: Table<AppAbbreviation>;

    constructor() {
        super('PhilologyDB');
        this.version(1).stores({ documents: '++id, name, createdAt' });
        this.version(2).stores({
            documents: '++id, name, createdAt',
            mappings: '++id, docAId, docBId, createdAt',
        });
        this.version(3).stores({
            documents: '++id, name, createdAt',
            mappings: '++id, docAId, docBId, createdAt',
            abbreviations: '++id, abbr, createdAt',
        });
    }
}

export const db = new PhilologyDB();