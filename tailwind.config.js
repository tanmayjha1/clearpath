/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './App.{js,jsx,ts,tsx}',
        './screens/**/*.{js,jsx,ts,tsx}',
        './components/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                clearpath: {
                    dark: '#0F172A',
                    card: '#1E293B',
                    border: '#334155',
                    emergency: '#EF4444',
                    safe: '#22C55E',
                    info: '#3B82F6',
                },
            },
        },
    },
    plugins: [],
};
