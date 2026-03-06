/**
 * 牛客风格简历模板配置
 * 字段与层级结构参考牛客网简历表单
 */

/** 嵌套路径 -> 扁平化后的中文表头（用于 csvHeaders / 表单匹配） */
export const FLATTEN_MAP = {
  // 基本信息
  'basicInfo.name': '姓名',
  'basicInfo.phone': '电话',
  'basicInfo.email': '邮箱',
  'basicInfo.wechat': '微信',
  'basicInfo.qq': 'QQ',
  'basicInfo.birthDate': '出生日期',
  'basicInfo.gender': '性别',
  'basicInfo.currentCity': '现居城市',
  'basicInfo.nativePlace': '籍贯',
  'basicInfo.workYears': '工作年限',
  'basicInfo.idCardNumber': '身份证号',
  'basicInfo.mailingAddress': '通讯地址',
  'basicInfo.politicalStatus': '政治面貌',
  'basicInfo.maritalStatus': '婚姻状况',
  'basicInfo.emergencyContactName': '紧急联系人',
  'basicInfo.emergencyContactPhone': '紧急联系人电话',
  'basicInfo.specialty': '特长',
  'basicInfo.householdRegistration': '户籍',
  'basicInfo.countryOrRegion': '国家/地区',
  'basicInfo.ethnicity': '民族',
  'basicInfo.healthStatus': '健康状况',
  'basicInfo.height': '身高',
  'basicInfo.weight': '体重',
  'basicInfo.idCardType': '证件类型',
  'basicInfo.studentOriginPlace': '生源地',
  // 求职意向
  'jobIntentionInfo.expectedSalary': '期望薪资',
  'jobIntentionInfo.expectedCities': '期望城市',
  'jobIntentionInfo.availableDate': '到岗时间',
  // 教育经历 (取第一条为主，后续加序号)
  'educationList.0.schoolName': '学校',
  'educationList.0.majorName': '专业',
  'educationList.0.degree': '学历',
  'educationList.0.startTime': '教育开始时间',
  'educationList.0.endTime': '教育结束时间',
  'educationList.0.collegeName': '学院',
  'educationList.0.eduLevel': '学历层次',
  'educationList.0.ranking': '排名',
  'educationList.0.score': '成绩',
  'educationList.0.studyForm': '学习形式',
  'educationList.0.overseasEducation': '海外经历',
  'educationList.0.minorOrDoubleMajor': '辅修/双学位',
  'educationList.0.researchDirection': '研究方向',
  'educationList.0.mentorName': '导师',
  'educationList.0.graduationThesis': '毕业论文',
  'educationList.0.majorCourses': '主修课程',
  // 工作经历
  'workList.0.company': '公司',
  'workList.0.position': '职位',
  'workList.0.startTime': '工作开始时间',
  'workList.0.endTime': '工作结束时间',
  'workList.0.department': '部门',
  'workList.0.jobType': '工作类型',
  'workList.0.workContent': '工作内容',
  'workList.0.workAchievement': '工作业绩',
  'workList.0.salary': '薪资',
  'workList.0.quitReason': '离职原因',
  'workList.0.subordinateCount': '下属人数',
  'workList.0.referenceName': '证明人',
  'workList.0.referenceTitle': '证明人职位',
  'workList.0.referenceContact': '证明人联系方式',
  // 项目经历
  'projectList.0.projectName': '项目名称',
  'projectList.0.startTime': '项目开始时间',
  'projectList.0.endTime': '项目结束时间',
  'projectList.0.position': '项目角色',
  'projectList.0.projectContent': '项目描述',
  'projectList.0.responsibilities': '项目职责',
  'projectList.0.achievements': '项目成果',
  'projectList.0.projectLink': '项目链接',
  // 校园经历
  'campusExperienceList.0.organization': '组织/社团',
  'campusExperienceList.0.position': '职务',
  'campusExperienceList.0.experienceType': '经历类型',
  'campusExperienceList.0.startTime': '校园开始时间',
  'campusExperienceList.0.endTime': '校园结束时间',
  'campusExperienceList.0.workContent': '工作内容',
  // 计算机技能
  'computerSkillList.0.skillType': '技能类型',
  'computerSkillList.0.proficiency': '熟练程度',
  // 证书
  'certificateList.0.certificateName': '证书名称',
  'certificateList.0.certificateNumber': '证书编号',
  'certificateList.0.validTime': '有效期',
  'certificateList.0.certificateDescription': '证书描述',
  // 获奖
  'awardList.0.awardName': '奖项名称',
  'awardList.0.awardLevel': '奖项等级',
  'awardList.0.awardTime': '获奖时间',
  'awardList.0.awardDescription': '奖项描述',
  // 竞赛
  'competitionList.0.competitionName': '竞赛名称',
  'competitionList.0.participationTime': '参与时间',
  'competitionList.0.details': '竞赛详情',
  // 语言能力
  'languageAbilityList.0.language': '语言',
  'languageAbilityList.0.proficiency': '语言熟练度',
  'languageAbilityList.0.englishLevel': '英语等级',
  'languageAbilityList.0.score': '语言成绩',
  'languageAbilityList.0.readingWriting': '读写',
  'languageAbilityList.0.speakingListening': '听说',
  'languageAbilityList.0.certificateName': '语言证书',
  // 论文
  'paperList.0.paperTitle': '论文标题',
  'paperList.0.authors': '作者',
  'paperList.0.journalName': '期刊名称',
  'paperList.0.publishTime': '发表时间',
  'paperList.0.paperDescription': '论文描述',
  'paperList.0.journalLevel': '期刊级别',
  'paperList.0.impactFactor': '影响因子',
  'paperList.0.paperLink': '论文链接',
  // 专利
  'patentList.0.patentName': '专利名称',
  'patentList.0.patentNumber': '专利号',
  'patentList.0.patentType': '专利类型',
  'patentList.0.publishTime': '专利时间',
  'patentList.0.patentAchievement': '专利描述',
  // 作品集
  'portfolioList.0.workName': '作品名称',
  'portfolioList.0.workLink': '作品链接',
  'portfolioList.0.description': '作品描述',
  // 家庭成员
  'familyMemberList.0.relation': '与本人关系',
  'familyMemberList.0.name': '家庭成员姓名',
  'familyMemberList.0.position': '家庭成员职位',
  'familyMemberList.0.company': '家庭成员单位',
  'familyMemberList.0.phone': '家庭成员电话',
  'familyMemberList.0.politicalStatus': '家庭成员政治面貌',
  // 其他
  'hobbies': '兴趣爱好',
  'selfEvaluation': '自我评价'
};

/** 下拉选项（参考牛客） */
export const SELECT_OPTIONS = {
  gender: ['男', '女'],
  degree: ['专科', '本科', '硕士', '博士', '其他'],
  eduLevel: ['高中', '专科', '本科', '硕士', '博士', '其他'],
  studyForm: ['全日制', '非全日制', '自考', '成人教育', '其他'],
  politicalStatus: ['党员', '预备党员', '团员', '群众', '民主党派', '其他'],
  maritalStatus: ['未婚', '已婚', '离异', '丧偶', '其他'],
  ethnicity: ['汉族', '蒙古族', '回族', '藏族', '维吾尔族', '苗族', '彝族', '壮族', '其他'],
  idCardType: ['身份证', '护照', '港澳通行证', '其他'],
  healthStatus: ['良好', '一般', '其他'],
  countryOrRegion: ['中国', '美国', '英国', '日本', '其他'],
  jobType: ['全职', '兼职', '实习', '其他'],
  skillType: ['编程语言', '框架/库', '数据库', '开发工具', '其他'],
  proficiency: ['了解', '熟悉', '精通'],
  experienceType: ['社团', '学生会', '志愿活动', '实习', '其他'],
  overseasEducation: ['是', '否'],
  awardLevel: ['国家级', '省级', '校级', '院级', '其他'],
  patentType: ['发明专利', '实用新型', '外观设计', '其他'],
  relation: ['父亲', '母亲', '配偶', '子女', '兄弟', '姐妹', '其他']
};

/** 模板结构：用于渲染表单 */
export const TEMPLATE_STRUCTURE = {
  basicInfo: {
    title: '基本信息',
    id: 'module-basicInfo',
    fields: [
      { key: 'name', label: '姓名', required: true, type: 'text' },
      { key: 'phone', label: '电话', required: true, type: 'text' },
      { key: 'email', label: '邮箱', required: true, type: 'text' },
      { key: 'wechat', label: '微信', type: 'text' },
      { key: 'qq', label: 'QQ', type: 'text' },
      { key: 'birthDate', label: '出生日期', type: 'date' },
      { key: 'gender', label: '性别', type: 'select', optionsKey: 'gender' },
      { key: 'currentCity', label: '现居城市', type: 'text' },
      { key: 'nativePlace', label: '籍贯', type: 'text' },
      { key: 'workYears', label: '工作年限', type: 'text' },
      { key: 'idCardNumber', label: '身份证号', type: 'text' },
      { key: 'mailingAddress', label: '通讯地址', type: 'text' },
      { key: 'politicalStatus', label: '政治面貌', type: 'select', optionsKey: 'politicalStatus' },
      { key: 'maritalStatus', label: '婚姻状况', type: 'select', optionsKey: 'maritalStatus' },
      { key: 'emergencyContactName', label: '紧急联系人', type: 'text' },
      { key: 'emergencyContactPhone', label: '紧急联系人电话', type: 'text' },
      { key: 'specialty', label: '特长', type: 'text' },
      { key: 'householdRegistration', label: '户籍', type: 'text' },
      { key: 'countryOrRegion', label: '国家/地区', type: 'select', optionsKey: 'countryOrRegion' },
      { key: 'ethnicity', label: '民族', type: 'select', optionsKey: 'ethnicity' },
      { key: 'healthStatus', label: '健康状况', type: 'select', optionsKey: 'healthStatus' },
      { key: 'height', label: '身高', type: 'text' },
      { key: 'weight', label: '体重', type: 'text' },
      { key: 'idCardType', label: '证件类型', type: 'select', optionsKey: 'idCardType' },
      { key: 'studentOriginPlace', label: '生源地', type: 'text' }
    ]
  },
  jobIntentionInfo: {
    title: '求职意向',
    id: 'module-jobIntentionInfo',
    fields: [
      { key: 'expectedSalary', label: '期望薪资', type: 'text' },
      { key: 'expectedCities', label: '期望城市', type: 'text' },
      { key: 'availableDate', label: '到岗时间', type: 'date' }
    ]
  },
  educationList: {
    title: '教育经历',
    id: 'module-educationList',
    itemFields: [
      { key: 'schoolName', label: '学校', type: 'text' },
      { key: 'collegeName', label: '学院', type: 'text' },
      { key: 'majorName', label: '专业', type: 'text' },
      { key: 'degree', label: '学历', type: 'select', optionsKey: 'degree' },
      { key: 'eduLevel', label: '学历层次', type: 'select', optionsKey: 'eduLevel' },
      { key: 'startTime', label: '开始时间', type: 'date' },
      { key: 'endTime', label: '结束时间', type: 'date' },
      { key: 'studyForm', label: '学习形式', type: 'select', optionsKey: 'studyForm' },
      { key: 'overseasEducation', label: '海外经历', type: 'select', optionsKey: 'overseasEducation' },
      { key: 'ranking', label: '排名', type: 'text' },
      { key: 'score', label: '成绩', type: 'text' },
      { key: 'minorOrDoubleMajor', label: '辅修/双学位', type: 'text' },
      { key: 'researchDirection', label: '研究方向', type: 'text' },
      { key: 'mentorName', label: '导师', type: 'text' },
      { key: 'graduationThesis', label: '毕业论文', type: 'text' },
      { key: 'majorCourses', label: '主修课程', type: 'text' }
    ]
  },
  workList: {
    title: '工作经历',
    id: 'module-workList',
    itemFields: [
      { key: 'company', label: '公司', type: 'text' },
      { key: 'department', label: '部门', type: 'text' },
      { key: 'position', label: '职位', type: 'text' },
      { key: 'jobType', label: '工作类型', type: 'select', optionsKey: 'jobType' },
      { key: 'startTime', label: '开始时间', type: 'date' },
      { key: 'endTime', label: '结束时间', type: 'date' },
      { key: 'workContent', label: '工作内容', type: 'text' },
      { key: 'workAchievement', label: '工作业绩', type: 'text' },
      { key: 'salary', label: '薪资', type: 'text' },
      { key: 'quitReason', label: '离职原因' },
      { key: 'subordinateCount', label: '下属人数' },
      { key: 'referenceName', label: '证明人' },
      { key: 'referenceTitle', label: '证明人职位' },
      { key: 'referenceContact', label: '证明人联系方式' }
    ]
  },
  projectList: {
    title: '项目经历',
    id: 'module-projectList',
    itemFields: [
      { key: 'projectName', label: '项目名称', type: 'text' },
      { key: 'position', label: '项目角色', type: 'text' },
      { key: 'startTime', label: '开始时间', type: 'date' },
      { key: 'endTime', label: '结束时间', type: 'date' },
      { key: 'projectContent', label: '项目描述' },
      { key: 'responsibilities', label: '项目职责' },
      { key: 'achievements', label: '项目成果' },
      { key: 'projectLink', label: '项目链接' }
    ]
  },
  campusExperienceList: {
    title: '校园经历',
    id: 'module-campusExperienceList',
    itemFields: [
      { key: 'organization', label: '组织/社团', type: 'text' },
      { key: 'position', label: '职务', type: 'text' },
      { key: 'experienceType', label: '经历类型', type: 'select', optionsKey: 'experienceType' },
      { key: 'startTime', label: '开始时间', type: 'date' },
      { key: 'endTime', label: '结束时间', type: 'date' },
      { key: 'workContent', label: '工作内容', type: 'text' }
    ]
  },
  computerSkillList: {
    title: '计算机技能',
    id: 'module-computerSkillList',
    itemFields: [
      { key: 'skillType', label: '技能类型', type: 'select', optionsKey: 'skillType' },
      { key: 'proficiency', label: '熟练程度', type: 'select', optionsKey: 'proficiency' }
    ]
  },
  certificateList: {
    title: '证书',
    id: 'module-certificateList',
    itemFields: [
      { key: 'certificateName', label: '证书名称' },
      { key: 'certificateNumber', label: '证书编号' },
      { key: 'validTime', label: '有效期' },
      { key: 'certificateDescription', label: '证书描述' }
    ]
  },
  awardList: {
    title: '获奖经历',
    id: 'module-awardList',
    itemFields: [
      { key: 'awardName', label: '奖项名称', type: 'text' },
      { key: 'awardLevel', label: '奖项等级', type: 'select', optionsKey: 'awardLevel' },
      { key: 'awardTime', label: '获奖时间', type: 'date' },
      { key: 'awardDescription', label: '奖项描述', type: 'text' }
    ]
  },
  competitionList: {
    title: '竞赛经历',
    id: 'module-competitionList',
    itemFields: [
      { key: 'competitionName', label: '竞赛名称', type: 'text' },
      { key: 'participationTime', label: '参与时间', type: 'date' },
      { key: 'details', label: '竞赛详情', type: 'text' }
    ]
  },
  languageAbilityList: {
    title: '语言能力',
    id: 'module-languageAbilityList',
    itemFields: [
      { key: 'language', label: '语言', type: 'text' },
      { key: 'proficiency', label: '熟练程度', type: 'select', optionsKey: 'proficiency' },
      { key: 'englishLevel', label: '英语等级' },
      { key: 'score', label: '成绩' },
      { key: 'readingWriting', label: '读写' },
      { key: 'speakingListening', label: '听说' },
      { key: 'certificateName', label: '证书名称' }
    ]
  },
  paperList: {
    title: '论文',
    id: 'module-paperList',
    itemFields: [
      { key: 'paperTitle', label: '论文标题' },
      { key: 'authors', label: '作者' },
      { key: 'journalName', label: '期刊名称' },
      { key: 'publishTime', label: '发表时间' },
      { key: 'paperDescription', label: '论文描述' },
      { key: 'journalLevel', label: '期刊级别' },
      { key: 'impactFactor', label: '影响因子' },
      { key: 'paperLink', label: '论文链接' }
    ]
  },
  patentList: {
    title: '专利',
    id: 'module-patentList',
    itemFields: [
      { key: 'patentName', label: '专利名称', type: 'text' },
      { key: 'patentNumber', label: '专利号', type: 'text' },
      { key: 'patentType', label: '专利类型', type: 'select', optionsKey: 'patentType' },
      { key: 'publishTime', label: '专利时间', type: 'date' },
      { key: 'patentAchievement', label: '专利描述', type: 'text' }
    ]
  },
  portfolioList: {
    title: '作品集',
    id: 'module-portfolioList',
    itemFields: [
      { key: 'workName', label: '作品名称' },
      { key: 'workLink', label: '作品链接' },
      { key: 'description', label: '作品描述' }
    ]
  },
  familyMemberList: {
    title: '家庭成员',
    id: 'module-familyMemberList',
    itemFields: [
      { key: 'relation', label: '与本人关系', type: 'select', optionsKey: 'relation' },
      { key: 'name', label: '姓名', type: 'text' },
      { key: 'position', label: '职位', type: 'text' },
      { key: 'company', label: '单位', type: 'text' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'politicalStatus', label: '政治面貌', type: 'select', optionsKey: 'politicalStatus' }
    ]
  },
  hobbies: { title: '兴趣爱好', type: 'textarea', id: 'module-hobbies' },
  selfEvaluation: { title: '自我评价', type: 'textarea', id: 'module-selfEvaluation' }
};

/** 从路径解析扁平表头（支持数组索引） */
function pathToHeader(path) {
  const direct = FLATTEN_MAP[path];
  if (direct) return direct;
  const match = path.match(/^(.+?)\.(\d+)\.(.+)$/);
  if (match) {
    const [, listPath, idx, field] = match;
    const basePath = `${listPath}.0.${field}`;
    const baseHeader = FLATTEN_MAP[basePath];
    if (baseHeader) {
      const i = parseInt(idx, 10);
      return i === 0 ? baseHeader : `${baseHeader}${i + 1}`;
    }
  }
  return null;
}

/** 从嵌套数据生成扁平对象（用于 csvData 单行） */
export function flattenResumeData(nested) {
  const flat = {};
  if (!nested || typeof nested !== 'object') return flat;

  function setValue(path, value) {
    if (value === undefined || value === null || value === '') return;
    const header = pathToHeader(path) || FLATTEN_MAP[path];
    if (header && String(value).trim()) {
      flat[header] = String(value).trim();
    }
  }

  function walk(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => {
        if (item && typeof item === 'object') {
          Object.entries(item).forEach(([k, v]) => {
            const path = `${prefix}.${i}.${k}`;
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
              walk(v, path);
            } else {
              setValue(path, v);
            }
          });
        }
      });
      return;
    }
    Object.entries(obj).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if (k === 'hobbies' || k === 'selfEvaluation') {
        setValue(k, v);
        return;
      }
      if (typeof v === 'object' && v !== null && Array.isArray(v)) {
        walk(v, path);
      } else if (typeof v === 'object' && v !== null) {
        walk(v, path);
      } else {
        setValue(path, v);
      }
    });
  }

  walk(nested);
  return flat;
}

/** 获取扁平化后的所有可能表头（用于 csvHeaders） */
export function getFlatHeaders() {
  return [...new Set(Object.values(FLATTEN_MAP))];
}
