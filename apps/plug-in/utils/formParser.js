/**
 * 表单解析器 - 牛客 fill-form 流程第一步
 * 解析招聘网站网申页面，生成 element_dict 和 simple_fragment
 * 参考：牛客 element_dict/simple_fragment 格式（见主仓库 docs/reference）
 */

/**
 * 获取元素的 XPath（相对 body，更稳定）
 * @param {Element} el
 * @returns {string}
 */
function getXPath(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
  const parts = [];
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current === document.body) {
      parts.unshift('body');
      break;
    }
    let part = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current.tagName
      );
      const idx = siblings.indexOf(current) + 1;
      part += `[${idx}]`;
    }
    parts.unshift(part);
    current = parent;
  }
  return '//' + parts.join('/');
}

/**
 * 获取元素的 label 文本（支持多种布局）
 * @param {Element} el
 * @returns {string}
 */
function getLabelText(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.textContent.trim();
  }
  let parent = el.parentElement;
  let depth = 0;
  while (parent && parent !== document.body && depth < 10) {
    const label = parent.querySelector('label');
    if (label && !label.contains(el)) {
      return label.textContent.trim();
    }
    const prev = parent.previousElementSibling;
    if (prev && prev.tagName === 'LABEL') {
      return prev.textContent.trim();
    }
    const title = parent.querySelector('[class*="label"], [class*="title"], [class*="Label"]');
    if (title && !title.contains(el)) {
      const text = title.textContent.trim();
      if (text && text.length < 50) return text;
    }
    parent = parent.parentElement;
    depth++;
  }
  return el.placeholder || el.getAttribute('aria-label') || '';
}

/**
 * 检测当前页面所属平台（用于选择解析策略）
 * @param {string} url
 * @returns {string}
 */
function detectPlatform(url) {
  if (!url) return 'generic';
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('jobs.bytedance.com')) return 'bytedance';
  if (host.includes('moka')) return 'moka';
  if (host.includes('beisen') || host.includes('北森')) return 'beisen';
  if (host.includes('atsx')) return 'atsx';
  if (host.includes('hotjob')) return 'hotjob';
  return 'generic';
}

/**
 * 解析表单结构，提取分组信息（模块名）
 * 通用策略：按 form、section、fieldset 或平台特定 class 分组
 * @param {Document} doc
 * @param {string} platform
 * @returns {Array<{module: string, container: Element}>}
 */
function parseFormGroups(doc, platform) {
  const groups = [];
  const seen = new Set();

  // 尝试常见分组选择器
  const groupSelectors = [
    'section[class*="form"], section[class*="apply"]',
    '[class*="form-module"], [class*="apply-block"]',
    'fieldset',
    '.el-form-item',
    '[class*="form-item"]',
  ];

  const allInputs = doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  if (allInputs.length === 0) return groups;

  allInputs.forEach((el) => {
    let moduleName = '';
    let parent = el.closest('section, fieldset, [class*="module"], [class*="block"], [class*="form-array"], [class*="apply-"]');
    if (parent) {
      const titleEl = parent.querySelector('[class*="title"], [class*="Title"], h2, h3, .blockTitle');
      if (titleEl) {
        moduleName = titleEl.textContent.trim().replace(/[：:]\s*$/, '');
      }
      if (!moduleName && parent.className) {
        const m = String(parent.className).match(/(?:module|block|form)-([a-zA-Z]+)/);
        if (m) moduleName = m[1];
      }
    }
    if (!moduleName) moduleName = '基本信息';
    const key = moduleName + ':' + getXPath(el);
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({ module: moduleName, element: el });
    }
  });

  return groups;
}

/**
 * 推断字段所属组号（同一模块下多组，如多段教育经历）
 * @param {Element} el
 * @param {string} moduleName
 * @returns {number}
 */
function inferGroupIndex(el, moduleName) {
  const arrayCard = el.closest('[class*="array-card"], [class*="form-array"], [class*="repeat"], [data-index]');
  if (arrayCard) {
    const idx = arrayCard.getAttribute('data-index');
    if (idx !== null) return parseInt(idx, 10) + 1;
    const prev = arrayCard.previousElementSibling;
    if (prev && prev.matches?.(`[class*="${moduleName}"], [class*="array"]`)) {
      return 2;
    }
    return 1;
  }
  return 1;
}

/**
 * 解析页面，生成 element_dict 和 simple_fragment
 * 格式参考 fill-form-request.json
 * @returns {{ element_dict: Record<string, string>, simple_fragment: string[] }}
 */
export function parsePageForFillForm() {
  const element_dict = {};
  const simple_fragment = [];
  const moduleGroupCount = {}; // module -> 当前组号

  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
  );

  let inputId = 1;
  const xpathSeen = new Set();

  inputs.forEach((el) => {
    const xpath = getXPath(el);
    if (!xpath || xpathSeen.has(xpath)) return;
    xpathSeen.add(xpath);

    const idKey = String(inputId);
    element_dict[idKey] = xpath;
    inputId++;

    const label = getLabelText(el);
    let moduleName = '基本信息';
    const parent = el.closest('section, fieldset, [class*="module"], [class*="block"], [class*="form-array"], [class*="apply-"]');
    if (parent) {
      const titleEl = parent.querySelector('[class*="title"], [class*="Title"], h2, h3');
      if (titleEl) {
        moduleName = titleEl.textContent.trim().replace(/[：:]\s*$/, '').slice(0, 20) || moduleName;
      }
    }

    const groupNum = inferGroupIndex(el, moduleName);
    if (!moduleGroupCount[moduleName]) moduleGroupCount[moduleName] = 0;
    if (groupNum > moduleGroupCount[moduleName]) moduleGroupCount[moduleName] = groupNum;

    const fragmentId = `###${idKey}@@@${moduleName}&&&${groupNum}`;
    const fieldLabel = label || el.placeholder || el.name || `字段${idKey}`;
    simple_fragment.push(moduleName, fieldLabel, fragmentId);
  });

  return { element_dict, simple_fragment };
}
