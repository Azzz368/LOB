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
    
    // 找到目标提交（展览模式下，submissions 可能与 poems 不完全一致，因此 hide/show/delete 不强依赖 submissions）
    const submissionIndex = submissions.findIndex(s => s.id === submissionId);
    const submission = submissionIndex !== -1 ? submissions[submissionIndex] : null;
    
    // approve/reject 必须存在 submission；hide/show/delete 允许仅根据 poems 操作
    if (!submission && (action === 'approve' || action === 'reject')) {
      return new Response('Submission not found', { status: 404 });
    }
    
    if (action === 'approve') {
      // 更新提交状态
      submissions[submissionIndex].status = 'approved';
      submissions[submissionIndex].approvedAt = new Date().toISOString();
      
      // 获取已发布的诗歌列表
      let poems = await store.get("poems", { type: "json" }) || { poems: [], updatedAt: new Date().toISOString() };
      
      // 添加到已发布列表
      const newPoem = {
        author: submission.author,
        source: submission.source || '',
        submissionId: submission.id,
        lines: submission.lines,
        translations: submission.translations || {},
        language: submission.language || 'en',
        hidden: false,
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
      // 修改已发布内容可见性或删除（增强：删除时清理所有重复副本与提交记录）
      let poems = await store.get("poems", { type: "json" }) || { poems: [], updatedAt: new Date().toISOString() };
      poems.poems = Array.isArray(poems.poems) ? poems.poems : [];

      // 定位主记录：优先 submissionId；否则回退 author+lines 完全匹配
      let idx = poems.poems.findIndex(p => p && p.submissionId === submissionId);
      let targetSignature = null;
      if (idx === -1) {
        // 优先用当前 submission（若存在）；否则再尝试从 submissions 列表回退匹配
        const sub = submission || (submissions || []).find(s => s && s.id === submissionId);
        if (sub) {
          const norm = (arr) => (Array.isArray(arr) ? arr.join('\n').trim() : '');
          const subSig = `${(sub.author || '').trim()}::${norm(sub.lines)}`;
          targetSignature = subSig;
          idx = poems.poems.findIndex(p => {
            const pSig = `${(p.author || '').trim()}::${norm(p.lines)}`;
            return pSig === subSig;
          });
        }
      } else {
        // 基于已找到记录计算 signature，后续用于批量清理重复副本
        const norm = (arr) => (Array.isArray(arr) ? arr.join('\n').trim() : '');
        const p = poems.poems[idx];
        targetSignature = `${(p.author || '').trim()}::${norm(p.lines)}`;
      }

      // 如果 poems 中能直接命中 submissionId，则允许继续；否则需要 signature
      if (idx === -1 && !targetSignature) {
        return new Response('Published poem not found', { status: 404 });
      }

      if (action === 'delete') {
        // 1) 从已发布列表中删除所有与 targetSignature 匹配的重复副本
        const beforeCount = poems.poems.length;
        const norm = (arr) => (Array.isArray(arr) ? arr.join('\n').trim() : '');
        // 若有 signature：按 signature 批量删除；否则仅删除 submissionId 精确命中
        if (targetSignature) {
          poems.poems = poems.poems.filter(p => {
            const pSig = `${(p.author || '').trim()}::${norm(p.lines)}`;
            return pSig !== targetSignature;
          });
        } else {
          poems.poems = poems.poems.filter(p => !(p && p.submissionId === submissionId));
        }
        const removedFromPoems = beforeCount - poems.poems.length;

        // 2) 从提交列表中物理删除该 submission 及其完全重复副本（同 author+lines）
        let subs = submissions || [];
        const beforeSubs = subs.length;
        if (targetSignature) {
          subs = subs.filter(s => {
            const subSig = `${(s.author || '').trim()}::${norm(s.lines)}`;
            return !(s.id === submissionId || subSig === targetSignature);
          });
        } else {
          subs = subs.filter(s => !(s && s.id === submissionId));
        }
        const removedFromSubs = beforeSubs - subs.length;

        // 3) 持久化变更
        poems.updatedAt = new Date().toISOString();
        await store.setJSON("poems", poems);
        await store.setJSON("submissions", subs);

        return new Response(JSON.stringify({
          success: true,
          message: 'Poem deleted and duplicates purged',
          removedFromPoems,
          removedFromSubs
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // hide/show：仅切换可见性
        if (idx === -1) {
          return new Response('Published poem not found', { status: 404 });
        }
        poems.poems[idx].hidden = (action === 'hide');
        poems.updatedAt = new Date().toISOString();
        await store.setJSON("poems", poems);

        return new Response(JSON.stringify({ success: true, message: `Poem ${action}d` }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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

