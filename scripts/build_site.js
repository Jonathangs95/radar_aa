const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'demo');
const outputDir = path.join(root, 'dist');

const requiredFiles = [
  path.join(sourceDir, 'index.html'),
  path.join(sourceDir, 'app.js'),
  path.join(sourceDir, 'styles.css'),
  path.join(sourceDir, 'data', 'channel-data.json')
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Arquivo obrigatorio nao encontrado: ${path.relative(root, file)}`);
    process.exit(1);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(sourceDir, outputDir, { recursive: true });

console.log(`Build gerado em ${path.relative(root, outputDir)}`);
console.log('Pronto para publicar no Vercel.');
