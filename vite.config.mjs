import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const ignoredDirectories = new Set(['node_modules', 'dist', '.git', '.vercel']);

function collectHtmlEntries(rootDirectory, scanDirectory = rootDirectory, discoveredEntries = {}) {
  const directoryEntries = readdirSync(scanDirectory, { withFileTypes: true });

  for (const directoryEntry of directoryEntries) {
    const fullPath = resolve(scanDirectory, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      if (!ignoredDirectories.has(directoryEntry.name)) {
        collectHtmlEntries(rootDirectory, fullPath, discoveredEntries);
      }
      continue;
    }

    if (!directoryEntry.isFile() || directoryEntry.name !== 'index.html') {
      continue;
    }

    const relativePath = relative(rootDirectory, fullPath);
    
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');

    const entryKey = normalizedRelativePath === 'index.html'
      ? 'main'
      : normalizedRelativePath
        .replace('/index.html', '')
        .replace(/[^a-zA-Z0-9/_-]/g, '-')
        .replace(/\//g, '_');

    discoveredEntries[entryKey] = fullPath;
  }

  return discoveredEntries;
}

export default defineConfig({
  appType: 'mpa',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: collectHtmlEntries(currentDirectory)
    }
  }
});