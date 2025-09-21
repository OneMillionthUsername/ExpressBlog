import fs from 'fs';
import ejs from 'ejs';
import path from 'path';

test('readPost.ejs renders without throwing', () => {
  const viewPath = path.resolve(process.cwd(), 'views', 'readPost.ejs');
  const tmpl = fs.readFileSync(viewPath, 'utf8');

  const samplePost = {
    id: 59,
    title: 'Test Post',
    content: '<p>This is a <strong>test</strong> content with HTML.</p>',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: ['test', 'sample'],
  };

  expect(() => {
    // Provide filename option so EJS include() calls resolve relative to the views directory
    const html = ejs.render(tmpl, { post: samplePost }, { filename: viewPath });
    expect(typeof html).toBe('string');
  }).not.toThrow();
});
