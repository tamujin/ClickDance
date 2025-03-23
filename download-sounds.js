import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sounds = {
  'pikachu': 'https://assets.mixkit.co/active_storage/sfx/2171/2171-preview.wav',
  'gun': 'https://assets.mixkit.co/active_storage/sfx/1427/1427-preview.wav',
  'pop': 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.wav',
  'laser': 'https://assets.mixkit.co/active_storage/sfx/2741/2741-preview.wav'
};

const downloadSound = (name, url) => {
  const dir = path.join(__dirname, 'public', 'sounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const file = fs.createWriteStream(path.join(dir, `${name}.wav`));
  https.get(url, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${name}.wav`);
    });
  }).on('error', err => {
    fs.unlink(file);
    console.error(`Error downloading ${name}.wav:`, err.message);
  });
};

Object.entries(sounds).forEach(([name, url]) => {
  downloadSound(name, url);
}); 