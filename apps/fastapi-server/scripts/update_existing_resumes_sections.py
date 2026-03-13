"""
批量更新现有简历的分段和embeddings
"""
import sys
import os
from pathlib import Path

script_dir = Path(__file__).resolve().parent
fastapi_server_dir = script_dir.parent
sys.path.insert(0, str(fastapi_server_dir))
os.chdir(fastapi_server_dir)

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from tqdm import tqdm
import json

from app.core.config import settings
from app.core.time import utcnow
from app.models.resume_profile import ResumeProfile
from app.models.resume import Resume
from app.nlp.cv_segmenter import segment_cv
from app.nlp.keyword_extractor import extract_keywords
from app.nlp.embeddings import generate_section_embeddings, embeddings_to_json

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("=" * 60)
print("更新现有简历的分段和embeddings")
print("=" * 60)

try:
    # 找到需要更新的简历（没有分段数据或分段数据为空）
    resumes_to_update = db.scalars(
        select(ResumeProfile).where(
            (ResumeProfile.cv_sections_json.is_(None)) | (ResumeProfile.cv_sections_json == "")
        )
    ).all()
    
    if not resumes_to_update:
        print("✅ 所有简历都已分段")
        sys.exit(0)
    
    print(f"找到 {len(resumes_to_update)} 个简历需要更新\n")
    
    updated = 0
    failed = 0
    skipped = 0
    
    for i, profile in enumerate(tqdm(resumes_to_update, desc="处理简历")):
        try:
            # 获取简历文本
            if not profile.parsed_text or not profile.parsed_text.strip():
                # 尝试从 Resume 表获取
                resume = db.scalar(select(Resume).where(Resume.id == profile.resume_id))
                if resume and resume.text_content:
                    text = resume.text_content.strip()
                else:
                    skipped += 1
                    continue
            else:
                text = profile.parsed_text.strip()
            
            # 分段 CV
            segments_result = segment_cv(text, sections_json=None)
            cv_sections_json = json.dumps(segments_result["sections"], ensure_ascii=False)
            cv_sections_conf_json = json.dumps(segments_result["confidence"], ensure_ascii=False)
            
            # 生成 embeddings
            section_embeddings = generate_section_embeddings(segments_result["sections"])
            cv_embeddings_json = embeddings_to_json(section_embeddings)
            
            # 更新关键词（如果缺失）
            if not profile.keywords_json:
                kws = extract_keywords(text)
                profile.keywords_json = json.dumps(kws, ensure_ascii=False)
            
            # 更新分段和embeddings
            profile.cv_sections_json = cv_sections_json
            profile.cv_sections_conf_json = cv_sections_conf_json
            profile.cv_embeddings_json = cv_embeddings_json
            profile.cv_sections_updated_at = utcnow()
            profile.updated_at = utcnow()
            
            db.add(profile)
            updated += 1
            
            # 每10个提交一次
            if (i + 1) % 10 == 0:
                db.commit()
                tqdm.write(f"进度: {i+1}/{len(resumes_to_update)} (已更新: {updated}, 失败: {failed}, 跳过: {skipped})")
        
        except Exception as e:
            failed += 1
            tqdm.write(f"错误: 简历 {profile.resume_id}: {e}")
    
    # 最终提交
    db.commit()
    
    print(f"\n{'=' * 60}")
    print("完成:")
    print(f"  已更新: {updated}")
    print(f"  失败: {failed}")
    print(f"  跳过: {skipped}")
    print(f"{'=' * 60}")
    
finally:
    db.close()
