/* =============================================================================
   dished design tokens
   Loaded in <head> right after the Tailwind CDN. It does three jobs so no page
   has to repeat them: pulls in the webfonts, pulls in the Phosphor icon sets,
   and teaches Tailwind the dished palette.
   ========================================================================== */
(function () {
    'use strict';

    function stylesheet(href) {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
    }

    /* Typography: DM Serif Display carried over from the original design for
       every headline, with its sans companion doing the UI work. */
    stylesheet('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=DM+Serif+Display:ital@0;1&display=swap');

    /* Phosphor icons */
    ['regular', 'bold', 'fill', 'duotone'].forEach(function (weight) {
        stylesheet('https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/' + weight + '/style.css');
    });

    var palette = {
        /* The dished green, spread into a usable ramp around #5b8266 */
        sage: {
            50: '#f4f8f5', 100: '#e7f0ea', 200: '#cfe0d5', 300: '#a9c6b4',
            400: '#7ba68d', 500: '#5b8266', 600: '#4a6b53', 700: '#3d5745',
            800: '#334739', 900: '#2c3e35'
        },
        /* The dished cream, #fdfcd7 at the centre */
        cream: {
            50: '#fffef7', 100: '#fdfcd7', 200: '#f7f4c4', 300: '#f0ecb2',
            400: '#e5e0a6', 500: '#e2ded0'
        },
        honey: { 300: '#ffd885', 400: '#f0c05a', 500: '#e0a458' },
        berry: { 400: '#e88a8a', 500: '#e06666', 600: '#c94f4f' },
        ink: '#2c3e35',
        muted: '#5f6f66'
    };

    if (window.tailwind) {
        window.tailwind.config = {
            theme: {
                extend: {
                    colors: palette,
                    fontFamily: {
                        display: ['"DM Serif Display"', 'Georgia', 'serif'],
                        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
                    },
                    boxShadow: {
                        soft: '0 2px 8px rgba(44, 62, 53, 0.06)',
                        card: '0 10px 30px rgba(44, 62, 53, 0.08)',
                        lift: '0 18px 40px rgba(91, 130, 102, 0.20)',
                        glow: '0 10px 25px rgba(91, 130, 102, 0.35)'
                    },
                    borderRadius: { xl2: '20px', xl3: '28px' },
                    keyframes: {
                        'fade-up': {
                            '0%': { opacity: '0', transform: 'translateY(24px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' }
                        },
                        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                        float: {
                            '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
                            '50%': { transform: 'translateY(-12px) rotate(1deg)' }
                        },
                        pop: {
                            '0%': { transform: 'scale(0.94)', opacity: '0' },
                            '100%': { transform: 'scale(1)', opacity: '1' }
                        },
                        'slide-in': {
                            '0%': { transform: 'translateX(24px)', opacity: '0' },
                            '100%': { transform: 'translateX(0)', opacity: '1' }
                        }
                    },
                    animation: {
                        'fade-up': 'fade-up .7s cubic-bezier(.21,.6,.35,1) both',
                        'fade-in': 'fade-in .5s ease both',
                        float: 'float 7s ease-in-out infinite',
                        pop: 'pop .25s cubic-bezier(.21,.6,.35,1) both',
                        'slide-in': 'slide-in .3s ease both'
                    }
                }
            }
        };
    }

    window.DishedPalette = palette;
})();
