/**
 * 表单填写逻辑
 * 根据映射关系填充表单字段
 */

class FormFiller {
  /**
   * 填充表单
   * @param {Array} fields - 表单字段数组
   * @param {Object} mappings - 字段映射对象 {selector: csvHeader}
   * @param {Array} csvData - CSV数据行数组
   * @param {number} rowIndex - 要使用的数据行索引（默认为0）
   * @returns {Object} 填充结果 {success: boolean, filled: number, errors: Array}
   */
  static fillForm(fields, mappings, csvData, rowIndex = 0) {
    const result = {
      success: true,
      filled: 0,
      errors: []
    };

    if (!csvData || csvData.length === 0) {
      result.success = false;
      result.errors.push('没有可用的数据');
      return result;
    }

    if (rowIndex >= csvData.length) {
      result.success = false;
      result.errors.push(`数据行索引 ${rowIndex} 超出范围`);
      return result;
    }

    const dataRow = csvData[rowIndex];

    fields.forEach(field => {
      const csvHeader = mappings[field.selector];
      if (!csvHeader) {
        return; // 没有映射，跳过
      }

      const value = dataRow[csvHeader];
      if (value === undefined || value === null || value === '') {
        return; // 数据为空，跳过
      }

      try {
        const filled = this.fillField(field.element, value, field.type);
        if (filled) {
          result.filled++;
          
          // 触发change事件，确保表单验证和监听器被触发
          this.triggerEvent(field.element, 'input');
          this.triggerEvent(field.element, 'change');
        }
      } catch (error) {
        const fieldName = field.label || field.name || field.id || field.selector;
        result.errors.push(`填充字段 ${fieldName} 失败: ${error.message}`);
      }
    });

    return result;
  }

  /**
   * 填充单个字段
   * @param {HTMLElement} element - 表单元素
   * @param {string} value - 要填充的值
   * @param {string} type - 字段类型
   * @returns {boolean} 是否成功填充
   */
  static fillField(element, value, type) {
    const tagName = element.tagName.toLowerCase();
    const trimmedValue = String(value).trim();

    switch (tagName) {
      case 'input':
        return this.fillInput(element, trimmedValue, type);
      case 'select':
        return this.fillSelect(element, trimmedValue);
      case 'textarea':
        return this.fillTextarea(element, trimmedValue);
      default:
        return false;
    }
  }

  /**
   * 填充input字段
   * @param {HTMLInputElement} element - input元素
   * @param {string} value - 值
   * @param {string} type - input类型
   * @returns {boolean} 是否成功
   */
  static fillInput(element, value, type) {
    switch (type) {
      case 'checkbox':
        // 复选框：如果值为'true', '1', 'yes', 'on'等，则选中
        const shouldCheck = ['true', '1', 'yes', 'on', 'checked'].includes(value.toLowerCase());
        element.checked = shouldCheck;
        return true;

      case 'radio':
        // 单选框：如果值匹配，则选中
        if (element.value === value || element.value.toLowerCase() === value.toLowerCase()) {
          element.checked = true;
          return true;
        }
        return false;

      case 'file':
        // 文件输入不支持程序化设置
        return false;

      default:
        // text, email, tel, number, date等
        element.value = value;
        return true;
    }
  }

  /**
   * 填充select字段
   * @param {HTMLSelectElement} element - select元素
   * @param {string} value - 值
   * @returns {boolean} 是否成功
   */
  static fillSelect(element, value) {
    // 首先尝试精确匹配value
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      if (option.value === value || option.value.toLowerCase() === value.toLowerCase()) {
        element.selectedIndex = i;
        return true;
      }
    }

    // 然后尝试匹配文本内容
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      if (option.textContent.trim() === value || 
          option.textContent.trim().toLowerCase() === value.toLowerCase()) {
        element.selectedIndex = i;
        return true;
      }
    }

    // 部分匹配
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      if (option.textContent.trim().toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(option.textContent.trim().toLowerCase())) {
        element.selectedIndex = i;
        return true;
      }
    }

    return false;
  }

  /**
   * 填充textarea字段
   * @param {HTMLTextAreaElement} element - textarea元素
   * @param {string} value - 值
   * @returns {boolean} 是否成功
   */
  static fillTextarea(element, value) {
    element.value = value;
    return true;
  }

  /**
   * 触发DOM事件
   * @param {HTMLElement} element - 目标元素
   * @param {string} eventType - 事件类型
   */
  static triggerEvent(element, eventType) {
    const event = new Event(eventType, {
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  }

  /**
   * 验证填充结果
   * @param {Array} fields - 表单字段数组
   * @param {Object} mappings - 字段映射对象
   * @param {Array} csvData - CSV数据
   * @returns {Object} 验证结果
   */
  static validateFill(fields, mappings, csvData) {
    const validation = {
      canFill: true,
      warnings: [],
      errors: []
    };

    if (!csvData || csvData.length === 0) {
      validation.canFill = false;
      validation.errors.push('没有可用的CSV数据');
      return validation;
    }

    const mappedFields = fields.filter(f => mappings[f.selector]);
    if (mappedFields.length === 0) {
      validation.canFill = false;
      validation.errors.push('没有配置字段映射关系');
      return validation;
    }

    // 检查必填字段是否有映射
    const requiredFields = fields.filter(f => f.required);
    const unmappedRequired = requiredFields.filter(f => !mappings[f.selector]);
    if (unmappedRequired.length > 0) {
      validation.warnings.push(`有 ${unmappedRequired.length} 个必填字段未配置映射`);
    }

    return validation;
  }
}

