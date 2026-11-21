// Construye ../simulador.html: un solo archivo con el JavaScript (three.js incluido), los estilos y las fuentes.
//
//   cd prototipos/P08-seguidor-linea/avance-01-simulador-3d/codigo
//   npm install --no-save three@0.187.0 esbuild      # una sola vez (o apunta NODE_PATH a una carpeta con ambos)
//   node construir.mjs
//
// Solo hace falta para regenerar simulador.html; el simulador ya publicado funciona sin Node.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const aqui = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let esbuild;
try {
  esbuild = require(process.env.NODE_PATH ? join(process.env.NODE_PATH.split(':')[0], 'esbuild') : 'esbuild');
} catch {
  console.error('Falta esbuild y three: ejecuta "npm install --no-save three@0.187.0 esbuild" en esta carpeta.');
  process.exit(1);
}

const r = await esbuild.build({
  entryPoints: [join(aqui, 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  write: false,
  legalComments: 'none',
  nodePaths: process.env.NODE_PATH ? process.env.NODE_PATH.split(':') : [],
  absWorkingDir: aqui,
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(aqui, 'fuentes.css'), 'utf8') + readFileSync(join(aqui, 'style.css'), 'utf8');
const html = readFileSync(join(aqui, 'plantilla.html'), 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
const salida = join(aqui, '..', 'simulador.html');
writeFileSync(salida, html);
console.log(`simulador.html: ${(html.length / 1024).toFixed(0)} KB`);
