/**
 * 表单字段检测和匹配工具
 * 检测页面中的表单字段并建立映射关系
 */

class FormDetector {
  /**
   * 归一化文本：统一大小写、全角半角、去掉常见标点与多余空白
   * @param {string} input
   * @returns {string}
   */
  static normalizeText(input) {
    if (input === undefined || input === null) return '';
    const text = String(input).trim().toLowerCase();

    // 全角转半角（常见ASCII范围）
    const toHalfWidth = (str) =>
      str.replace(/[\uFF01-\uFF5E]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
      );

    // 将常见标点统一为空格，便于分词
    const normalized = toHalfWidth(text)
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 零宽字符
      .replace(/[：:，,。\.\/\\\-\_\(\)\[\]\{\}<>！？!@#\$%\^&\*\+=\|;'"`~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized;
  }

  /**
   * 将归一化文本分词，并为中文生成简单的双字gram用于模糊匹配
   * @param {string} normalizedText
   * @returns {string[]}
   */
  static tokenize(normalizedText) {
    const t = (normalizedText || '').trim();
    if (!t) return [];

    const parts = t.split(' ').filter(Boolean);

    // 中文无空格时，补充双字gram（如“姓名”->["姓名"]，更长则补充）
    const cjkOnly = /^[\u4e00-\u9fff]+$/.test(t);
    if (cjkOnly && t.length >= 3) {
      const bigrams = [];
      for (let i = 0; i < t.length - 1; i++) {
        bigrams.push(t.slice(i, i + 2));
      }
      return Array.from(new Set([...parts, ...bigrams]));
    }

    return Array.from(new Set(parts));
  }

  /**
   * 从文本中提取“语义键”（如 name/email/phone），用于跨语言同义匹配
   * @param {string} normalizedText
   * @param {Record<string, string[]>} synonymMap
   * @returns {Set<string>}
   */
  static extractSemanticKeys(normalizedText, synonymMap) {
    const keys = new Set();
    if (!normalizedText) return keys;

    for (const [key, synonyms] of Object.entries(synonymMap)) {
      for (const syn of synonyms) {
        const s = this.normalizeText(syn);
        if (!s) continue;
        if (normalizedText.includes(s)) {
          keys.add(key);
          break;
        }
      }
    }
    return keys;
  }

  /**
   * 检测页面中的所有表单字段
   * @returns {Array} 表单字段信息数组
   */
  static detectFormFields() {
    const fields = [];
    const formElements = document.querySelectorAll('input, select, textarea');

    formElements.forEach((element, index) => {
      // 跳过隐藏字段和提交按钮
      if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
        return;
      }

      const fieldInfo = {
        index: index,
        element: element,
        tagName: element.tagName.toLowerCase(),
        type: element.type || 'text',
        name: element.name || '',
        id: element.id || '',
        placeholder: element.placeholder || '',
        label: this.getLabel(element),
        value: element.value || '',
        options: this.getOptions(element),
        required: element.required || false,
        selector: this.generateSelector(element)
      };

      fields.push(fieldInfo);
    });

    return fields;
  }

  /**
   * 获取字段的label文本
   * @param {HTMLElement} element - 表单元素
   * @returns {string} label文本
   */
  static getLabel(element) {
    // 通过id查找label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // 查找父元素中的label
    let parent = element.parentElement;
    while (parent && parent.tagName !== 'BODY') {
      const label = parent.querySelector('label');
      if (label) {
        return label.textContent.trim();
      }
      parent = parent.parentElement;
    }

    // 查找前面的label元素
    let prev = element.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'LABEL') {
        return prev.textContent.trim();
      }
      prev = prev.previousElementSibling;
    }

    return '';
  }

  /**
   * 获取select元素的选项
   * @param {HTMLElement} element - select元素
   * @returns {Array} 选项数组
   */
  static getOptions(element) {
    if (element.tagName.toLowerCase() !== 'select') {
      return [];
    }

    const options = [];
    element.querySelectorAll('option').forEach(option => {
      options.push({
        value: option.value,
        text: option.textContent.trim()
      });
    });

    return options;
  }

  /**
   * 生成元素的唯一选择器
   * @param {HTMLElement} element - 表单元素
   * @returns {string} CSS选择器
   */
  static generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.name) {
      return `[name="${element.name}"]`;
    }
    return `${element.tagName.toLowerCase()}:nth-of-type(${Array.from(element.parentElement.children).indexOf(element) + 1})`;
  }

  /**
   * 自动匹配字段和CSV列名
   * @param {Array} fields - 表单字段数组
   * @param {Array} csvHeaders - CSV表头数组
   * @param {Object} existingMappings - 已存在的映射配置
   * @returns {Object} 字段映射对象
   */
  static autoMatch(fields, csvHeaders, existingMappings = {}) {
    const mappings = { ...existingMappings };
    const usedHeaders = new Set(Object.values(mappings));

    // 关键词匹配表
    const keywordMap = {
      // 个人姓名（中英文同义）
      'name': ['姓名', '名字', 'name', 'full name', 'fullname', 'full_name', 'your name', 'candidate name', 'applicant name'],
      'firstname': ['名', 'firstname', 'first_name', 'given_name'],
      'lastname': ['姓', 'lastname', 'last_name', 'family_name', 'surname'],
      'email': ['邮箱', '邮件', 'email', 'e-mail', 'mail', 'email address', '电子邮箱'],
      'phone': ['电话', '手机', 'phone', 'tel', 'telephone', 'mobile', 'cell', '联系电话'],
      'address': ['地址', 'address', '住址', '居住地址', 'street', 'street address'],
      'city': ['城市', 'city', '市'],
      'province': ['省份', 'province', '省', 'state'],
      'zipcode': ['邮编', 'zipcode', 'zip', 'postal', '邮政编码'],
      'company': ['公司', 'company', '单位', '工作单位'],
      'position': ['职位', 'position', 'job', 'title', '岗位'],
      'education': ['学历', 'education', '教育', '学历背景'],
      'experience': ['经验', 'experience', '工作经验', '工作年限'],
      'birthday': ['生日', 'birthday', 'birth', '出生日期', 'date_of_birth'],
      'gender': ['性别', 'gender', 'sex'],
      'idcard': ['身份证', 'idcard', 'id_card', '身份证号'],
      'website': ['网站', 'website', 'url', '个人网站'],
      'linkedin': ['linkedin', '领英'],
      'github': ['github', 'git'],
      'resume': ['简历', 'resume', 'cv', '个人简历']
    };

    fields.forEach(field => {
      // 如果已有映射，跳过
      if (mappings[field.selector]) {
        return;
      }

      // 收集所有可能的匹配文本
      const matchTextsRaw = [
        field.name || '',
        field.id || '',
        field.placeholder || '',
        field.label || ''
      ].filter(Boolean);

      const matchTexts = matchTextsRaw
        .map(t => this.normalizeText(t))
        .filter(Boolean);

      // 预先提取字段语义键（例如 name/email/phone）
      const fieldSemanticKeys = new Set();
      matchTexts.forEach(t => {
        for (const k of this.extractSemanticKeys(t, keywordMap)) {
          fieldSemanticKeys.add(k);
        }
      });

      // 一些字段类型本身提供额外信号
      const fieldTypeLower = (field.type || '').toLowerCase();
      if (fieldTypeLower === 'email') fieldSemanticKeys.add('email');
      if (fieldTypeLower === 'tel') fieldSemanticKeys.add('phone');

      // 查找最佳匹配
      let bestMatch = null;
      let bestScore = 0;

      csvHeaders.forEach(header => {
        if (usedHeaders.has(header)) {
          return;
        }

        const headerNormalized = this.normalizeText(header);
        if (!headerNormalized) return;

        const headerTokens = new Set(this.tokenize(headerNormalized));
        const headerSemanticKeys = this.extractSemanticKeys(headerNormalized, keywordMap);

        let score = 0;

        // 1) 归一化后的精确/包含匹配（更宽松，兼容 Name / 姓名： / Full-Name 等）
        matchTexts.forEach(text => {
          if (text === headerNormalized) score += 120;
          else if (text.includes(headerNormalized) || headerNormalized.includes(text)) score += 60;
        });

        // 2) 语义键匹配（同义词/跨语言）：例如 “姓名” ↔ “name/Name/Full Name”
        if (fieldSemanticKeys.size > 0 && headerSemanticKeys.size > 0) {
          for (const k of fieldSemanticKeys) {
            if (headerSemanticKeys.has(k)) {
              score += 90;
              break;
            }
          }
        }

        // 3) Token重叠（对“candidate name”、“email address”等更友好）
        matchTexts.forEach(text => {
          const tokens = this.tokenize(text);
          let overlap = 0;
          tokens.forEach(tok => {
            if (!tok) return;
            // 英文 token 太短容易误匹配，稍微过滤
            const isAscii = /^[a-z0-9]+$/.test(tok);
            if (isAscii && tok.length < 3) return;
            if (headerTokens.has(tok)) overlap++;
            else if (headerNormalized.includes(tok)) overlap++; // 兼容未分词的情况
          });
          score += overlap * 18;
        });

        if (score > bestScore) {
          bestScore = score;
          bestMatch = header;
        }
      });

      // 如果找到匹配且分数足够高，建立映射
      if (bestMatch && bestScore >= 30) {
        mappings[field.selector] = bestMatch;
        usedHeaders.add(bestMatch);
      }
    });

    return mappings;
  }

  /**
   * 获取字段的显示名称（用于UI显示）
   * @param {Object} field - 字段信息对象
   * @returns {string} 显示名称
   */
  static getFieldDisplayName(field) {
    if (field.label) return field.label;
    if (field.placeholder) return field.placeholder;
    if (field.name) return field.name;
    if (field.id) return field.id;
    return `${field.tagName} ${field.index + 1}`;
  }
}

