const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

// Create upload and converted folders if not exist
const uploadDir = './uploads';
const convertedDir = './converted';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(convertedDir)) fs.mkdirSync(convertedDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// Clean folders before each upload
function cleanFolder(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      fs.unlinkSync(path.join(dirPath, file));
    });
  }
}

// POST route to upload images
app.post('/convert', upload.array('images', 100), async (req, res) => {
  try {
    cleanFolder(convertedDir);
    const files = req.files;

    for (const file of files) {
      const inputPath = file.path;
      const outputPath = path.join(convertedDir, path.basename(file.originalname, path.extname(file.originalname)) + '.webp');

      await sharp(inputPath)
        .webp({ quality: 80 })
        .toFile(outputPath);
    }

    // Zip the converted images
    const zipPath = path.join(__dirname, 'converted.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, 'converted_images.zip', err => {
        if (err) console.error('Download error:', err);
        fs.unlinkSync(zipPath); // Clean up zip after sending
      });
    });

    archive.on('error', err => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(convertedDir, false);
    await archive.finalize();
  } catch (error) {
    console.error('Error in conversion:', error);
    res.status(500).send('An error occurred while processing images.');
  }
});

// Homepage
app.get('/', (req, res) => {
  res.send(`
    <h2>Image to WebP Converter</h2>
    <form action="/convert" method="POST" enctype="multipart/form-data">
      <input type="file" name="images" multiple accept=".jpg,.jpeg,.png,.webp" />
      <button type="submit">Upload & Convert</button>
    </form>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
