export async function transcribe(_file: File): Promise<string[]> {
    //      const form = new FormData(); form.append('file', _file);
    //      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
    //      return res.json(); // string[]

    await new Promise((r) => setTimeout(r, 600));
    return ["Very solid transcription"];
}