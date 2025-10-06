import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 简单的密码验证
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
    // 解析请求体
    const data = await req.json();
    
    // 验证数据结构
    if (!data.poems || !Array.isArray(data.poems)) {
      return new Response('Invalid data format', { status: 400 });
    }
    
    // 获取 Netlify Blobs store
    const store = getStore({
      name: "poems-data",
      siteID: process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN || context.env?.NETLIFY_TOKEN
    });
    
    // 保存数据到 Blob Store
    await store.setJSON("poems", data);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Poems saved successfully',
      count: data.poems.length,
      updatedAt: data.updatedAt
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
    
  } catch (e) {
    console.error('Save poems error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

