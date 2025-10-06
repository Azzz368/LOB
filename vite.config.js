import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        submit: resolve(__dirname, 'submit.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});

