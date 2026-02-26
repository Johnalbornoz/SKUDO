#!/usr/bin/env node
/**
 * Limpieza de caché de Vite y compilación.
 * Elimina node_modules/.vite y dist para forzar una nueva generación
 * y evitar referencias fantasma (ej. _dbg) en bundles cacheados.
 * Uso: node scripts/clean-vite-cache.js
 *      npm run clean:vite
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function rmDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true });
  console.log(`  Eliminado: ${path.relative(root, dir)}`);
}

console.log('Limpieza de caché Vite y build...');
rmDirRecursive(path.join(root, 'node_modules', '.vite'));
rmDirRecursive(path.join(root, 'dist'));
console.log('Listo. Ejecuta "npm run dev" o "npm run build" para regenerar.');
