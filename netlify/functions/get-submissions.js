import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // 验证管理员权限
  const authHeader = req.headers.get('authorization');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const token = authHeader.substring(7);
  if (token !== adminPassword) {
    return new Response('Invalid password', { status: 403 });
  }

  try {
    // 获取 Blob Store
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
    });
    
    // 获取所有提交
    const submissions = await store.get("submissions", { type: "json" }) || [];
    // 获取已发布诗歌，用于映射 hidden/存在 等状态
    const poemsData = await store.get("poems", { type: "json" }) || { poems: [] };
    const poems = Array.isArray(poemsData.poems) ? poemsData.poems : [];
    const submissionIdToPoem = new Map();
    poems.forEach((poem, idx) => {
      if (poem && poem.submissionId) {
        submissionIdToPoem.set(poem.submissionId, { index: idx, hidden: !!poem.hidden });
      }
    });
    
    // 按状态分类
    const pending = submissions.filter(s => s.status === 'pending');
    const approved = submissions.filter(s => s.status === 'approved');
    const rejected = submissions.filter(s => s.status === 'rejected');
    
    // 为每个 submission 附加发布状态（如果存在）
    const enriched = submissions.map(s => {
      const pub = submissionIdToPoem.get(s.id);
      return {
        ...s,
        published: pub ? { exists: true, hidden: pub.hidden } : { exists: false, hidden: false }
      };
    });

    return new Response(JSON.stringify({
      submissions: enriched,
      stats: {
        total: submissions.length,
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (e) {
    console.error('Get submissions error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

