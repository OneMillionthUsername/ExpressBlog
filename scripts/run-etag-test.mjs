import postControllerModule from '../controllers/postController.js';
import { getAllHandler } from '../routes/postRoutes.js';

function createMockReq(headers = {}) {
  return {
    get(name) { return headers[name] || headers[name.toLowerCase()] || undefined; },
    query: {},
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/blogpost/all',
  };
}
function createMockRes() {
  const res = {};
  res._headers = {};
  res.statusCode = 200;
  res.get = (name) => res._headers[name.toLowerCase()];
  res.set = (name, value) => { res._headers[name.toLowerCase()] = value; return res; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res._json = body; return res; };
  res.end = () => { res._ended = true; return res; };
  return res;
}

(async () => {
  const originalGetAll = postControllerModule.getAllPosts;
  const originalGetChecksum = postControllerModule.getPostsChecksum;
  try {
    postControllerModule.getAllPosts = async () => [{ id:1, title:'t', slug:'t', published:true, created_at:new Date(), updated_at:new Date(), views:0, tags:[], author:'a' }];
    postControllerModule.getPostsChecksum = async () => 'checksum-1';

    const req1 = createMockReq();
    const res1 = createMockRes();
    await getAllHandler(req1, res1);
    console.log('res1.statusCode', res1.statusCode);
    console.log('res1._headers', res1._headers);

    const req2 = createMockReq({'If-None-Match': res1._headers['etag']});
    const res2 = createMockRes();
    await getAllHandler(req2, res2);
    console.log('res2.statusCode', res2.statusCode);
    console.log('res2._headers', res2._headers);
  } finally {
    postControllerModule.getAllPosts = originalGetAll;
    postControllerModule.getPostsChecksum = originalGetChecksum;
  }
})();
