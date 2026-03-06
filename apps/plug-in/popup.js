/**
 * Popup窗口逻辑
 */

// DOM元素引用
const fieldCountEl = document.getElementById("fieldCount");
const dataStatusEl = document.getElementById("dataStatus");
const matchMethodStatusEl = document.getElementById("matchMethodStatus");
const fillButton = document.getElementById("fillButton");
const refreshButton = document.getElementById("refreshButton");
const resultSection = document.getElementById("resultSection");
const resultMessage = document.getElementById("resultMessage");
const optionsLink = document.getElementById("optionsLink");

let currentFields = [];
let csvData = [];
let csvHeaders = [];
let fieldMappings = {};
let resumeData = {};

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  detectFields();
  setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
  fillButton.addEventListener("click", handleFill);
  refreshButton.addEventListener("click", () => {
    detectFields();
    showResult("已刷新检测", "success");
  });
  optionsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// 加载数据
async function loadData() {
  try {
    const [csvRes, mappingRes, storageRes] = await Promise.all([
      sendMessage({ action: "getCSVData" }),
      sendMessage({ action: "getMappings" }),
      chrome.storage.local.get(["resumeData"]),
    ]);
    if (csvRes?.success) {
      csvData = csvRes.csvData || [];
      csvHeaders = csvRes.csvHeaders || [];
    }
    if (mappingRes?.success) {
      fieldMappings = mappingRes.mappings || {};
    }
    resumeData = storageRes.resumeData || {};
    updateDataStatus();
    updateMatchMethodStatus();
  } catch (error) {
    console.error("加载数据失败:", error);
    dataStatusEl.textContent = "加载失败";
    dataStatusEl.style.color = "#d32f2f";
  }
}

async function updateMatchMethodStatus() {
  if (!matchMethodStatusEl) return;
  const hasResume = resumeData && typeof resumeData === "object" && (
    (resumeData.basicInfo && Object.keys(resumeData.basicInfo).length > 0) ||
    (resumeData.educationList && resumeData.educationList?.length > 0) ||
    (resumeData.workList && resumeData.workList?.length > 0)
  );
  if (hasResume) {
    matchMethodStatusEl.textContent = "牛客流程";
    matchMethodStatusEl.style.color = "#1976d2";
  } else {
    const embConfig = await getEmbeddingConfig();
    if (embConfig?.embeddingEnabled && embConfig?.embeddingApiKey) {
      matchMethodStatusEl.textContent = "句向量";
      matchMethodStatusEl.style.color = "#2e7d32";
    } else {
      matchMethodStatusEl.textContent = "关键词";
      matchMethodStatusEl.style.color = "#666";
    }
  }
}

// 检测表单字段
async function detectFields() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      throw new Error("无法获取当前标签页");
    }

    if (isRestrictedUrl(tab.url)) {
      fieldCountEl.textContent = "该页面不支持";
      fieldCountEl.style.color = "#d32f2f";
      fillButton.disabled = true;
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "detectFields",
      });
    } catch (error) {
      if (isNoReceiverError(error)) {
        await injectContentScript(tab.id);
        response = await chrome.tabs.sendMessage(tab.id, {
          action: "detectFields",
        });
      } else {
        throw error;
      }
    }

    if (response && response.success) {
      currentFields = response.fields || [];
      updateFieldCount();
      updateFillButton();
    } else {
      fieldCountEl.textContent = "检测失败";
      fieldCountEl.style.color = "#d32f2f";
    }
  } catch (error) {
    console.error("检测字段失败:", error);
    fieldCountEl.textContent = "无法访问页面";
    fieldCountEl.style.color = "#d32f2f";
    fillButton.disabled = true;
  }
}

/** 牛客 fill-form 流程：parsePage -> matchFillForm -> fillFormByXpath */
async function runNiuKeFillFlow(tabId) {
  let parseRes;
  try {
    parseRes = await chrome.tabs.sendMessage(tabId, { action: "parsePage" });
  } catch (err) {
    if (isNoReceiverError(err)) {
      await injectContentScript(tabId);
      parseRes = await chrome.tabs.sendMessage(tabId, { action: "parsePage" });
    } else throw err;
  }
  if (!parseRes?.success || !parseRes.element_dict || !parseRes.simple_fragment?.length) {
    return { used: false };
  }

  const { matchFillForm } = await import("./utils/fillFormMatcher.js");
  const matchResult = matchFillForm({
    element_dict: parseRes.element_dict,
    simple_fragment: parseRes.simple_fragment,
    resumeData,
  });
  const allFields = matchResult.fields || [];
  const fieldsToFill = allFields.filter((f) => f.value != null && String(f.value).trim());
  if (allFields.length === 0) return { used: false };

  // 牛客流程：使用 fillFormSequential 逐字段填写，并标红/标绿（含空值字段标红）
  let fillRes;
  try {
    fillRes = await chrome.tabs.sendMessage(tabId, {
      action: "fillFormSequential",
      fields: allFields,
    });
  } catch (err) {
    if (isNoReceiverError(err)) {
      await injectContentScript(tabId);
      fillRes = await chrome.tabs.sendMessage(tabId, {
        action: "fillFormSequential",
        fields: allFields,
      });
    } else throw err;
  }
  return {
    used: true,
    filled: fillRes?.filled ?? 0,
    failed: fillRes?.failed ?? [],
  };
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("devtools://") ||
    url.startsWith("view-source:")
  );
}

function isNoReceiverError(error) {
  if (!error || !error.message) return false;
  return error.message.includes("Receiving end does not exist");
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

// 更新字段计数显示
function updateFieldCount() {
  const count = currentFields.length;
  fieldCountEl.textContent = `${count} 个字段`;
  fieldCountEl.style.color = count > 0 ? "#2e7d32" : "#666";
}

// 更新数据状态显示（优先显示简历数据）
function updateDataStatus() {
  const hasResume = resumeData && typeof resumeData === "object" && (
    (resumeData.basicInfo && Object.keys(resumeData.basicInfo).length > 0) ||
    (resumeData.educationList && resumeData.educationList.length > 0) ||
    (resumeData.workList && resumeData.workList.length > 0)
  );
  if (hasResume) {
    dataStatusEl.textContent = "简历已配置";
    dataStatusEl.style.color = "#2e7d32";
  } else if (csvData.length > 0) {
    dataStatusEl.textContent = `${csvData.length} 条数据`;
    dataStatusEl.style.color = "#2e7d32";
  } else {
    dataStatusEl.textContent = "未配置数据";
    dataStatusEl.style.color = "#d32f2f";
  }
}

// 更新填写按钮状态
function updateFillButton() {
  const hasFields = currentFields.length > 0;
  const hasResume = resumeData && typeof resumeData === "object" && (
    (resumeData.basicInfo && Object.keys(resumeData.basicInfo).length > 0) ||
    (resumeData.educationList && resumeData.educationList?.length > 0) ||
    (resumeData.workList && resumeData.workList?.length > 0)
  );
  const hasData = csvData.length > 0;
  const hasMappings = Object.keys(fieldMappings).length > 0;
  const canAutoMap =
    typeof FormDetector !== "undefined" &&
    hasFields &&
    hasData &&
    Array.isArray(csvHeaders) &&
    csvHeaders.length > 0;

  fillButton.disabled = !(hasFields && (hasResume || hasData) && (hasMappings || canAutoMap || hasResume));
}

// 处理填写操作
async function handleFill() {
  if (fillButton.disabled) return;

  fillButton.disabled = true;
  fillButton.textContent = "填写中...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showResult("无法获取当前标签页", "error");
      return;
    }

    const hasResume = resumeData && typeof resumeData === "object" && (
      (resumeData.basicInfo && Object.keys(resumeData.basicInfo).length > 0) ||
      (resumeData.educationList && resumeData.educationList?.length > 0) ||
      (resumeData.workList && resumeData.workList?.length > 0)
    );

    // 牛客流程：有简历数据时，使用 parsePage -> matchFillForm -> fillFormByXpath
    if (hasResume) {
      const fillResult = await runNiuKeFillFlow(tab.id);
      if (fillResult.used) {
        showResult(
          `牛客流程：成功填写 ${fillResult.filled} 个字段` +
          (fillResult.failed?.length > 0 ? `，${fillResult.failed.length} 个未匹配` : ""),
          fillResult.filled > 0 ? "success" : "warning"
        );
        return;
      }
    }

    // 原有流程：使用“已保存映射 + 自动补全映射”（支持句向量或关键词匹配）
    let mappingsToUse = fieldMappings;
    let matchMethod = "saved"; // 'embedding' | 'keyword' | 'saved'
    if (
      Array.isArray(csvHeaders) &&
      csvHeaders.length > 0 &&
      currentFields.length > 0
    ) {
      const embConfig = await getEmbeddingConfig();
      if (embConfig?.embeddingEnabled && embConfig?.embeddingApiKey) {
        try {
          const res = await sendMessage({
            action: "autoMatchWithEmbedding",
            fields: currentFields,
            csvHeaders,
            existingMappings: fieldMappings || {},
            embeddingConfig: {
              apiKey: embConfig.embeddingApiKey,
              baseUrl:
                embConfig.embeddingBaseUrl || "https://api.openai.com/v1",
              model: embConfig.embeddingModel || "text-embedding-3-small",
            },
          });
          if (res?.success && res.mappings) {
            mappingsToUse = res.mappings;
            matchMethod = "embedding";
          } else {
            mappingsToUse =
              FormDetector?.autoMatch(
                currentFields,
                csvHeaders,
                fieldMappings || {},
              ) || fieldMappings;
            matchMethod = "keyword";
          }
        } catch (e) {
          mappingsToUse =
            FormDetector?.autoMatch(
              currentFields,
              csvHeaders,
              fieldMappings || {},
            ) || fieldMappings;
          matchMethod = "keyword";
        }
      } else if (typeof FormDetector !== "undefined") {
        mappingsToUse = FormDetector.autoMatch(
          currentFields,
          csvHeaders,
          fieldMappings || {},
        );
        matchMethod = "keyword";
      }
    }

    if (!mappingsToUse || Object.keys(mappingsToUse).length === 0) {
      showResult(
        "没有可用的字段映射：请先在设置页自动匹配或手动配置",
        "warning",
      );
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, {
        action: "fillForm",
        fields: currentFields,
        mappings: mappingsToUse,
        csvData: csvData,
        rowIndex: 0,
      });
    } catch (err) {
      if (isNoReceiverError(err)) {
        await injectContentScript(tab.id);
        response = await chrome.tabs.sendMessage(tab.id, {
          action: "fillForm",
          fields: currentFields,
          mappings: mappingsToUse,
          csvData: csvData,
          rowIndex: 0,
        });
      } else {
        throw err;
      }
    }

    let totalFilled = response?.filled ?? 0;
    const unfilledFields = response?.unfilledFields ?? [];

    // 第二轮：若有未填写字段且已配置 AI，调用 AI 判断并补填
    if (unfilledFields.length > 0) {
      const aiConfig = await getAIConfig();
      if (aiConfig?.aiEnabled && aiConfig?.aiApiKey) {
        fillButton.textContent = "AI 判断中...";
        const aiResult = await sendMessage({
          action: "callAIForUnfilledFields",
          unfilledFields,
          csvHeaders,
          csvSampleRow: csvData?.[0] ?? null,
          apiConfig: aiConfig,
        });
        if (
          aiResult?.success &&
          aiResult.mappings &&
          Object.keys(aiResult.mappings).length > 0
        ) {
          let secondResponse;
          try {
            secondResponse = await chrome.tabs.sendMessage(tab.id, {
              action: "fillForm",
              fields: unfilledFields,
              mappings: aiResult.mappings,
              csvData: csvData,
              rowIndex: 0,
            });
          } catch (e) {
            secondResponse = null;
          }
          totalFilled += secondResponse?.filled ?? 0;
        }
      }
    }

    if (response?.success !== false) {
      const methodLabel =
        matchMethod === "embedding"
          ? "句向量匹配"
          : matchMethod === "keyword"
            ? "关键词匹配"
            : "已保存映射";
      showResult(`${methodLabel}，成功填写 ${totalFilled} 个字段`, "success");
      if (response?.errors?.length > 0) {
        console.warn("填写过程中的错误:", response.errors);
      }
    } else {
      const errorMsg =
        response?.errors?.length > 0 ? response.errors.join(", ") : "填写失败";
      showResult(errorMsg, "error");
    }
  } catch (error) {
    console.error("填写失败:", error);
    showResult("填写失败: " + error.message, "error");
  } finally {
    fillButton.disabled = false;
    fillButton.innerHTML = '<span class="btn-icon">✏️</span> 一键填写';
    updateFillButton();
  }
}

async function getAIConfig() {
  const result = await chrome.storage.local.get([
    "aiApiKey",
    "aiBaseUrl",
    "aiModel",
    "aiEnabled",
  ]);
  return {
    aiApiKey: result.aiApiKey || "",
    aiBaseUrl: result.aiBaseUrl || "",
    aiModel: result.aiModel || "",
    aiEnabled: result.aiEnabled !== false,
  };
}

async function getEmbeddingConfig() {
  const result = await chrome.storage.local.get([
    "embeddingApiKey",
    "embeddingBaseUrl",
    "embeddingModel",
    "embeddingEnabled",
  ]);
  return {
    embeddingApiKey: result.embeddingApiKey || "",
    embeddingBaseUrl: result.embeddingBaseUrl || "",
    embeddingModel: result.embeddingModel || "",
    embeddingEnabled: result.embeddingEnabled !== false,
  };
}

// 显示结果消息
function showResult(message, type = "success") {
  resultMessage.textContent = message;
  resultMessage.className = `result-message ${type}`;
  resultSection.style.display = "block";

  // 3秒后自动隐藏成功消息
  if (type === "success") {
    setTimeout(() => {
      resultSection.style.display = "none";
    }, 3000);
  }
}

// 发送消息到background
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// 监听 storage 变化，自动更新数据
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.csvData || changes.csvHeaders || changes.resumeData) {
      loadData();
    }
    if (changes.fieldMappings) {
      fieldMappings = changes.fieldMappings.newValue || {};
      updateFillButton();
    }
    if (changes.embeddingEnabled || changes.embeddingApiKey) {
      updateMatchMethodStatus();
    }
  }
});
