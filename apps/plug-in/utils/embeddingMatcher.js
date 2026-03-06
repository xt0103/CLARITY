/**
 * 基于 Embedding 的简历文本匹配
 * 采用 Word2Vec 风格的向量相似度：为每个模板字段构建关键词向量，
 * 对简历文本分块后计算与字段的余弦相似度，将最匹配的文本填入对应字段
 */

/** 字段路径 -> 关键词列表（用于构建 embedding 向量，支持同义词匹配） */
const FIELD_KEYWORDS = {
  'basicInfo.name': ['姓名', '名字', 'name', '姓名：', '名字：', 'Name', '姓名:', '名字:'],
  'basicInfo.phone': ['电话', '手机', 'phone', 'tel', '联系电话', '手机号', '电话：', '手机：', '电话:', '手机:'],
  'basicInfo.email': ['邮箱', '邮件', 'email', 'e-mail', '电子邮箱', '邮箱：', '邮件：', '邮箱:', '邮件:'],
  'basicInfo.wechat': ['微信', 'wechat', '微信号', '微信：', '微信:'],
  'basicInfo.qq': ['QQ', 'qq', 'Qq', 'QQ号', 'QQ：', 'QQ:'],
  'basicInfo.birthDate': ['出生日期', '生日', 'birthday', '出生', '出生年月', '出生日期：'],
  'basicInfo.gender': ['性别', 'gender', 'sex', '性别：', '性别:'],
  'basicInfo.currentCity': ['现居', '居住地', '城市', 'current city', '所在地', '现居城市'],
  'basicInfo.nativePlace': ['籍贯', '户籍地', '籍贯：', '籍贯:'],
  'basicInfo.workYears': ['工作年限', '工作经验', '工作年', '经验', '年限'],
  'basicInfo.idCardNumber': ['身份证', '身份证号', 'id card', '证件号'],
  'basicInfo.mailingAddress': ['地址', '通讯地址', '住址', 'address', '联系地址'],
  'basicInfo.politicalStatus': ['政治面貌', '政治', '党员', '团员'],
  'basicInfo.maritalStatus': ['婚姻状况', '婚姻', '婚姻状态'],
  'basicInfo.specialty': ['特长', '特长爱好', '技能特长'],
  'basicInfo.householdRegistration': ['户籍', '户口', '户口所在地'],
  'basicInfo.ethnicity': ['民族', '民族：', '民族:'],
  'basicInfo.healthStatus': ['健康状况', '健康'],
  'basicInfo.height': ['身高', '身高：', '身高:'],
  'basicInfo.weight': ['体重', '体重：', '体重:'],
  'basicInfo.studentOriginPlace': ['生源地', '生源'],
  'jobIntentionInfo.expectedSalary': ['期望薪资', '期望工资', '薪资要求', '期望待遇'],
  'jobIntentionInfo.expectedCities': ['期望城市', '期望地点', '工作地点', '意向城市'],
  'jobIntentionInfo.availableDate': ['到岗时间', '到岗', '可到岗', '入职时间'],
  'educationList.0.schoolName': ['学校', '院校', '学校名称', '毕业院校', '学校：', '学校:'],
  'educationList.0.collegeName': ['学院', '院系', '学院：', '学院:'],
  'educationList.0.majorName': ['专业', '专业名称', '所学专业', '专业：', '专业:'],
  'educationList.0.degree': ['学历', '学位', '学历层次', '学位：', '学历：', '学历:'],
  'educationList.0.startTime': ['入学时间', '开始时间', '入学', '就读时间'],
  'educationList.0.endTime': ['毕业时间', '结束时间', '毕业', '毕业时间：'],
  'educationList.0.ranking': ['排名', '排名：', '班级排名'],
  'educationList.0.score': ['成绩', 'GPA', '绩点', '成绩：'],
  'workList.0.company': ['公司', '公司名称', '公司：', '工作单位', '单位'],
  'workList.0.department': ['部门', '部门：', '所属部门'],
  'workList.0.position': ['职位', '岗位', '职务', '职位：', '岗位：'],
  'workList.0.startTime': ['入职时间', '开始时间', '工作开始'],
  'workList.0.endTime': ['离职时间', '结束时间', '工作结束'],
  'workList.0.workContent': ['工作内容', '工作描述', '职责描述', '主要工作'],
  'workList.0.workAchievement': ['工作业绩', '业绩', '成果'],
  'projectList.0.projectName': ['项目名称', '项目：', '项目名'],
  'projectList.0.projectContent': ['项目描述', '项目简介', '项目内容'],
  'projectList.0.position': ['项目角色', '角色', '担任'],
  'projectList.0.responsibilities': ['项目职责', '职责', '负责'],
  'projectList.0.achievements': ['项目成果', '成果', '项目成果'],
  'selfEvaluation': ['自我评价', '个人评价', '自我简介', '个人简介'],
  'hobbies': ['兴趣爱好', '爱好', '兴趣', '爱好：', '兴趣：']
};

/** 构建词汇表（所有关键词的并集） */
function buildVocabulary() {
  const vocab = new Map();
  let idx = 0;
  for (const keywords of Object.values(FIELD_KEYWORDS)) {
    for (const kw of keywords) {
      const k = kw.toLowerCase().trim();
      if (!vocab.has(k)) vocab.set(k, idx++);
    }
  }
  return vocab;
}

const VOCAB = buildVocabulary();
const VOCAB_SIZE = VOCAB.size;

/** 将文本转为稀疏向量（词袋 + 字符级 bigram，增强中文匹配） */
function textToVector(text) {
  if (!text || typeof text !== 'string') return new Float32Array(VOCAB_SIZE);
  const vec = new Float32Array(VOCAB_SIZE);
  const t = text.trim();

  // 1) 关键词匹配
  for (const [kw, idx] of VOCAB) {
    if (t.includes(kw) || t.includes(kw.replace(/[：:]/g, ''))) {
      vec[idx] = 1;
    }
  }

  // 2) 字符级 bigram（增强中文语义）
  for (let i = 0; i < t.length - 1; i++) {
    const bigram = t.slice(i, i + 2);
    if (VOCAB.has(bigram)) {
      vec[VOCAB.get(bigram)] += 0.5;
    }
  }

  return vec;
}

/** 余弦相似度 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 从文本片段中提取值（标签后的内容） */
function extractValueFromSegment(segment, label) {
  const s = segment.trim();
  const colon = /[：:]\s*/;
  const parts = s.split(colon);
  if (parts.length >= 2) {
    const afterColon = parts.slice(1).join('：').trim();
    if (afterColon.length > 0 && afterColon.length < 200) return afterColon;
  }
  // 尝试 "标签 值" 格式
  const labelIdx = s.toLowerCase().indexOf(label.toLowerCase());
  if (labelIdx >= 0) {
    const rest = s.slice(labelIdx + label.length).replace(/^[：:\s]+/, '').trim();
    if (rest.length > 0 && rest.length < 200) return rest;
  }
  // 整行作为值（当标签与行高度匹配时）
  return s.replace(label, '').replace(/^[：:\s]+/, '').trim() || s;
}

/** 将简历文本分块（按行、或按常见分隔） */
function chunkText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const chunks = [];
  for (const line of lines) {
    if (line.length > 2 && line.length < 500) chunks.push(line);
  }
  // 合并过短行
  const merged = [];
  let buf = '';
  for (const c of chunks) {
    if (c.length < 15 && buf) {
      buf += ' ' + c;
    } else {
      if (buf) merged.push(buf);
      buf = c;
    }
  }
  if (buf) merged.push(buf);
  return merged.length > 0 ? merged : chunks;
}

/** 使用 embedding 相似度将简历文本匹配到模板字段 */
export function matchResumeToTemplate(resumeText) {
  const chunks = chunkText(resumeText);
  const result = {};
  const usedChunks = new Set();

  const pathList = Object.keys(FIELD_KEYWORDS);

  for (const path of pathList) {
    const keywords = FIELD_KEYWORDS[path];
    const fieldVec = textToVector(keywords.join(' '));

    let bestScore = 0;
    let bestChunk = null;
    let bestLabel = '';

    for (const chunk of chunks) {
      let chunkVec = textToVector(chunk);
      const sim = cosineSimilarity(fieldVec, chunkVec);
      if (sim > bestScore && sim > 0.15) {
        bestScore = sim;
        bestChunk = chunk;
        bestLabel = keywords.find(k => chunk.includes(k) || chunk.includes(k.replace(/[：:]/g, ''))) || keywords[0];
      }
    }

    if (bestChunk && bestScore > 0.15) {
      const value = extractValueFromSegment(bestChunk, bestLabel);
      if (value && value.length > 0 && value.length < 300) {
        result[path] = value;
        usedChunks.add(bestChunk);
      }
    }
  }

  // 补充：用正则提取常见格式（作为 embedding 的补充）
  const fallbacks = extractByRegex(resumeText);
  for (const [path, value] of Object.entries(fallbacks)) {
    if (!result[path] && value) result[path] = value;
  }

  return result;
}

/** 正则兜底提取（邮箱、电话等） */
function extractByRegex(text) {
  const out = {};
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) out['basicInfo.email'] = emailMatch[0];

  const phoneMatch = text.match(/1[3-9]\d{9}|[\d\s\-]{10,14}/);
  if (phoneMatch) out['basicInfo.phone'] = phoneMatch[0].replace(/\s/g, '');

  const wechatMatch = text.match(/微信[：:]\s*([a-zA-Z0-9_-]{6,20})|微信号[：:]\s*([a-zA-Z0-9_-]{6,20})/);
  if (wechatMatch) out['basicInfo.wechat'] = (wechatMatch[1] || wechatMatch[2] || '').trim();

  const qqMatch = text.match(/QQ[：:]\s*(\d{5,12})|qq[：:]\s*(\d{5,12})/i);
  if (qqMatch) out['basicInfo.qq'] = qqMatch[1] || qqMatch[2] || '';

  return out;
}

/** 将 matchResumeToTemplate 的扁平结果转换为嵌套 resumeData 结构 */
export function flatToNestedResume(flat) {
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

  for (const [path, value] of Object.entries(flat)) {
    if (!value || String(value).trim() === '') continue;

    const parts = path.split('.');
    if (parts.length === 2) {
      const [section, key] = parts;
      if (section === 'basicInfo' || section === 'jobIntentionInfo') {
        nested[section][key] = String(value).trim();
      } else if (section === 'hobbies' || section === 'selfEvaluation') {
        nested[section] = String(value).trim();
      }
    } else if (parts.length === 3) {
      const [listKey, idxStr, fieldKey] = parts;
      const idx = parseInt(idxStr, 10);
      if (!Array.isArray(nested[listKey])) nested[listKey] = [];
      while (nested[listKey].length <= idx) nested[listKey].push({});
      nested[listKey][idx][fieldKey] = String(value).trim();
    }
  }

  return nested;
}
