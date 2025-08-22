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
  // Posts
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
        convertBigInts(post);
        post.tags = parseTags(post.tags);
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
  async increasePostViews(postId, ipAddress, userAgent, referer) {
    // TODO: Implement tracking of post views
    let conn;
    try {
      conn = await pool.getConnection();
      const update = await conn.query('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);
      return update.affectedRows > 0;
      //await conn.query(`INSERT INTO post_views (post_id, event_type, ip_address, user_agent, referer) VALUES (?, 'view', ?, ?, ?)`, [postId, ipAddress, userAgent, referer]);
    } catch (error) {
      throw new BlogpostError('Error in increasePostViews:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updatePost(id, post) {
    let conn;
    try {
      conn = await pool.getConnection();

      const result = await conn.query('UPDATE posts SET ? WHERE id = ?', [post, id]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to update post');
      }
      return { success: true };
    } catch (error) {
      throw new BlogpostError('Error in updatePost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deletePost(id) {
    let conn;
    try {
      conn = await pool.getConnection();
      const result = await conn.query('UPDATE posts SET published = 0, updated_at = NOW() WHERE id = ?', [id]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to delete post');
      }
      return { id };
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
      return { success: true, id: result.insertId, ...postData };
    } catch (error) {
      throw new BlogpostError('Error in createPost:', error);
    } finally {
      if (conn) conn.release();
    }
  },
  // Cards
  async createCard(cardData) {
      let conn;
      try {
          conn = await pool.getConnection();
          const result = await conn.query('INSERT INTO cards SET ?', [cardData]);
          if (result.affectedRows === 0) {
              throw new Error('Failed to create card');
          }
          return {
            success: true,
            card: {...cardData, id: Number(result.insertId)}
          };
      } catch (error) {
          console.error('Error in createCard:', error);
          throw error;
      } finally {
          if (conn) conn.release();
      }
  },
  async getAllCards() {
      let conn;
      try {
          conn = await pool.getConnection();
          const result = await conn.query('SELECT * FROM cards ORDER BY id DESC');
          return result.map(card => ({
              ...convertBigInts(card)
          }));
      } catch (error) {
          console.error('Error in getAllCards:', error);
          throw error;
      } finally {
          if (conn) conn.release();
      }
  },
  async getCardById(cardId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('SELECT * FROM cards WHERE id = ?', [cardId]);
        return result.length > 0 ? {
            ...convertBigInts(result[0])
        } : null;
    } catch (error) {
        console.error('Couldn\'t find card', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async deleteCard(cardId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM cards WHERE id = ?', [cardId]);
        return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting card:', error);
      throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  // Comments
  async addComment(postId, commentData) {
      let conn;
      try {
          conn = await pool.getConnection();
          const result = await conn.query('INSERT INTO comments ? WHERE post_id = ?', [commentData, postId]);

          return {
              success: true,
              comment: {
                  id: Number(result.insertId),
                  ...commentData
              }
          };
      } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
      } finally {
          if (conn) conn.release();
      }
  },
  async getCommentsByPost(postId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(`
            SELECT id, username, text, created_at
            FROM comments 
            WHERE post_id = ? AND approved = 1
            ORDER BY created_at ASC
        `, [postId]);
        return result.map(comment => ({
            id: Number(comment.id),
            username: comment.username,
            text: comment.text,
            created_at: comment.created_at
        }));
    } catch (error) {
        console.error('Error fetching comments:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async deleteComment(commentId, postId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query(
            'DELETE FROM comments WHERE id = ? AND post_id = ?',
            [commentId, postId]
        );
        return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    } finally {
        if (conn) conn.release();
    }
  }, 
  // Media
  async addMedia(mediaData) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('INSERT INTO media SET ?', [mediaData]);
        return {
            success: true,
            mediaId: Number(result.insertId)
        };
    } catch (error) {
      console.error('Error adding media:', error);
      throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async deleteMedia(mediaId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('DELETE FROM media WHERE id = ?', [mediaId]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error deleting media:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  // Admin
  async getAdminByUsername(username) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);
        return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error fetching admin by username:', error);
      throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async updateAdminLoginSuccess(adminId) {
    let conn;
    try {
        conn = await pool.getConnection();
        const update = await conn.query('UPDATE admins SET last_login = NOW(), login_attempts = 0, locked_until = NULL WHERE id = ?', [adminId]);
        return update.affectedRows > 0;
      } catch (error) {
      console.error('Error updating admin login success:', error);
      throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async updateAdminLoginFailure(adminId) {
    let conn;
    try {
        conn = await pool.getConnection();
        // Aktuelle Login-Attempts abrufen
        const result = await conn.query('SELECT login_attempts FROM admins WHERE id = ?', [adminId]);
        if (result.length > 0) {
            const currentAttempts = result[0].login_attempts + 1;
            let locked_until = null;

            // Account nach 3 fehlgeschlagenen Versuchen für 30 Minuten sperren
            if (currentAttempts >= 3) {
                locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 Minuten
            }

          const update = await conn.query('UPDATE admins SET login_attempts = ?, locked_until = ? WHERE id = ?', [currentAttempts, locked_until, adminId]);
          return update.affectedRows > 0;
        }
        else {
            // Admin not found
            return false;
        }
    } catch (error) {
        console.error('Error updating admin login failure:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
  },
  async updateAdminStatus(adminId, active) {
    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('UPDATE admins SET active = ? WHERE id = ?', [active, adminId]);
        return result.affectedRows > 0;
    } catch (error) {
        console.error('Error updating admin status:', error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
  } 
}

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('Closing MariaDB connections...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Closing MariaDB connections...');
    await pool.end();
    process.exit(0);
});

export { pool };
export default pool;
