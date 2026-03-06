/**
 * PDF 简历解析工具
 * 从 PDF 文件中提取文本内容
 */

import * as pdfjsLib from '../lib/pdf.min.mjs';

// 设置 Worker 路径（Chrome 扩展环境）
if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');
}

/**
 * 从 PDF 文件提取文本
 * @param {File} file - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
export async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const textParts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n').trim();
}
