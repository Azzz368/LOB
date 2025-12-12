import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 解析请求体
    const submission = await req.json();
    
    // 验证必填字段
    if (!submission.author || !submission.lines || submission.lines.length === 0) {
      return new Response('Missing required fields: author and lines', { status: 400 });
    }
    
    // 获取 Blob Store
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
    });
    
    // 生成唯一 ID
    const submissionId = `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const nowIso = new Date().toISOString();
    
    // 添加元数据
    const submissionData = {
      ...submission,
      id: submissionId,
      // 展览模式：提交即发布；管理员仅做事后删除/隐藏
      status: 'approved', // pending, approved, rejected
      submittedAt: nowIso,
      approvedAt: nowIso
    };
    
    // 获取现有的待审核列表
    let submissions = await store.get("submissions", { type: "json" }) || [];
    
    // 添加新提交
    submissions.push(submissionData);
    
    // 同步写入已发布 poems（前端主视觉读取 poems，不改变其接口）
    let poemsData = await store.get("poems", { type: "json" }) || { poems: [], updatedAt: nowIso };
    poemsData.poems = Array.isArray(poemsData.poems) ? poemsData.poems : [];
    
    const newPoem = {
      author: submission.author,
      source: submission.source || '',
      submissionId,
      lines: submission.lines,
      translations: submission.translations || {},
      language: submission.language || 'en',
      hidden: false,
      publishedAt: nowIso
    };
    
    // 新内容优先：插到最前面（也便于 main.js 的“新增优先展示”逻辑）
    poemsData.poems.unshift(newPoem);
    poemsData.updatedAt = nowIso;
    
    // 保存回 Blob Store
    await store.setJSON("submissions", submissions);
    await store.setJSON("poems", poemsData);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Submission received and published',
      id: submissionId,
      published: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (e) {
    console.error('Submit poem error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
};

