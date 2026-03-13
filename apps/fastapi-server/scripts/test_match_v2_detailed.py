"""
详细测试脚本：验证新的匹配算法（关键词+embedding）是否生效
"""
import sys
import os
from pathlib import Path
import json

script_dir = Path(__file__).resolve().parent
fastapi_server_dir = script_dir.parent
sys.path.insert(0, str(fastapi_server_dir))
os.chdir(fastapi_server_dir)

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.time import utcnow
from app.models.job import Job
from app.models.user import User
from app.models.resume_profile import ResumeProfile
from app.match.match_engine_v2 import compute_match_v2

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("=" * 70)
print("测试新的匹配算法（关键词匹配 + Embedding）")
print("=" * 70)

try:
    # 1. 检查岗位是否有分段和embedding数据
    print("\n1️⃣ 检查岗位数据:")
    job = db.scalar(
        select(Job)
        .where(Job.jd_sections_json.is_not(None))
        .where(Job.jd_embeddings_json.is_not(None))
        .limit(1)
    )
    
    if not job:
        print("   ❌ 没有找到有分段和embedding的岗位")
        print("   请先运行: python3 scripts/update_existing_jobs_sections.py")
        sys.exit(1)
    
    print(f"   ✅ 找到岗位: {job.company} - {job.title}")
    print(f"   ✅ 有分段数据: {bool(job.jd_sections_json)}")
    print(f"   ✅ 有embedding数据: {bool(job.jd_embeddings_json)}")
    
    # 解析分段数据
    jd_sections = json.loads(job.jd_sections_json) if job.jd_sections_json else {}
    jd_confidence = json.loads(job.jd_sections_conf_json) if job.jd_sections_conf_json else {}
    print(f"\n   分段详情:")
    for section_name, section_text in jd_sections.items():
        if section_text:
            conf = jd_confidence.get(section_name, 0.0)
            print(f"     - {section_name}: {len(section_text)} 字符, confidence: {conf:.2f}")
    
    # 检查embedding
    jd_embeddings = json.loads(job.jd_embeddings_json) if job.jd_embeddings_json else {}
    print(f"\n   Embedding详情:")
    for section_name, embedding in jd_embeddings.items():
        if embedding:
            print(f"     - {section_name}: {len(embedding)} 维向量")
    
    # 2. 检查简历数据
    print(f"\n2️⃣ 检查简历数据:")
    # 找到有简历的用户
    resume_profile = db.scalar(
        select(ResumeProfile)
        .where(ResumeProfile.cv_sections_json.is_not(None))
        .limit(1)
    )
    
    if not resume_profile:
        print("   ❌ 没有找到有分段数据的简历")
        print("   请先运行: python3 scripts/update_existing_resumes_sections.py")
        sys.exit(1)
    
    user = db.scalar(select(User).where(User.id == resume_profile.user_id))
    
    if not resume_profile:
        print("   ⚠️  用户没有简历，将使用空的简历关键词测试")
        resume_keywords = None
        cv_sections_json = None
        cv_sections_conf_json = None
        cv_embeddings_json = None
    else:
        print(f"   ✅ 找到简历: Resume ID {resume_profile.resume_id}")
        print(f"   ✅ 有分段数据: {bool(resume_profile.cv_sections_json)}")
        print(f"   ✅ 有embedding数据: {bool(resume_profile.cv_embeddings_json)}")
        
        resume_keywords = json.loads(resume_profile.keywords_json) if resume_profile.keywords_json else None
        cv_sections_json = resume_profile.cv_sections_json
        cv_sections_conf_json = resume_profile.cv_sections_conf_json
        cv_embeddings_json = resume_profile.cv_embeddings_json
        
        if cv_sections_json:
            cv_sections = json.loads(cv_sections_json)
            print(f"\n   简历分段详情:")
            for section_name, section_text in cv_sections.items():
                if section_text:
                    print(f"     - {section_name}: {len(section_text)} 字符")
    
    # 3. 调用新的匹配算法
    print(f"\n3️⃣ 调用新的匹配算法 (compute_match_v2)...")
    
    job_keywords = json.loads(job.job_keywords_json) if job.job_keywords_json else {}
    
    result = compute_match_v2(
        resume_keywords=resume_keywords,
        job_keywords=job_keywords,
        jd_sections_json=job.jd_sections_json,
        jd_sections_conf_json=job.jd_sections_conf_json,
        jd_section_keywords_json=job.jd_section_keywords_json,
        jd_embeddings_json=job.jd_embeddings_json,
        cv_sections_json=cv_sections_json,
        cv_sections_conf_json=cv_sections_conf_json,
        cv_embeddings_json=cv_embeddings_json,
    )
    
    # 4. 分析结果
    print(f"\n4️⃣ 匹配结果分析:")
    print(f"   matchScore: {result.match_score}")
    print(f"   keywordScore: {result.keyword_score}")
    print(f"   clusterScore: {result.cluster_score}")
    print(f"   semanticScore: {result.semantic_score}")
    
    # 关键检查：是否有breakdown
    if result.breakdown:
        print(f"\n   ✅ 有分段匹配详情 (breakdown) - 新算法生效！")
        print(f"   分段数量: {len(result.breakdown)}")
        
        for section_name, breakdown in result.breakdown.items():
            print(f"\n   📊 {section_name.upper()}:")
            print(f"      lexicalScore: {breakdown.lexical_score}")
            print(f"      semanticScore: {breakdown.semantic_score}")
            print(f"      sectionScore: {breakdown.section_score}")
            print(f"      confidence: {breakdown.confidence:.2f}")
            
            # 检查是否有语义匹配
            if breakdown.semantic_score is not None:
                print(f"      ✅ 使用了 Embedding 语义匹配！")
            else:
                print(f"      ⚠️  没有语义匹配（可能是embedding缺失）")
            
            # 检查匹配的关键词
            matched_skills = breakdown.matched_keywords.get("skills", [])
            missing_skills = breakdown.missing_keywords.get("skills", [])
            if matched_skills:
                print(f"      匹配的技能: {', '.join(matched_skills[:5])}")
            if missing_skills:
                print(f"      缺失的技能: {', '.join(missing_skills[:5])}")
    else:
        print(f"\n   ⚠️  没有分段匹配详情 - 可能回退到简单匹配算法")
        print(f"   可能原因:")
        print(f"     1. 简历没有分段数据")
        print(f"     2. 岗位没有分段数据")
        print(f"     3. 匹配算法回退到旧版本")
    
    # 5. 验证语义匹配是否真的在工作
    print(f"\n5️⃣ 验证语义匹配:")
    if result.semantic_score is not None:
        print(f"   ✅ semanticScore = {result.semantic_score} - Embedding 匹配在工作！")
    else:
        print(f"   ⚠️  semanticScore = None - 可能没有使用 Embedding")
    
    # 6. 总结
    print(f"\n{'=' * 70}")
    if result.breakdown and result.semantic_score is not None:
        print("✅ 确认：新匹配算法（关键词+Embedding）已生效！")
        print("   - 有分段匹配详情 (breakdown)")
        print("   - 有语义匹配分数 (semanticScore)")
        print("   - 结合了 lexical 和 semantic 匹配")
    elif result.breakdown:
        print("⚠️  部分生效：有分段匹配，但语义匹配可能未使用")
    else:
        print("❌ 新算法未生效：回退到简单匹配算法")
    print(f"{'=' * 70}")
    
finally:
    db.close()
