import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

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
    const { submissionId, action } = await req.json();
    
    if (!submissionId || !action || !['approve', 'reject', 'hide', 'show', 'delete'].includes(action)) {
      return new Response('Invalid parameters', { status: 400 });
    }
    
    // 获取 Blob Store
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
    });
    
    // 获取待审核列表
    let submissions = await store.get("submissions", { type: "json" }) || [];
    
    // 找到目标提交
    const submissionIndex = submissions.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) {
      return new Response('Submission not found', { status: 404 });
    }
    
    const submission = submissions[submissionIndex];
    
    if (action === 'approve') {
      // 更新提交状态
      submissions[submissionIndex].status = 'approved';
      submissions[submissionIndex].approvedAt = new Date().toISOString();
      
      // 获取已发布的诗歌列表
      let poems = await store.get("poems", { type: "json" }) || { poems: [], updatedAt: new Date().toISOString() };
      
      // 添加到已发布列表
      const newPoem = {
        author: submission.author,
        submissionId: submission.id,
        lines: submission.lines,
        translations: submission.translations || {},
        language: submission.language || 'en',
        publishedAt: new Date().toISOString()
      };
      
      if (!poems.poems) {
        poems.poems = [];
      }
      poems.poems.push(newPoem);
      poems.updatedAt = new Date().toISOString();
      
      // 保存更新后的数据
      await store.setJSON("submissions", submissions);
      await store.setJSON("poems", poems);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Poem approved and published',
        poem: newPoem
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else if (action === 'reject') {
      // 更新提交状态
      submissions[submissionIndex].status = 'rejected';
      submissions[submissionIndex].rejectedAt = new Date().toISOString();
      
      // 保存更新后的提交列表
      await store.setJSON("submissions", submissions);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Poem rejected'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'hide' || action === 'show' || action === 'delete') {
      // 修改已发布内容可见性或删除
      let poems = await store.get("poems", { type: "json" }) || { poems: [], updatedAt: new Date().toISOString() };
      poems.poems = Array.isArray(poems.poems) ? poems.poems : [];
      let idx = poems.poems.findIndex(p => p.submissionId === submissionId);
      if (idx === -1) {
        // 回退：根据 submission 的 author+lines 匹配（用于旧数据没有 submissionId 的情况）
        const submissions = await store.get("submissions", { type: "json" }) || [];
        const sub = submissions.find(s => s.id === submissionId);
        if (sub) {
          idx = poems.poems.findIndex(p => p && p.author === sub.author && Array.isArray(p.lines) && Array.isArray(sub.lines) && p.lines.length === sub.lines.length && p.lines.every((ln, i) => ln === sub.lines[i]));
        }
      }
      if (idx === -1) return new Response('Published poem not found', { status: 404 });

      if (action === 'delete') {
        poems.poems.splice(idx, 1);
      } else {
        poems.poems[idx].hidden = (action === 'hide');
      }
      poems.updatedAt = new Date().toISOString();
      await store.setJSON("poems", poems);

      return new Response(JSON.stringify({ success: true, message: `Poem ${action}d` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (e) {
    console.error('Approve poem error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

