const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'config.json');
const values = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
if (values.outputDir !== undefined && typeof values.outputDir !== 'string') throw new Error('config.json: outputDir must be a string');
module.exports = {output: path.resolve(__dirname, values.outputDir || 'dist'),
  playwrightModule: values.playwrightModule || 'playwright', browserExecutable: values.browserExecutable || undefined};
