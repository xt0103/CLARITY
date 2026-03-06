/**
 * fill-form 匹配逻辑 - 牛客流程第二步（本地实现，无需后端）
 * 根据 element_dict、simple_fragment、简历数据，输出 xpath→value 映射
 * 参考：牛客 fill-form API（见主仓库 docs/reference）
 */

import { flattenResumeData } from './resumeTemplate.js';

/** 表单 label（含同义词）-> 扁平化表头 的映射 */
const LABEL_TO_HEADER = {
  // 基本信息
  姓名: '姓名',
  名字: '姓名',
  name: '姓名',
  手机号码: '电话',
  手机号: '电话',
  电话: '电话',
  邮箱: '邮箱',
  邮件: '邮箱',
  email: '邮箱',
  个人证件: '身份证号',
  身份证号: '身份证号',
  期望工作地点: '期望城市',
  期望城市: '期望城市',
  现居城市: '现居城市',
  出生日期: '出生日期',
  性别: '性别',
  籍贯: '籍贯',
  通讯地址: '通讯地址',
  地址: '通讯地址',
  内推码: null, // 通常不填
  // 教育经历
  学校名称: '学校',
  学校: '学校',
  学历: '学历',
  学历类型: '学历层次',
  学历层次: '学历层次',
  学院: '学院',
  专业: '专业',
  起止时间: null, // 需根据上下文拆为 startTime/endTime
  开始时间: '教育开始时间',
  结束时间: '教育结束时间',
  导师: '导师',
  实验室: null,
  领域方向: null,
  // 工作/实习经历
  公司名称: '公司',
  公司: '公司',
  职位名称: '职位',
  职位: '职位',
  岗位: '职位',
  部门: '部门',
  描述: null, // 需根据 module 判断：workContent / projectContent
  工作内容: '工作内容',
  工作描述: '工作内容',
  // 项目经历
  项目名称: '项目名称',
  项目角色: '项目角色',
  项目链接: '项目链接',
  项目描述: '项目描述',
  // 作品
  作品链接: '作品链接',
  作品描述: '作品描述',
  // 竞赛
  竞赛名称: '竞赛名称',
  竞赛详情: '竞赛详情',
  // 证书
  证书名称: '证书名称',
  证书描述: '证书描述',
  // 语言能力
  语言: '语言',
  精通程度: '语言熟练度',
  语言熟练度: '语言熟练度',
  // 其他
  自我评价: '自我评价',
};

/** 模块名 -> resumeData 顶层 key */
const MODULE_TO_SECTION = {
  基本信息: 'basicInfo',
  申请信息: 'basicInfo',
  求职意向: 'jobIntentionInfo',
  教育经历: 'educationList',
  实习经历: 'workList',
  工作经历: 'workList',
  项目经历: 'projectList',
  校园经历: 'campusExperienceList',
  作品: 'portfolioList',
  竞赛: 'competitionList',
  竞赛经历: 'competitionList',
  证书: 'certificateList',
  获奖经历: 'awardList',
  语言能力: 'languageAbilityList',
  自我评价: 'selfEvaluation',
  了解渠道: null,
};

/**
 * 从 simple_fragment 解析出字段列表
 * 格式：["模块名", "字段名", "###N@@@模块&&&组号", ...]
 * @param {string[]} simple_fragment
 * @param {Record<string, string>} element_dict
 * @returns {Array<{inputId: string, module: string, label: string, groupNum: number, labelOccurrence: number}>}
 */
function parseSimpleFragment(simple_fragment, element_dict) {
  const fields = [];
  const labelOccurrence = {}; // (module, groupNum, label) -> count
  for (let i = 0; i < simple_fragment.length - 2; i += 3) {
    const moduleName = simple_fragment[i];
    const label = simple_fragment[i + 1].trim();
    const fragmentId = simple_fragment[i + 2];
    const m = fragmentId.match(/^###(\d+)@@@(.+?)&&&(\d+)$/);
    if (!m) continue;
    const [, inputId, , groupNum] = m;
    if (element_dict[inputId]) {
      const key = `${moduleName}|${groupNum}|${label}`;
      labelOccurrence[key] = (labelOccurrence[key] || 0) + 1;
      fields.push({
        inputId: `###${inputId}`,
        module: moduleName,
        label,
        groupNum: parseInt(groupNum, 10),
        labelOccurrence: labelOccurrence[key],
      });
    }
  }
  return fields;
}

/** label -> 扁平表头（含组号后缀，如 学校2）的映射 */
const LABEL_TO_FLAT_KEYS = {
  学校名称: ['学校', '学校2', '学校3', '学校4', '学校5'],
  学校: ['学校', '学校2', '学校3'],
  专业: ['专业', '专业2', '专业3'],
  学历: ['学历', '学历2'],
  学院: ['学院', '学院2'],
  公司名称: ['公司', '公司2', '公司3', '公司4', '公司5'],
  公司: ['公司', '公司2', '公司3'],
  职位名称: ['职位', '职位2', '职位3'],
  职位: ['职位', '职位2', '职位3'],
  项目名称: ['项目名称', '项目名称2', '项目名称3'],
  项目角色: ['项目角色', '项目角色2'],
  项目链接: ['项目链接', '项目链接2'],
  描述: ['工作内容', '工作内容2', '项目描述', '项目描述2'],
  工作内容: ['工作内容', '工作内容2'],
  项目描述: ['项目描述', '项目描述2'],
  起止时间: ['教育开始时间', '教育结束时间', '工作开始时间', '工作结束时间', '项目开始时间', '项目结束时间'],
  开始时间: ['教育开始时间', '工作开始时间', '项目开始时间'],
  结束时间: ['教育结束时间', '工作结束时间', '项目结束时间'],
};

/**
 * 从扁平简历数据中获取字段值
 * flattenResumeData 输出 key 如：姓名、学校、学校2、公司、公司2、工作内容、工作内容2 等
 * @param {number} labelOccurrence - 同一组内相同 label 的第几次出现（1=第一个，用于起止时间区分开始/结束）
 */
function getValueFromFlatResume(flatResume, label, module, groupNum, labelOccurrence = 1) {
  if (!flatResume || typeof flatResume !== 'object') return null;

  const header = LABEL_TO_HEADER[label] || LABEL_TO_HEADER[label?.trim()];
  if (header && flatResume[header] != null && String(flatResume[header]).trim()) {
    return String(flatResume[header]).trim();
  }

  const idx = Math.max(0, groupNum - 1);
  const flatKeys = LABEL_TO_FLAT_KEYS[label];
  if (flatKeys) {
    const key = idx < flatKeys.length ? flatKeys[idx] : flatKeys[0];
    const val = flatResume[key];
    if (val != null && String(val).trim()) return String(val).trim();
    if (idx > 0) {
      const fallback = flatResume[flatKeys[0]];
      if (fallback) return String(fallback).trim();
    }
  }

  if (label === '起止时间') {
    const section = MODULE_TO_SECTION[module];
    const isStart = labelOccurrence === 1;
    if (section === 'educationList' || module?.includes('教育')) {
      const startKey = idx === 0 ? '教育开始时间' : `教育开始时间${idx + 1}`;
      const endKey = idx === 0 ? '教育结束时间' : `教育结束时间${idx + 1}`;
      return flatResume[isStart ? startKey : endKey] || flatResume[startKey] || flatResume[endKey] || null;
    }
    if (section === 'workList' || module?.includes('工作') || module?.includes('实习')) {
      const wStart = idx === 0 ? '工作开始时间' : `工作开始时间${idx + 1}`;
      const wEnd = idx === 0 ? '工作结束时间' : `工作结束时间${idx + 1}`;
      return flatResume[isStart ? wStart : wEnd] || flatResume[wStart] || flatResume[wEnd] || null;
    }
    if (section === 'projectList' || module?.includes('项目')) {
      const pStart = idx === 0 ? '项目开始时间' : `项目开始时间${idx + 1}`;
      const pEnd = idx === 0 ? '项目结束时间' : `项目结束时间${idx + 1}`;
      return flatResume[isStart ? pStart : pEnd] || flatResume[pStart] || flatResume[pEnd] || null;
    }
  }

  if (label === '描述' || label === '工作描述' || label === '项目描述') {
    if (module?.includes('项目')) {
      return flatResume[idx === 0 ? '项目描述' : `项目描述${idx + 1}`] || flatResume['项目职责'] || null;
    }
    return flatResume[idx === 0 ? '工作内容' : `工作内容${idx + 1}`] || null;
  }

  return null;
}

/**
 * 执行 fill-form 匹配（本地逻辑）
 * @param {Object} params
 * @param {Record<string, string>} params.element_dict - id -> xpath
 * @param {string[]} params.simple_fragment - 语义片段
 * @param {Object} params.resumeData - 嵌套简历数据
 * @returns {{ fields: Array<{inputId, xpath, value, label, module}>, identified_count: number, empty_count: number }}
 */
export function matchFillForm({ element_dict, simple_fragment, resumeData }) {
  const flatResume = flattenResumeData(resumeData || {});
  const parsed = parseSimpleFragment(simple_fragment, element_dict);

  const fields = [];
  let identified = 0;
  let empty = 0;

  parsed.forEach(({ inputId, module, label, groupNum, labelOccurrence }) => {
    const xpath = element_dict[inputId.replace('###', '')];
    if (!xpath) return;

    const value = getValueFromFlatResume(flatResume, label, module, groupNum, labelOccurrence);
    if (value != null && String(value).trim()) {
      identified++;
      fields.push({ inputId, xpath, value: String(value).trim(), label, module });
    } else {
      empty++;
      fields.push({ inputId, xpath, value: null, label, module });
    }
  });

  return {
    fields,
    identified_fields_count: identified,
    empty_fields_count: empty,
    total_fields_count: parsed.length,
  };
}
