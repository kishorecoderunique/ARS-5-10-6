const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const publicDirectory = path.join(projectRoot, 'public');
const staticDirectories = ['assets', 'login', 'admin', 'rescuer', 'trigger-sos'];

fs.rmSync(publicDirectory, { recursive: true, force: true });
fs.mkdirSync(publicDirectory, { recursive: true });
fs.copyFileSync(
  path.join(projectRoot, 'index.html'),
  path.join(publicDirectory, 'index.html')
);

for (const directory of staticDirectories) {
  const source = path.join(projectRoot, directory);
  if (!fs.existsSync(source)) {
    throw new Error(`Required frontend directory is missing: ${directory}`);
  }
  fs.cpSync(source, path.join(publicDirectory, directory), { recursive: true });
}
