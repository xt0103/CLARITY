/**
 * CSV解析工具
 * 支持读取和解析CSV文件
 */

class CSVParser {
  /**
   * 解析CSV文本内容
   * @param {string} csvText - CSV文本内容
   * @returns {Object} 包含headers和rows的对象
   */
  static parse(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // 解析CSV行，处理引号和逗号
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++; // 跳过下一个引号
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  /**
   * 从File对象读取CSV
   * @param {File} file - CSV文件对象
   * @returns {Promise<Object>} 解析后的CSV数据
   */
  static async readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const parsed = this.parse(csvText);
          resolve(parsed);
        } catch (error) {
          reject(new Error('CSV解析失败: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 验证CSV格式
   * @param {Object} csvData - 解析后的CSV数据
   * @returns {Object} {valid: boolean, message: string}
   */
  static validate(csvData) {
    if (!csvData.headers || csvData.headers.length === 0) {
      return { valid: false, message: 'CSV文件必须包含表头' };
    }

    if (csvData.rows.length === 0) {
      return { valid: false, message: 'CSV文件必须包含至少一行数据' };
    }

    return { valid: true, message: 'CSV格式正确' };
  }
}

