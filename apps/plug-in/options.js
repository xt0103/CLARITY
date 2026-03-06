/**
 * Options页面逻辑
 * PDF 简历上传（AI 提取）、牛客风格模板表单、字段映射配置、句向量匹配等
 */

import { TEMPLATE_STRUCTURE, flattenResumeData, SELECT_OPTIONS } from './utils/resumeTemplate.js';

/** flatpickr 实例，用于在重新渲染前销毁 */
let flatpickrInstances = [];
import { extractTextFromPdf } from './utils/resumeParser.js';

// DOM元素引用
const pdfFileInput = document.getElementById('pdfFileInput');
const selectPdfButton = document.getElementById('selectPdfButton');
const pdfFileName = document.getElementById('pdfFileName');
const resumeStatus = document.getElementById('resumeStatus');

const resumeTemplateForm = document.getElementById('resumeTemplateForm');
const saveResumeButton = document.getElementById('saveResumeButton');
const resumeSaveStatus = document.getElementById('resumeSaveStatus');

const autoMatchButton = document.getElementById('autoMatchButton');
const clearMappingsButton = document.getElementById('clearMappingsButton');
const mappingStatus = document.getElementById('mappingStatus');
const mappingList = document.getElementById('mappingList');
const matchMethodHint = document.getElementById('matchMethodHint');

const detectFieldsButton = document.getElementById('detectFieldsButton');
const detectedFields = document.getElementById('detectedFields');
const fieldsContainer = document.getElementById('fieldsContainer');

const embeddingApiKey = document.getElementById('embeddingApiKey');
const embeddingBaseUrl = document.getElementById('embeddingBaseUrl');
const embeddingModel = document.getElementById('embeddingModel');
const embeddingEnabled = document.getElementById('embeddingEnabled');
const embeddingStatus = document.getElementById('embeddingStatus');

const aiApiKey = document.getElementById('aiApiKey');
const aiBaseUrl = document.getElementById('aiBaseUrl');
const aiModel = document.getElementById('aiModel');
const aiEnabled = document.getElementById('aiEnabled');
const aiStatus = document.getElementById('aiStatus');

const saveButton = document.getElementById('saveButton');
const exportDataButton = document.getElementById('exportDataButton');
const importDataInput = document.getElementById('importDataInput');
const importDataButton = document.getElementById('importDataButton');
const clearAllButton = document.getElementById('clearAllButton');

// 状态数据
let csvData = [];
let csvHeaders = [];
let fieldMappings = {};
let detectedFormFields = [];
let resumeData = {};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  selectPdfButton.addEventListener('click', () => pdfFileInput.click());
  pdfFileInput.addEventListener('change', handlePdfSelect);
  saveResumeButton.addEventListener('click', handleSaveResume);
  autoMatchButton.addEventListener('click', handleAutoMatch);
  clearMappingsButton.addEventListener('click', handleClearMappings);
  detectFieldsButton.addEventListener('click', handleDetectFields);
  saveButton.addEventListener('click', handleSave);
  exportDataButton.addEventListener('click', handleExportData);
  importDataButton.addEventListener('click', () => importDataInput.click());
  importDataInput.addEventListener('change', handleImportData);
  clearAllButton.addEventListener('click', handleClearAll);

  // 句向量、AI 配置变更时启用保存按钮
  [embeddingApiKey, embeddingBaseUrl, embeddingModel, embeddingEnabled,
   aiApiKey, aiBaseUrl, aiModel, aiEnabled].forEach((el) => {
    if (el) {
      el.addEventListener('change', () => { saveButton.disabled = false; });
      el.addEventListener('input', () => { saveButton.disabled = false; });
    }
  });
}

// 加载存储的数据
async function loadStoredData() {
  try {
    const result = await chrome.storage.local.get([
      'csvData', 'csvHeaders', 'fieldMappings', 'dataSource', 'resumeData',
      'embeddingApiKey', 'embeddingBaseUrl', 'embeddingModel', 'embeddingEnabled',
      'aiApiKey', 'aiBaseUrl', 'aiModel', 'aiEnabled'
    ]);
    csvData = result.csvData || [];
    csvHeaders = result.csvHeaders || [];
    fieldMappings = result.fieldMappings || {};
    resumeData = result.resumeData || {};

    if (embeddingApiKey) embeddingApiKey.value = result.embeddingApiKey || '';
    if (embeddingBaseUrl) embeddingBaseUrl.value = result.embeddingBaseUrl || '';
    if (embeddingModel) embeddingModel.value = result.embeddingModel || '';
    if (embeddingEnabled) embeddingEnabled.checked = result.embeddingEnabled !== false;

    if (aiApiKey) aiApiKey.value = result.aiApiKey || '';
    if (aiBaseUrl) aiBaseUrl.value = result.aiBaseUrl || '';
    if (aiModel) aiModel.value = result.aiModel || '';
    if (aiEnabled) aiEnabled.checked = result.aiEnabled !== false;

    renderTemplateForm(resumeData);
    updateButtons();
  } catch (error) {
    console.error('加载数据失败:', error);
    renderTemplateForm({});
  }
}

// 处理 PDF 上传
async function handlePdfSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  pdfFileName.textContent = file.name;
  pdfFileName.style.color = '#333';

  try {
    showStatus(resumeStatus, '正在解析 PDF...', 'info');

    const resumeText = await extractTextFromPdf(file);
    if (!resumeText || resumeText.length < 10) {
      showStatus(resumeStatus, '未能从 PDF 中提取到有效文本，请检查文件', 'error');
      return;
    }

    const aiConfig = await getAIConfig();
    let flat = {};

    if (aiConfig?.aiApiKey && aiConfig?.aiEnabled) {
      showStatus(resumeStatus, 'AI 正在提取信息...', 'info');
      const result = await chrome.runtime.sendMessage({
        action: 'extractResumeFromText',
        resumeText,
        apiConfig: aiConfig
      });
      if (result?.success && result?.data) {
        flat = result.data;
        showStatus(resumeStatus, 'AI 提取完成，请核对并补充', 'success');
      } else {
        flat = extractResumeFallback(resumeText);
        showStatus(resumeStatus, 'AI 提取失败，已用基础规则提取。请手动补充。', 'warning');
      }
    } else {
      flat = extractResumeFallback(resumeText);
      showStatus(resumeStatus, '未配置 AI，已用基础规则提取。请配置 AI 或手动补充。', 'info');
    }

    const nested = aiFlatToNested(flat);
    resumeData = deepMerge(resumeData, nested);
    renderTemplateForm(resumeData);
    updateButtons();
  } catch (error) {
    console.error('PDF 处理失败:', error);
    showStatus(resumeStatus, '处理失败: ' + error.message, 'error');
  }
}

async function getAIConfig() {
  const result = await chrome.storage.local.get(['aiApiKey', 'aiBaseUrl', 'aiModel', 'aiEnabled']);
  return {
    aiApiKey: result.aiApiKey || '',
    aiBaseUrl: result.aiBaseUrl || '',
    aiModel: result.aiModel || '',
    aiEnabled: result.aiEnabled !== false
  };
}

/** 基础正则提取（无 AI 时的回退） */
function extractResumeFallback(text) {
  const data = {};
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) data['邮箱'] = emailMatch[0];

  const phoneMatch = text.match(/1[3-9]\d{9}|[\d\s\-]{10,14}/);
  if (phoneMatch) data['电话'] = phoneMatch[0].replace(/\s/g, '');

  const nameMatch = text.match(/^(?:姓名|名字|Name)[：:\s]*([^\n\r]+)/im) ||
    text.match(/(?:^|\n)([^\d\s@]{2,4})\s*(?=\d|@|\n)/m);
  if (nameMatch) data['姓名'] = nameMatch[1].trim();

  return Object.keys(data).length > 0 ? data : { '原始文本': text.slice(0, 500) };
}

/** 将 AI 返回的扁平中文键映射为嵌套 resumeData */
function aiFlatToNested(flat) {
  const mapping = {
    '姓名': ['basicInfo', 'name'],
    '名字': ['basicInfo', 'name'],
    '邮箱': ['basicInfo', 'email'],
    '邮件': ['basicInfo', 'email'],
    '电话': ['basicInfo', 'phone'],
    '手机': ['basicInfo', 'phone'],
    '微信': ['basicInfo', 'wechat'],
    'QQ': ['basicInfo', 'qq'],
    '地址': ['basicInfo', 'mailingAddress'],
    '通讯地址': ['basicInfo', 'mailingAddress'],
    '城市': ['basicInfo', 'currentCity'],
    '现居城市': ['basicInfo', 'currentCity'],
    '籍贯': ['basicInfo', 'nativePlace'],
    '出生日期': ['basicInfo', 'birthDate'],
    '生日': ['basicInfo', 'birthDate'],
    '性别': ['basicInfo', 'gender'],
    '教育背景': ['educationList', 0, 'schoolName'],
    '学历': ['educationList', 0, 'degree'],
    '学校': ['educationList', 0, 'schoolName'],
    '专业': ['educationList', 0, 'majorName'],
    '工作经历': ['workList', 0, 'workContent'],
    '公司': ['workList', 0, 'company'],
    '职位': ['workList', 0, 'position'],
    '岗位': ['workList', 0, 'position'],
    '技能': ['basicInfo', 'specialty'],
    '个人网站': ['portfolioList', 0, 'workLink'],
    '自我评价': ['selfEvaluation'],
    '兴趣爱好': ['hobbies']
  };

  const nested = {
    basicInfo: {},
    jobIntentionInfo: {},
    educationList: [],
    workList: [],
    projectList: [],
    campusExperienceList: [],
    computerSkillList: [],
    certificateList: [],
    awardList: [],
    competitionList: [],
    languageAbilityList: [],
    paperList: [],
    patentList: [],
    portfolioList: [],
    familyMemberList: [],
    hobbies: '',
    selfEvaluation: ''
  };

  for (const [aiKey, value] of Object.entries(flat)) {
    if (!value || String(value).trim() === '') continue;
    const path = mapping[aiKey];
    if (!path) continue;

    const val = String(value).trim();
    if (path.length === 1) {
      nested[path[0]] = val;
    } else if (path.length === 2) {
      nested[path[0]][path[1]] = val;
    } else if (path.length === 3) {
      const [listKey, idx, fieldKey] = path;
      while (nested[listKey].length <= idx) nested[listKey].push({});
      nested[listKey][idx][fieldKey] = val;
    }
  }

  return nested;
}

/** 深度合并：nested 覆盖 base，保留 base 中 nested 未提供的值 */
function deepMerge(base, nested) {
  const out = deepClone(base);
  for (const [k, v] of Object.entries(nested)) {
    if (v == null) continue;
    if (Array.isArray(v) && v.length > 0) {
      out[k] = v;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] || {}, v);
    } else if (typeof v === 'string' && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

/** 创建表单项内容（照抄牛客 el-form-item__content 结构） */
function createFieldContent(field, path, value) {
  const type = field.type || 'text';
  const label = field.label || '';

  const content = document.createElement('div');
  content.className = 'el-form-item__content';

  if (type === 'select' && field.optionsKey && SELECT_OPTIONS[field.optionsKey]) {
    const inputWrap = document.createElement('div');
    inputWrap.className = 'input-wrapper';
    const select = document.createElement('select');
    select.dataset.path = path;
    select.className = 'el-input__inner el-select__inner';
    select.style.width = '100%';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `请选择${label}`;
    select.appendChild(placeholder);
    for (const opt of SELECT_OPTIONS[field.optionsKey]) {
      const optEl = document.createElement('option');
      optEl.value = opt;
      optEl.textContent = opt;
      if (value === opt) optEl.selected = true;
      select.appendChild(optEl);
    }
    inputWrap.appendChild(select);
    content.appendChild(inputWrap);
    return content;
  }

  if (type === 'date') {
    const inputWrap = document.createElement('div');
    inputWrap.className = 'input-wrapper';
    const dateWrap = document.createElement('div');
    dateWrap.className = 'date-picker-wrapper';
    const dateEditor = document.createElement('div');
    dateEditor.className = 'el-date-editor el-input el-input--l el-input--prefix el-input--suffix el-date-editor--date';
    dateEditor.style.width = '100%';
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.path = path;
    input.dataset.datepicker = 'true';
    input.value = value || '';
    input.className = 'el-input__inner js-flatpickr-input';
    input.setAttribute('placeholder', `请选择${label}`);
    input.autocomplete = 'off';
    const prefix = document.createElement('span');
    prefix.className = 'el-input__prefix';
    prefix.innerHTML = '<i class="el-input__icon el-icon-date"></i>';
    const suffix = document.createElement('span');
    suffix.className = 'el-input__suffix';
    suffix.innerHTML = '<span class="el-input__suffix-inner"><i class="el-input__icon"></i></span>';
    dateEditor.appendChild(input);
    dateEditor.appendChild(prefix);
    dateEditor.appendChild(suffix);
    dateWrap.appendChild(dateEditor);
    inputWrap.appendChild(dateWrap);
    content.appendChild(inputWrap);
    return content;
  }

  const inputWrap = document.createElement('div');
  inputWrap.className = 'input-wrapper';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `请输入${label}`;
  input.dataset.path = path;
  input.value = value || '';
  input.className = 'el-input__inner';
  input.autocomplete = 'off';
  inputWrap.appendChild(input);
  content.appendChild(inputWrap);
  return content;
}

// 渲染模板表单（照抄牛客 module-card、section-header、el-form-item、array-group 结构）
function renderTemplateForm(data) {
  // 销毁已有的 flatpickr 实例，避免内存泄漏
  flatpickrInstances.forEach((fp) => { try { fp.destroy(); } catch (_) {} });
  flatpickrInstances = [];

  resumeTemplateForm.innerHTML = '';
  const d = deepClone(data);

  for (const [sectionKey, sectionConfig] of Object.entries(TEMPLATE_STRUCTURE)) {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'module-card';
    if (sectionConfig.id) sectionEl.id = sectionConfig.id;

    const header = document.createElement('div');
    header.className = 'section-header';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'section-header__title';
    titleSpan.textContent = sectionConfig.title;
    header.appendChild(titleSpan);
    sectionEl.appendChild(header);

    const custom = document.createElement('div');
    custom.className = 'module-card__custom';

    if (sectionConfig.type === 'textarea') {
      const formItem = document.createElement('div');
      formItem.className = 'el-form-item resume-form-item';
      const lbl = document.createElement('label');
      lbl.className = 'el-form-item__label';
      lbl.textContent = sectionConfig.title;
      const content = document.createElement('div');
      content.className = 'el-form-item__content';
      const inputWrap = document.createElement('div');
      inputWrap.className = 'input-wrapper';
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.placeholder = `请输入${sectionConfig.title}`;
      textarea.dataset.path = sectionKey;
      textarea.className = 'el-input__inner el-textarea__inner';
      textarea.value = (d[sectionKey] && typeof d[sectionKey] === 'string') ? d[sectionKey] : '';
      inputWrap.appendChild(textarea);
      content.appendChild(inputWrap);
      formItem.appendChild(lbl);
      formItem.appendChild(content);
      custom.appendChild(formItem);
    } else if (sectionConfig.fields) {
      sectionConfig.fields.forEach((field) => {
        const { key, label, required } = field;
        const formItem = document.createElement('div');
        formItem.className = 'el-form-item resume-form-item' + (required ? ' is-required' : '');
        const lbl = document.createElement('label');
        lbl.className = 'el-form-item__label';
        lbl.htmlFor = `${sectionKey}.${key}`;
        lbl.textContent = label;
        const content = createFieldContent(field, `${sectionKey}.${key}`, (d[sectionKey] && d[sectionKey][key]) || '');
        formItem.appendChild(lbl);
        formItem.appendChild(content);
        custom.appendChild(formItem);
      });
    } else if (sectionConfig.itemFields) {
      const list = d[sectionKey];
      let arr;
      if (Array.isArray(list) && list.length > 0) {
        arr = list;
      } else {
        // 空数组时显示默认框，并同步到 data，这样点「添加」第一次就能多一个新框
        data[sectionKey] = [{}];
        arr = data[sectionKey];
      }
      arr.forEach((item, idx) => {
        const group = document.createElement('div');
        group.className = 'array-group';
        const groupHead = document.createElement('div');
        groupHead.className = 'array-group__head';
        const indexSpan = document.createElement('span');
        indexSpan.className = 'array-group__index';
        indexSpan.textContent = `${sectionConfig.title} ${idx + 1}`;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'array-group__delete el-button el-button--danger el-button--small';
        removeBtn.textContent = '删除';
        removeBtn.dataset.section = sectionKey;
        removeBtn.dataset.index = String(idx);
        removeBtn.addEventListener('click', () => removeArrayItem(sectionKey, idx));
        groupHead.appendChild(indexSpan);
        groupHead.appendChild(removeBtn);
        group.appendChild(groupHead);

        const fields = document.createElement('div');
        fields.className = 'array-group__fields';
        sectionConfig.itemFields.forEach((field) => {
          const { key, label } = field;
          const formItem = document.createElement('div');
          formItem.className = 'el-form-item resume-form-item';
          const lbl = document.createElement('label');
          lbl.className = 'el-form-item__label';
          lbl.htmlFor = `${sectionKey}.${idx}.${key}`;
          lbl.textContent = label;
          const content = createFieldContent(field, `${sectionKey}.${idx}.${key}`, item[key] || '');
          formItem.appendChild(lbl);
          formItem.appendChild(content);
          fields.appendChild(formItem);
        });
        group.appendChild(fields);
        custom.appendChild(group);
      });
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'el-button el-button--primary el-button--default btn-add-item';
      addBtn.textContent = `+ 添加${sectionConfig.title}`;
      addBtn.dataset.section = sectionKey;
      addBtn.addEventListener('click', () => addArrayItem(sectionKey, sectionConfig));
      custom.appendChild(addBtn);
    }

    sectionEl.appendChild(custom);
    resumeTemplateForm.appendChild(sectionEl);
  }

  initFlatpickrOnDateFields();
  renderResumeNav();
  setupScrollSpy();
}

/** 为所有日期输入初始化 flatpickr 日历 */
function initFlatpickrOnDateFields() {
  if (typeof flatpickr === 'undefined') return;
  const inputs = resumeTemplateForm.querySelectorAll('.js-flatpickr-input');
  inputs.forEach((el) => {
    const fp = flatpickr(el, {
      dateFormat: 'Y-m-d',
      locale: 'zh',
      allowInput: true,
    });
    if (fp) flatpickrInstances.push(fp);
  });
}

function renderResumeNav() {
  const list = document.getElementById('resumeNav');
  if (!list) return;
  list.innerHTML = '';
  for (const [sectionKey, sectionConfig] of Object.entries(TEMPLATE_STRUCTURE)) {
    const id = sectionConfig.id;
    if (!id) continue;
    const item = document.createElement('div');
    item.className = 'module-nav__item';
    const text = document.createElement('span');
    text.className = 'module-nav__text';
    text.dataset.moduleId = id;
    text.textContent = sectionConfig.title;
    text.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    item.appendChild(text);
    list.appendChild(item);
  }
}

/** 牛客风格：滚动时高亮当前模块（module-nav__text--active） */
function setupScrollSpy() {
  const navTexts = document.querySelectorAll('.module-nav__text[data-module-id]');
  if (navTexts.length === 0) return;

  function updateActive() {
    const offset = 100;
    let activeId = null;
    for (const [sectionKey, sectionConfig] of Object.entries(TEMPLATE_STRUCTURE)) {
      const id = sectionConfig.id;
      if (!id) continue;
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= offset) activeId = id;
    }
    if (!activeId && TEMPLATE_STRUCTURE.basicInfo?.id) activeId = TEMPLATE_STRUCTURE.basicInfo.id;
    navTexts.forEach((t) => {
      t.classList.toggle('module-nav__text--active', t.dataset.moduleId === activeId);
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => { updateActive(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  updateActive();
}

function deepClone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const k of Object.keys(obj)) out[k] = deepClone(obj[k]);
  return out;
}

function addArrayItem(sectionKey, sectionConfig) {
  if (!resumeData[sectionKey]) resumeData[sectionKey] = [];
  resumeData[sectionKey].push({});
  renderTemplateForm(resumeData);
}

function removeArrayItem(sectionKey, idx) {
  if (!Array.isArray(resumeData[sectionKey])) return;
  resumeData[sectionKey].splice(idx, 1);
  if (resumeData[sectionKey].length === 0) resumeData[sectionKey] = [];
  renderTemplateForm(resumeData);
}

// 从表单收集数据
function collectTemplateData() {
  const arraySections = [
    'educationList', 'workList', 'projectList', 'campusExperienceList',
    'computerSkillList', 'certificateList', 'awardList', 'competitionList',
    'languageAbilityList', 'paperList', 'patentList', 'portfolioList', 'familyMemberList'
  ];
  const out = {
    basicInfo: {},
    jobIntentionInfo: {},
    hobbies: '',
    selfEvaluation: ''
  };
  arraySections.forEach(k => { out[k] = []; });

  resumeTemplateForm.querySelectorAll('[data-path]').forEach(el => {
    const path = el.dataset.path;
    const val = (el.tagName === 'TEXTAREA' ? el.value : el.value).trim();
    if (!path) return;

    if (path === 'hobbies' || path === 'selfEvaluation') {
      out[path] = val;
      return;
    }

    const parts = path.split('.');
    if (parts.length === 2 && (parts[0] === 'basicInfo' || parts[0] === 'jobIntentionInfo')) {
      out[parts[0]][parts[1]] = val;
    } else if (parts.length === 3 && arraySections.includes(parts[0])) {
      const [listKey, idxStr, fieldKey] = parts;
      const idx = parseInt(idxStr, 10);
      if (!out[listKey][idx]) out[listKey][idx] = {};
      out[listKey][idx][fieldKey] = val;
    }
  });

  arraySections.forEach(k => {
    out[k] = out[k].filter(item => item && Object.values(item).some(v => v && String(v).trim()));
  });

  return out;
}

// 保存简历
async function handleSaveResume() {
  const nested = collectTemplateData();
  const flat = flattenResumeData(nested);
  const keys = Object.keys(flat);

  if (keys.length === 0) {
    showStatus(resumeSaveStatus, '请至少填写一个字段', 'error');
    return;
  }

  csvHeaders = keys;
  csvData = [flat];
  resumeData = nested;

  await chrome.storage.local.set({
    csvData,
    csvHeaders,
    resumeData,
    dataSource: 'resume',
    lastUpdate: new Date().toISOString()
  });

  showStatus(resumeSaveStatus, '简历数据已保存', 'success');
  updateButtons();
  if (detectedFormFields.length > 0) setTimeout(() => handleAutoMatch(), 500);
}

// 处理字段检测
async function handleDetectFields() {
  try {
    detectFieldsButton.disabled = true;
    detectFieldsButton.innerHTML = '<span class="btn-icon">⏳</span> 检测中...';

    const tab = await getTargetTab();
    if (!tab.id) {
      throw new Error('无法获取当前标签页');
    }

    if (isRestrictedUrl(tab.url)) {
      throw new Error('该页面不支持表单检测');
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'detectFields' });
    } catch (error) {
      if (isNoReceiverError(error)) {
        await injectContentScript(tab.id);
        response = await chrome.tabs.sendMessage(tab.id, { action: 'detectFields' });
      } else {
        throw error;
      }
    }

    if (response && response.success) {
      detectedFormFields = response.fields || [];
      displayDetectedFields();
      showStatus(mappingStatus, `检测到 ${detectedFormFields.length} 个表单字段`, 'success');
      updateButtons();

      if (csvHeaders.length > 0) {
        setTimeout(() => handleAutoMatch(), 500);
      }
    } else {
      throw new Error('字段检测失败');
    }
  } catch (error) {
    console.error('检测字段失败:', error);
    showStatus(mappingStatus, '检测失败: ' + error.message, 'error');
  } finally {
    detectFieldsButton.disabled = false;
    detectFieldsButton.innerHTML = '<span class="btn-icon">🔍</span> 检测当前页面表单字段';
    updateButtons();
  }
}

// 显示检测到的字段
function displayDetectedFields() {
  if (detectedFormFields.length === 0) {
    detectedFields.style.display = 'none';
    return;
  }

  detectedFields.style.display = 'block';
  fieldsContainer.innerHTML = '';

  detectedFormFields.forEach(field => {
    const fieldItem = document.createElement('div');
    fieldItem.className = 'field-item';

    const label = document.createElement('div');
    label.className = 'field-item-label';
    label.textContent = window.FormDetector.getFieldDisplayName(field);

    const details = document.createElement('div');
    details.className = 'field-item-details';
    const detailsText = [
      `类型: ${field.type}`,
      field.name ? `名称: ${field.name}` : '',
      field.id ? `ID: ${field.id}` : '',
      field.required ? '必填' : ''
    ].filter(Boolean).join(' | ');
    details.textContent = detailsText;

    fieldItem.appendChild(label);
    fieldItem.appendChild(details);
    fieldsContainer.appendChild(fieldItem);
  });
}

// 处理自动匹配
async function handleAutoMatch() {
  if (detectedFormFields.length === 0 || csvHeaders.length === 0) {
    showStatus(mappingStatus, '请先检测表单字段并保存简历数据', 'error');
    return;
  }

  const embConfig = await getEmbeddingConfig();
  const useEmbedding = embConfig?.embeddingEnabled && embConfig?.embeddingApiKey;

  if (useEmbedding) {
    try {
      autoMatchButton.disabled = true;
      autoMatchButton.innerHTML = '<span class="btn-icon">⏳</span> 句向量匹配中...';
      showStatus(mappingStatus, '正在使用句向量匹配...', 'info');

      const res = await chrome.runtime.sendMessage({
        action: 'autoMatchWithEmbedding',
        fields: detectedFormFields,
        csvHeaders,
        existingMappings: fieldMappings,
        embeddingConfig: {
          apiKey: embConfig.embeddingApiKey,
          baseUrl: embConfig.embeddingBaseUrl || 'https://api.openai.com/v1',
          model: embConfig.embeddingModel || 'text-embedding-3-small'
        }
      });

      if (res?.success && res.mappings) {
        fieldMappings = res.mappings;
        showStatus(mappingStatus, '句向量匹配完成', 'success');
      } else {
        throw new Error(res?.error || '匹配失败');
      }
    } catch (err) {
      console.error('句向量匹配失败，回退到关键词匹配:', err);
      showStatus(mappingStatus, '句向量匹配失败，已用关键词匹配: ' + err.message, 'warning');
      fieldMappings = window.FormDetector.autoMatch(detectedFormFields, csvHeaders, fieldMappings);
    } finally {
      autoMatchButton.disabled = false;
      autoMatchButton.innerHTML = '<span class="btn-icon">🔍</span> 自动匹配';
    }
  } else {
    fieldMappings = window.FormDetector.autoMatch(detectedFormFields, csvHeaders, fieldMappings);
    showStatus(mappingStatus, '关键词匹配完成（未启用句向量）', 'success');
  }

  displayMappings();
  saveButton.disabled = false;
  updateButtons();
}

async function getEmbeddingConfig() {
  const result = await chrome.storage.local.get([
    'embeddingApiKey', 'embeddingBaseUrl', 'embeddingModel', 'embeddingEnabled'
  ]);
  return {
    embeddingApiKey: result.embeddingApiKey || '',
    embeddingBaseUrl: result.embeddingBaseUrl || '',
    embeddingModel: result.embeddingModel || '',
    embeddingEnabled: result.embeddingEnabled !== false
  };
}

// 显示字段映射
function displayMappings() {
  if (detectedFormFields.length === 0) {
    mappingList.innerHTML = '<p class="empty-message">请先检测表单字段</p>';
    return;
  }

  if (csvHeaders.length === 0) {
    mappingList.innerHTML = '<p class="empty-message">请先填写并保存简历数据</p>';
    return;
  }

  mappingList.innerHTML = '';

  detectedFormFields.forEach(field => {
    const mappingItem = document.createElement('div');
    mappingItem.className = 'mapping-item';

    const info = document.createElement('div');
    info.className = 'mapping-item-info';

    const label = document.createElement('div');
    label.className = 'mapping-item-label';
    label.textContent = window.FormDetector.getFieldDisplayName(field);

    const details = document.createElement('div');
    details.className = 'mapping-item-details';
    details.textContent = `${field.type} | ${field.selector}`;

    info.appendChild(label);
    info.appendChild(details);

    const select = document.createElement('select');
    select.className = 'mapping-item-select';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- 不映射 --';
    select.appendChild(emptyOption);

    csvHeaders.forEach(header => {
      const option = document.createElement('option');
      option.value = header;
      option.textContent = header;
      if (fieldMappings[field.selector] === header) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      if (e.target.value) {
        fieldMappings[field.selector] = e.target.value;
      } else {
        delete fieldMappings[field.selector];
      }
      saveButton.disabled = false;
    });

    mappingItem.appendChild(info);
    mappingItem.appendChild(select);
    mappingList.appendChild(mappingItem);
  });
}

// 处理清除映射
function handleClearMappings() {
  if (confirm('确定要清除所有字段映射吗？')) {
    fieldMappings = {};
    displayMappings();
    showStatus(mappingStatus, '已清除所有映射', 'success');
    saveButton.disabled = false;
  }
}

// 处理保存
async function handleSave() {
  try {
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="btn-icon">⏳</span> 保存中...';

    const embeddingConfig = {
      embeddingApiKey: embeddingApiKey ? embeddingApiKey.value.trim() : '',
      embeddingBaseUrl: embeddingBaseUrl ? embeddingBaseUrl.value.trim() : '',
      embeddingModel: embeddingModel ? embeddingModel.value.trim() : '',
      embeddingEnabled: embeddingEnabled ? embeddingEnabled.checked : true
    };
    const aiConfig = {
      aiApiKey: aiApiKey ? aiApiKey.value.trim() : '',
      aiBaseUrl: aiBaseUrl ? aiBaseUrl.value.trim() : '',
      aiModel: aiModel ? aiModel.value.trim() : '',
      aiEnabled: aiEnabled ? aiEnabled.checked : true
    };

    await chrome.storage.local.set({
      fieldMappings: fieldMappings,
      ...embeddingConfig,
      ...aiConfig
    });

    showStatus(mappingStatus, '配置已保存', 'success');
    if (embeddingStatus) showStatus(embeddingStatus, '句向量设置已保存', 'success');
    saveButton.disabled = true;
  } catch (error) {
    console.error('保存失败:', error);
    showStatus(mappingStatus, '保存失败: ' + error.message, 'error');
    saveButton.disabled = false;
  } finally {
    saveButton.innerHTML = '<span class="btn-icon">💾</span> 保存配置';
  }
}

// 导出数据模板（供调试使用）
function handleExportData() {
  const nested = collectTemplateData();
  const hasFormData = Object.keys(nested.basicInfo || {}).length > 0 ||
    (nested.educationList && nested.educationList.length > 0) ||
    Object.keys(nested).some(k => Array.isArray(nested[k]) && nested[k].length > 0);
  const dataToExport = hasFormData ? nested : resumeData;
  const flat = hasFormData ? flattenResumeData(nested) : (csvData[0] || {});
  const headers = Object.keys(flat).length > 0 ? Object.keys(flat) : csvHeaders;

  const exportObj = {
    _meta: {
      exportTime: new Date().toISOString(),
      description: '简历数据模板，可用于插件调试或导入'
    },
    resumeData: dataToExport,
    csvData: [flat],
    csvHeaders: headers,
    fieldMappings: fieldMappings,
    dataSource: 'resume'
  };

  const json = JSON.stringify(exportObj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resume-template-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showStatus(resumeSaveStatus, '已导出数据模板', 'success');
}

// 导入数据模板
async function handleImportData(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    resumeData = data.resumeData || {};
    csvData = Array.isArray(data.csvData) ? data.csvData : (data.csvData ? [data.csvData] : []);
    csvHeaders = data.csvHeaders || (csvData[0] ? Object.keys(csvData[0]) : []);
    if (data.fieldMappings) fieldMappings = data.fieldMappings;

    await chrome.storage.local.set({
      csvData,
      csvHeaders,
      resumeData,
      fieldMappings,
      dataSource: 'resume',
      lastUpdate: new Date().toISOString()
    });

    renderTemplateForm(resumeData);
    updateButtons();
    showStatus(resumeSaveStatus, '已导入数据模板', 'success');
  } catch (err) {
    showStatus(resumeSaveStatus, '导入失败: ' + err.message, 'error');
  }
}

// 处理清除所有数据
async function handleClearAll() {
  if (!confirm('确定要清除所有数据吗？这将删除简历数据和所有映射配置。')) {
    return;
  }

  try {
    await chrome.storage.local.set({
      csvData: null,
      csvHeaders: [],
      resumeData: null,
      fieldMappings: {},
      dataSource: null,
      lastUpdate: null
    });

    csvData = [];
    csvHeaders = [];
    fieldMappings = {};
    detectedFormFields = [];
    resumeData = {};

    pdfFileName.textContent = '未选择文件';
    pdfFileName.style.color = '#666';
    detectedFields.style.display = 'none';
    mappingList.innerHTML = '<p class="empty-message">请先填写个人信息并检测表单字段</p>';

    renderTemplateForm({});
    showStatus(resumeStatus, '已清除所有数据', 'success');
    updateButtons();
  } catch (error) {
    console.error('清除失败:', error);
    showStatus(resumeStatus, '清除失败: ' + error.message, 'error');
  }
}

// 更新按钮状态
function updateButtons() {
  const hasData = csvHeaders.length > 0;
  const hasFields = detectedFormFields.length > 0;

  autoMatchButton.disabled = !(hasData && hasFields);
  clearMappingsButton.disabled = Object.keys(fieldMappings).length === 0;

  if (hasData && hasFields) {
    displayMappings();
  }

  updateMatchMethodHint();
}

async function updateMatchMethodHint() {
  if (!matchMethodHint) return;
  const embConfig = await getEmbeddingConfig();
  if (embConfig?.embeddingEnabled && embConfig?.embeddingApiKey) {
    matchMethodHint.textContent = '（点击自动匹配将使用句向量）';
    matchMethodHint.style.color = '#2e7d32';
  } else {
    matchMethodHint.textContent = '（点击自动匹配将使用关键词）';
    matchMethodHint.style.color = '#999';
  }
}

// 显示状态消息
function showStatus(element, message, type = 'success') {
  if (!element) return;
  element.textContent = message;
  element.className = `status-message ${type} show`;

  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

async function getTargetTab() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(tab => tab.id && !isRestrictedUrl(tab.url));
  if (candidates.length === 0) {
    throw new Error('未找到可检测的网页标签');
  }

  candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return candidates[0];
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('view-source:')
  );
}

function isNoReceiverError(error) {
  if (!error || !error.message) return false;
  return error.message.includes('Receiving end does not exist');
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}
