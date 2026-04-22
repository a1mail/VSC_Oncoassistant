import fs from 'fs';
import archiver from 'archiver';

const output = fs.createWriteStream('diagassist_static_deploy.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Static archive created successfully: ${archive.pointer()} total bytes`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Упаковываем ТОЛЬКО скомпилированный фронтенд (папку dist)
// Внутри архива содержимое папки dist будет лежать в корне архива
archive.directory('dist/', false);

archive.finalize();