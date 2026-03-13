"""
Test script to verify the new match algorithm is working.
This script calls the API and shows the match result structure.
"""
import sys
import os
from pathlib import Path
import json

# Setup path
script_dir = Path(__file__).resolve().parent
fastapi_server_dir = script_dir.parent
sys.path.insert(0, str(fastapi_server_dir))
os.chdir(fastapi_server_dir)

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.job import Job
from app.models.user import User
from app.models.resume_profile import ResumeProfile
from app.match.match_engine_v2 import compute_match_v2

# Setup database
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    # Find a job with sections
    job = db.scalar(
        select(Job).where(Job.jd_sections_json.is_not(None)).limit(1)
    )
    
    if not job:
        print("❌ 没有找到已分段的岗位，请先运行 update_existing_jobs_sections.py")
        sys.exit(1)
    
    print("=" * 60)
    print("测试新的匹配算法")
    print("=" * 60)
    print(f"\n岗位信息:")
    print(f"  ID: {job.id}")
    print(f"  公司: {job.company}")
    print(f"  标题: {job.title}")
    
    # Find a user with resume
    user = db.scalar(select(User).limit(1))
    if not user:
        print("\n❌ 没有找到用户，请先注册/登录")
        sys.exit(1)
    
    resume_profile = db.scalar(
        select(ResumeProfile).where(ResumeProfile.user_id == user.id).limit(1)
    )
    
    if not resume_profile:
        print(f"\n⚠️  用户 {user.email} 没有简历，将使用空的简历关键词测试")
        resume_keywords = None
        cv_sections_json = None
        cv_sections_conf_json = None
        cv_embeddings_json = None
    else:
        print(f"\n简历信息:")
        print(f"  Resume ID: {resume_profile.resume_id}")
        print(f"  有分段数据: {bool(resume_profile.cv_sections_json)}")
        print(f"  有embeddings: {bool(resume_profile.cv_embeddings_json)}")
        
        resume_keywords = json.loads(resume_profile.keywords_json) if resume_profile.keywords_json else None
        cv_sections_json = resume_profile.cv_sections_json
        cv_sections_conf_json = resume_profile.cv_sections_conf_json
        cv_embeddings_json = resume_profile.cv_embeddings_json
    
    # Get job keywords
    job_keywords = json.loads(job.job_keywords_json) if job.job_keywords_json else {}
    
    print(f"\n{'=' * 60}")
    print("调用新的匹配算法...")
    print(f"{'=' * 60}\n")
    
    # Call new match engine
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
    
    print("✅ 匹配结果:")
    print(f"  matchScore: {result.match_score}")
    print(f"  keywordScore: {result.keyword_score}")
    print(f"  clusterScore: {result.cluster_score}")
    print(f"  semanticScore: {result.semantic_score}")
    print(f"  matchedClusters: {result.matched_clusters}")
    
    if result.breakdown:
        print(f"\n📊 分段匹配详情 (breakdown):")
        for section_name, breakdown in result.breakdown.items():
            print(f"\n  {section_name.upper()}:")
            print(f"    lexicalScore: {breakdown.lexical_score}")
            print(f"    semanticScore: {breakdown.semantic_score}")
            print(f"    sectionScore: {breakdown.section_score}")
            print(f"    confidence: {breakdown.confidence:.2f}")
            print(f"    matchedKeywords: {len(breakdown.matched_keywords.get('skills', []))} skills, "
                  f"{len(breakdown.matched_keywords.get('tools', []))} tools")
            print(f"    missingKeywords: {len(breakdown.missing_keywords.get('skills', []))} skills, "
                  f"{len(breakdown.missing_keywords.get('tools', []))} tools")
    else:
        print(f"\n⚠️  没有分段匹配详情（可能回退到简单匹配）")
    
    print(f"\n{'=' * 60}")
    print("✅ 新匹配算法测试完成！")
    print(f"{'=' * 60}")
    print("\n如果看到 breakdown 和 semanticScore，说明新算法已生效！")
    
finally:
    db.close()
