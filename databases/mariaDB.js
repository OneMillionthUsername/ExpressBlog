//This folder contains database connection logic.

/** 
- Database Connection: Encapsulates the logic for establishing database connections.
- Reusability: This file can be imported in different parts of the app to interact with the database.
- Environment Setup: Makes it easy to configure different databases for different environments (development, production).
*/

class BlogpostError extends Error {}

import * as mariadb from 'mariadb';
import { convertBigInts, parseTags } from '../utils/utils';
import queryBuilder from '../utils/queryBuilder';

// MariaDB Connection Pool konfigurieren
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    acquireTimeout: 30000,
    timeout: 30000,
    reconnect: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
};
const pool = mariadb.createPool(dbConfig);

// Datenbankverbindung testen
export async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('SELECT VERSION() as version');
        console.log('MariaDB connection successful, Version:', result[0].version);
        return true;
    } catch (error) {
        console.error('MariaDB connection failed:', error.message);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

export const DatabaseService = {
  // posts
  async getPostBySlug(slug) {
    let conn;
    try {
      conn = await pool.getConnection();
      const { query, params } = queryBuilder('get', 'posts', { slug });
      const result = await conn.query(query, params);
      //const result = await conn.query('SELECT * FROM posts WHERE slug = ?', [slug]);
      if(!result || result.length === 0) {
        throw new Error('Post not found');
      }
      if(result.length > 1) {
        throw new Error('Multiple posts found');
      }

      const post = result[0];
      if(!post.published) {
        throw new Error('Post not published');
      }
      return convertBigInts(post);
    } catch (error) {
      throw new BlogpostError('Error in getPostBySlug:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getPostById(id) {
    let conn;
    try {
      conn = await pool.getConnection();
      const { query, params } = queryBuilder('get', 'posts', { id });
const result = await conn.query(query, params);
      //const result = await conn.query('SELECT * FROM posts WHERE id = ?', [id]);
      if(!result || result.length === 0) {
        throw new Error('Post not found');
      }
      const post = result[0];
      convertBigInts(post);
      post.tags = parseTags(post.tags);
      return post;
    } catch (error) {
      throw new BlogpostError('Error in getPostById:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getAllPosts() {
    let conn;
    try {
      conn = await pool.getConnection();
      const { query, params } = queryBuilder('get', 'posts');
      const result = await conn.query(query, params);
      //const result = await conn.query('SELECT * FROM posts');
      if(!result || result.length === 0) {
        throw new Error('No posts found');
      }
      return result.map(post => {
        // 1. Rufe die Funktion auf, um das 'post'-Objekt direkt zu modifizieren
        convertBigInts(post);
        // 2. Füge die Tags hinzu. Da das 'post'-Objekt schon verändert wurde,
        //    kannst du die Eigenschaft einfach hinzufügen
        post.tags = parseTags(post.tags);
        // 3. Gib das nun vollständig korrigierte und modifizierte Objekt zurück
        return post;
      });
    } catch (error) {
      throw new BlogpostError(`Error in getAllPosts: ${error.message}`);
    } finally {
      if (conn) conn.release();
    }
  },
  async getPostsByTag(tag) {
    let conn;
    try {
      conn = await pool.getConnection();
      const { query, params } = queryBuilder('read', 'posts', { tags: { like: `%${tag}%` } });
      const result = await conn.query(query, params);
      //const result = await conn.query('SELECT * FROM posts WHERE tags LIKE ?', [`%${tag}%`]);
      if(!result || result.length === 0) {
        throw new Error('No posts found for this tag');
      }
      return result.map(post => {
        convertBigInts(post);
        post.tags = parseTags(post.tags);
        return post;
      });
    } catch (error) {
      throw new BlogpostError('Error in getPostsByTag:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getMostReadPosts() {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query('SELECT * FROM posts ORDER BY views DESC LIMIT 5');
      if(!result || result.length === 0) {
        throw new Error('No posts found');
      }
      return result.map(post => {
        convertBigInts(post);
        post.tags = parseTags(post.tags);
        return post;
      });
    } catch (error) {
      throw new BlogpostError('Error in getMostReadPosts:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async incrementViews(postId, ipAddress, userAgent, referer) {
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);
      //await conn.query(`INSERT INTO post_views (post_id, event_type, ip_address, user_agent, referer) VALUES (?, 'view', ?, ?, ?)`, [postId, ipAddress, userAgent, referer]);
    } catch (error) {
      throw new BlogpostError('Error in incrementViews:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async createPost(post) {
    let conn;
    try {
      conn = await pool.getConnection();

      const result = await conn.query('INSERT INTO posts SET ?', [post]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to create post');
      }
      return { id: result.insertId, ...post };
    } catch (error) {
      throw new BlogpostError('Error in createPost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updatePost(id, slug, post) {
    let conn;
    try {
      conn = await pool.getConnection();

      const result = await conn.query('UPDATE posts SET ? WHERE id = ? AND slug = ?', [post, id, slug]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to update post');
      }
      return { id, slug, ...post };
    } catch (error) {
      throw new BlogpostError('Error in updatePost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deletePost(id, slug) {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query('UPDATE posts SET published = 0, updated_at = NOW() WHERE id = ? OR slug = ?', [id, slug]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to delete post');
      }
      return { id, slug };
    } catch (error) {
      throw new BlogpostError('Error in deletePost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async createPost(postData) {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query('INSERT INTO posts SET ?', [postData]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to create post');
      }
      return { id: result.insertId, ...postData };
    } catch (error) {
      throw new BlogpostError('Error in createPost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
}