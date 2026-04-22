import fs from 'fs';
import archiver from 'archiver';

const output = fs.createWriteStream('diagassist_deploy.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Archive created successfully: ${archive.pointer()} total bytes`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Упаковываем только самое необходимое
archive.directory('dist/', 'dist');
archive.directory('src/', 'src');
archive.file('server.ts', { name: 'server.ts' });
archive.file('start-prod.ts', { name: 'start-prod.ts' });
archive.file('package.json', { name: 'package.json' });
archive.file('package-lock.json', { name: 'package-lock.json' });
archive.file('app.js', { name: 'app.js' });
archive.file('.env.deploy', { name: '.env' });

archive.finalize();