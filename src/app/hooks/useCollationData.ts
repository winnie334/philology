// lib/useCollationData.ts
import {useLiveQuery} from 'dexie-react-hooks';
import {db} from '@/lib/db';

export function useCollationData() {
    return useLiveQuery(async () => {
        const variations = await db.variations.toArray();
        const docs = await db.documents.toArray();

        // Map to store counts: "docId1-docId2" -> { similarity: 0, difference: 0 }
        const stats: Record<string, { sim: number; diff: number }> = {};

        variations.forEach(v => {
            const pairKey = [v.docAId, v.docBId].sort().join('-');
            if (!stats[pairKey]) stats[pairKey] = {sim: 0, diff: 0};

            if (v.type === 'similarity') stats[pairKey].sim++;
            else stats[pairKey].diff++;
        });

        return {stats, docs};
    }, []);
}