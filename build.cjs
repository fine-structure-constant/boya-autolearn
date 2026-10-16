const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const {output} = require('./settings.cjs');
fs.mkdirSync(output, {recursive: true});
const header = `// ==UserScript==
// @name         博雅学习浮窗
// @namespace    local.readoor.study-panel
// @version      1.0.0
// @description  当前视频的虚拟进度、单次学习时长与可控上报面板
// @match        https://byyxt.pupedu.cn/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @noframes
// ==/UserScript==
`;
let sources = ['core.js', 'runtime.js', 'panel.js'].map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8'));
sources[0] = sources[0].replace(/^if \(typeof module.*$/m, '');
const bundle = `${header}\n(() => {\n'use strict';\nif (window.__readoorStudyPanelV1) return;\nwindow.__readoorStudyPanelV1 = true;\n${sources.join('\n')}\ncreatePanel();\n})();\n`;
fs.writeFileSync(path.join(output, '博雅学习浮窗.user.js'), bundle);
console.log('Built userscript (' + Buffer.byteLength(bundle) + ' bytes)');
