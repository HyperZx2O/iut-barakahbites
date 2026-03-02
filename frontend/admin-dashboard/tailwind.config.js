/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                steel: '#2D2F33',
                oxford: '#1A1C20',
                amber: '#FF8800',
                foam: '#F5F5F5',
            },
            fontFamily: {
                display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
                body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
                mono: ['"IBM Plex Mono"', 'monospace'],
            },
        },
    },
    plugins: [],
};
