import type { Metadata } from 'next';
import { Playfair_Display, Lora } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    display: 'swap',
    weight: ['400', '600', '700'],
});

const lora = Lora({
    subsets: ['latin'],
    variable: '--font-lora',
    display: 'swap',
    weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
    title: 'Scriptoria',
    description: 'Philological document archive and transcription tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${playfair.variable} ${lora.variable}`}>
        <body className="font-lora antialiased bg-parchment text-ink">{children}</body>
        </html>
    );
}