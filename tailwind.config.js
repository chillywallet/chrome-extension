/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: ['./extension/popup.html', './src/ui/**/*.{html,js,tsx}'],
    theme: {
        extend: {
            container: {
                padding: '16px',
            },
            fontFamily: {
                // Bundled in extension/fonts/ (@font-face in src/ui/pages.css); no remote fetch.
                sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['"Space Grotesk"', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            colors: {
                // Chilly "Frost" palette: navy surfaces, ice-blue accents, coral CTAs.
                primary: '#4AA8DC', // links, active states, borders
                primarydark: '#2E8FC4',
                accent: '#69C4EE', // brighter ice for dark surfaces
                mint: '#7FE8C1', // aurora pair + positive deltas on dark
                coral: '#F58A3C', // reserved for primary call-to-action buttons
                coraldark: '#DD7327',
                ice: '#DCF1FB', // pale ice tint for light-mode chrome
                dark: '#152B40', // navy card surface
                header: '#1E3A54', // raised navy chrome
                darker: '#0F2233', // page background (dark mode)
                darkline: '#2A4159', // hairline on navy
                greenLight: '#10b981',
                greenDark: '#059669',
            },
            screens: {
                popup: { max: '357px' },
            },
        },
    },
    plugins: [],
};
