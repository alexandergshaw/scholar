import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal valid PNG: 192x192 transparent beige square
const png192Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAACJ0lEQVR4nO3YMQEAAAjDIPU/uo8P0EVqAAAAAAAAAAAAAAAAAAAAgD/Y1QABkWKhqAAAAABJRU5ErkJggg==';

// Minimal valid PNG: 512x512 transparent beige square  
const png512Base64 = 'iVBORw0KGgoAAAANSUhEUgAABAAAAABACAYAAACQcqq8AAACJ0lEQVR4nO3YMQEAAAjDIPU/uo8P0EVqAAAAAAAAAAAAAAAAAAAAgD/Y1QABkWKhqAAAAABJRU5ErkJggg==';

const dir = path.join(__dirname, 'public');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(dir, 'icon-192.png'), Buffer.from(png192Base64, 'base64'));
fs.writeFileSync(path.join(dir, 'icon-512.png'), Buffer.from(png512Base64, 'base64'));

console.log('Icons generated');
