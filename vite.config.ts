import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        port: 3000,
    },
    plugins: [
        react(),
    ],
    build: {
        target: 'es2015',
        minify: true,
        cssCodeSplit: false,
        outDir: 'dist',
    },
    // base: '/escala-lojas/', // Descomente se o repositório não for a raiz do GitHub Pages
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    },
});
