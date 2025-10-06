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
    
    // 添加元数据
    const submissionData = {
      ...submission,
      id: submissionId,
      status: 'pending', // pending, approved, rejected
      submittedAt: new Date().toISOString()
    };
    
    // 获取现有的待审核列表
    let submissions = await store.get("submissions", { type: "json" }) || [];
    
    // 添加新提交
    submissions.push(submissionData);
    
    // 保存回 Blob Store
    await store.setJSON("submissions", submissions);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Submission received',
      id: submissionId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

