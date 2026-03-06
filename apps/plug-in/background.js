/**
 * 后台服务脚本
 * 处理插件安装、更新和数据管理
 */

// 插件安装或更新时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 首次安装
    console.log("表单自动填写助手已安装");

    // 初始化默认配置
    chrome.storage.local.set({
      csvData: null,
      csvHeaders: [],
      fieldMappings: {},
      lastUpdate: null,
    });
  } else if (details.reason === "update") {
    // 更新
    console.log("表单自动填写助手已更新");
  }
});

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCSVData") {
    // 获取CSV数据
    chrome.storage.local.get(["csvData", "csvHeaders"], (result) => {
      sendResponse({
        success: true,
        csvData: result.csvData || [],
        csvHeaders: result.csvHeaders || [],
      });
    });
    return true; // 异步响应
  }

  if (request.action === "getMappings") {
    // 获取字段映射
    chrome.storage.local.get(["fieldMappings"], (result) => {
      sendResponse({
        success: true,
        mappings: result.fieldMappings || {},
      });
    });
    return true;
  }

  if (request.action === "saveMappings") {
    // 保存字段映射
    chrome.storage.local.set(
      {
        fieldMappings: request.mappings,
      },
      () => {
        sendResponse({ success: true });
      },
    );
    return true;
  }

  if (request.action === "clearData") {
    // 清除数据
    chrome.storage.local.set(
      {
        csvData: null,
        csvHeaders: [],
        fieldMappings: {},
        lastUpdate: null,
      },
      () => {
        sendResponse({ success: true });
      },
    );
    return true;
  }

  if (request.action === "callAIForUnfilledFields") {
    callAIForUnfilledFields(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "extractResumeFromText") {
    extractResumeFromText(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "getEmbeddings") {
    getEmbeddings(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "autoMatchWithEmbedding") {
    autoMatchWithEmbedding(request)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

});

/**
 * 调用 AI API 判断未填写字段与 CSV 列的映射关系
 * @param {Object} request - { unfilledFields, csvHeaders, csvSampleRow, apiConfig }
 * @returns {Promise<{success: boolean, mappings?: Object, error?: string}>}
 */
async function callAIForUnfilledFields(request) {
  const { unfilledFields, csvHeaders, csvSampleRow, apiConfig } = request;
  if (!unfilledFields?.length || !csvHeaders?.length || !apiConfig?.aiApiKey) {
    return { success: false, error: "缺少必要参数或未配置 API Key" };
  }
  if (!apiConfig.aiEnabled) {
    return { success: false, error: "AI 辅助填写已关闭" };
  }

  const baseUrl = (apiConfig.aiBaseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = apiConfig.aiModel || "gpt-4o-mini";

  const fieldsDesc = unfilledFields
    .map((f) => {
      const parts = [
        `selector: "${f.selector}"`,
        f.label && `label: "${f.label}"`,
        f.name && `name: "${f.name}"`,
        f.placeholder && `placeholder: "${f.placeholder}"`,
        f.type && `type: ${f.type}`,
      ].filter(Boolean);
      return `  - { ${parts.join(", ")} }`;
    })
    .join("\n");

  const sampleStr = csvSampleRow
    ? JSON.stringify(csvSampleRow, null, 0).slice(0, 500)
    : "(无示例数据)";

  const prompt = `你是一个表单字段映射助手。以下是一些网页表单中尚未被填写的字段，以及可用的 CSV 列名和第一行数据示例。

【未填写的表单字段】
${fieldsDesc}

【可用的 CSV 列名】
${JSON.stringify(csvHeaders)}

【第一行数据示例】
${sampleStr}

请判断：对于每个未填写的表单字段，是否有某个 CSV 列的数据可以填入？考虑语义等价（如"姓名"与"name"、"Full Name"等价，"邮箱"与"email"、"E-mail"等价等）。

只返回一个 JSON 对象，格式为：{ "mappings": { "字段的selector": "对应的CSV列名" } }
- 只包含你认为可以匹配的字段，不确定的不要写。
- 若没有任何可匹配的，返回 { "mappings": {} }
- 不要返回其他文字，只返回 JSON。`;

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiConfig.aiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { success: false, error: "AI 未返回有效内容" };
  }

  // 尝试解析 JSON（可能被 markdown 代码块包裹）
  let jsonStr = content;
  const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();
  const parsed = JSON.parse(jsonStr);
  const mappings = parsed.mappings || {};

  // 校验：mappings 的 key 必须在 unfilledFields 的 selector 中，value 必须在 csvHeaders 中
  const validSelectors = new Set(unfilledFields.map((f) => f.selector));
  const validHeaders = new Set(csvHeaders);
  const validMappings = {};
  for (const [sel, header] of Object.entries(mappings)) {
    if (validSelectors.has(sel) && validHeaders.has(header)) {
      validMappings[sel] = header;
    }
  }

  return { success: true, mappings: validMappings };
}

/**
 * 使用 AI 从简历文本中提取结构化数据
 * @param {Object} request - { resumeText, apiConfig }
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
async function extractResumeFromText(request) {
  const { resumeText, apiConfig } = request;
  if (!resumeText?.trim() || !apiConfig?.aiApiKey) {
    return { success: false, error: "缺少简历文本或未配置 API Key" };
  }
  if (!apiConfig.aiEnabled) {
    return { success: false, error: "AI 已关闭" };
  }

  const baseUrl = (apiConfig.aiBaseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = apiConfig.aiModel || "gpt-4o-mini";

  const prompt = `你是一个简历解析助手。请从以下简历文本中提取结构化信息。

【简历文本】
${resumeText.slice(0, 8000)}

请提取以下字段（若文本中无则留空）：
- 姓名 (name)
- 邮箱 (email)
- 电话 (phone)
- 地址 (address)
- 城市 (city)
- 教育背景/学历 (education)
- 工作经历/公司 (experience / company)
- 职位 (position)
- 技能 (skills)
- 个人网站/作品集 (website)
- 其他你认为求职表单常用的字段

只返回一个 JSON 对象，键使用中文（如 姓名、邮箱、电话），值为提取到的内容。
重要：所有值必须是纯文本字符串，不要返回对象或数组。例如教育背景、工作经历等应合并为一段文字字符串。
不要返回其他文字，只返回 JSON。
示例格式：{ "姓名": "张三", "邮箱": "zhangsan@example.com", "电话": "13800138000", "教育背景": "XX大学 本科 计算机专业", ... }`;

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiConfig.aiApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { success: false, error: "AI 未返回有效内容" };
  }

  let jsonStr = content;
  const codeMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();
  const parsed = JSON.parse(jsonStr);

  // 调试：在 Service Worker 控制台查看 AI 原始返回（chrome://extensions -> 点击扩展的 Service Worker）
  console.log("[简历解析] AI 原始返回:", JSON.stringify(parsed, null, 2));

  // 过滤空值，并将对象/数组正确序列化为可读字符串
  const result = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!k) continue;
    const str = serializeValueToString(v);
    if (str && str.trim() !== "") {
      result[k] = str.trim();
    }
  }

  console.log("[简历解析] 序列化后:", result);
  return { success: true, data: result };
}

/**
 * 调用 Embedding API 获取句向量
 * 支持 OpenAI 兼容格式：POST /embeddings, body: { input: string[], model }, response: { data: [{ embedding }] }
 * @param {Object} request - { texts: string[], apiConfig: { apiKey, baseUrl?, model? } }
 * @returns {Promise<{ success: boolean, embeddings?: number[][], error?: string }>}
 */
async function getEmbeddings(request) {
  const { texts, apiConfig } = request;
  if (!texts?.length || !apiConfig?.apiKey) {
    return { success: false, error: "缺少文本或 API Key" };
  }

  const baseUrl = (apiConfig.baseUrl || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = apiConfig.model || "text-embedding-3-small";

  const url = `${baseUrl}/embeddings`;
  const body = { input: texts, model };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Embedding API 失败 (${res.status}): ${errText.slice(0, 200)}`,
    );
  }

  const data = await res.json();
  const embeddings = (data.data || []).map((d) => d.embedding).filter(Boolean);

  if (embeddings.length !== texts.length) {
    return {
      success: false,
      error: `返回向量数量(${embeddings.length})与输入(${texts.length})不匹配`,
    };
  }

  return { success: true, embeddings };
}

/**
 * 使用句向量进行表单字段自动匹配
 * @param {Object} request - { fields, csvHeaders, existingMappings, embeddingConfig }
 * @returns {Promise<{ success: boolean, mappings?: Object, error?: string }>}
 */
async function autoMatchWithEmbedding(request) {
  const {
    fields,
    csvHeaders,
    existingMappings = {},
    embeddingConfig,
  } = request;
  if (!fields?.length || !csvHeaders?.length || !embeddingConfig?.apiKey) {
    return { success: false, error: "缺少参数或未配置 Embedding API Key" };
  }

  function getFieldMatchText(field) {
    const parts = [field.label, field.placeholder, field.name, field.id].filter(
      Boolean,
    );
    return parts.join(" ").trim() || `field_${field.index}`;
  }

  const fieldTexts = fields.map(getFieldMatchText);
  const allTexts = [...fieldTexts, ...csvHeaders];

  const embRes = await getEmbeddings({
    texts: allTexts,
    apiConfig: embeddingConfig,
  });
  if (!embRes.success || !embRes.embeddings) {
    return { success: false, error: embRes.error || "获取 embedding 失败" };
  }

  const embeddings = embRes.embeddings;
  const nFields = fields.length;
  const fieldEmbs = embeddings.slice(0, nFields);
  const headerEmbs = embeddings.slice(nFields, nFields + csvHeaders.length);

  function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0,
      nA = 0,
      nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    return nA && nB ? dot / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
  }

  const mappings = { ...existingMappings };
  const usedHeaders = new Set(Object.values(mappings));

  fields.forEach((field, i) => {
    if (mappings[field.selector]) return;
    const fieldVec = fieldEmbs[i];
    let bestScore = 0;
    let bestHeader = null;
    csvHeaders.forEach((header, j) => {
      if (usedHeaders.has(header)) return;
      const sim = cosineSim(fieldVec, headerEmbs[j]);
      if (sim > bestScore && sim > 0.3) {
        bestScore = sim;
        bestHeader = header;
      }
    });
    if (bestHeader) {
      mappings[field.selector] = bestHeader;
      usedHeaders.add(bestHeader);
    }
  });

  return { success: true, mappings };
}

/**
 * 将任意值序列化为可读字符串，避免 [object Object] 问题
 * @param {*} v - AI 可能返回 string、number、object、array
 * @returns {string}
 */
function serializeValueToString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          // 对象：提取所有字符串值拼接
          const vals = Object.values(item).filter(
            (x) => typeof x === "string" && x.trim(),
          );
          return vals.join(" ");
        }
        return String(item);
      })
      .filter(Boolean);
    return parts.join("；");
  }
  if (typeof v === "object") {
    const vals = Object.values(v).filter(
      (x) => typeof x === "string" && x.trim(),
    );
    return vals.join("；");
  }
  return String(v);
}
