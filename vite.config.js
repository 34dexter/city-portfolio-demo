export default {
    // Relative paths so the build works on GitHub Pages or any sub-folder
    base: './',
    server: {
        host: true,
        open: true
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 3000
    }
}
