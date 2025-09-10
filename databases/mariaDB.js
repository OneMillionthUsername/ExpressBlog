//This folder contains database connection logic.

/** 
- Database Connection: Encapsulates the logic for establishing database connections.
- Reusability: This file can be imported in different parts of the app to interact with the database.
- Environment Setup: Makes it easy to configure different databases for different environments (development, production).
*/



import * as mariadb from 'mariadb';
import { convertBigInts, parseTags } from '../utils/utils.js';
//import queryBuilder from '../utils/queryBuilder.js';
import { dbConfig } from '../config/dbConfig.js';
import logger from '../utils/logger.js';
import { databaseError } from '../models/customExceptions.js';

let pool;
let isMockMode = false;

function createMockPool() {
  logger.warn('Using mock database pool for testing');
  return {
    getConnection: async () => {
      return {
        query: async (Sql, params = []) => {
          logger.debug(`[MOCK DB] SQL: ${Sql}, Params: ${JSON.stringify(params)}`);
          if(Sql.toLowerCase().includes('select version()')) {
            return [{ version: '10.5.9-MariaDB-1:10.5.9+maria~focal' }];
          }
          else if (Sql.toLowerCase().includes('select') && Sql.toLowerCase().includes('posts')) {
            return [
              {
                id: 1,
                slug: 'sample-post-1',
                title: 'Sample Blog Post 1',
                content: '<p>This is a sample blog post content.</p>',
                tags: '["sample","blog"]',
                author: 'admin',
                views: 10,
                published: 1,
                created_at: new Date(),
                updated_at: new Date(),
              },
              {
                id: 2,
                slug: 'sample-post-2',
                title: 'Sample Blog Post 2',
                content: '<p>This is another sample blog post.</p>',
                tags: '["sample","test"]',
                author: 'admin',
                views: 5,
                published: 1,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ];
          }
          else if (Sql.toLowerCase().includes('insert')) {
            return { insertId: 1, affectedRows: 1 };
          }
          else if (Sql.toLowerCase().includes('update') || Sql.toLowerCase().includes('delete')) {
            return { affectedRows: 1 };
          } else if (Sql.toLowerCase().includes('create table')) {
            return { warningStatus: 0 };
          }
          return [];
        },
        release: () => {
          logger.debug('[MOCK DB] Connection released');
        },
        end: () => Promise.resolve(),
      };
    },
    end: async () => {
      if (isMockMode) {
        logger.warn('Mock database pool does not need to be closed');
      }
      return Promise.resolve();
    },
  };
}

// Prüfen ob Mock-Modus aktiv ist
export function isMockDatabase() {
  return isMockMode;
}

export async function initializeDatabase() {
  logger.debug('initializeDatabase: Starting database initialization');
  
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Keine lokale Datenbank konfiguriert. Überspringe Datenbank-Initialisierung.');
    logger.debug('initializeDatabase: Using mock mode for development');
    pool = createMockPool();
    isMockMode = true;
    return;
  }
  
  // Prüfe ob alle notwendigen DB-Umgebungsvariablen gesetzt sind
  logger.debug('initializeDatabase: Checking environment variables');
  if (!dbConfig.user || !dbConfig.password || !dbConfig.database) {
    logger.warn('Database environment variables not fully configured. Using mock mode.');
    logger.warn('Missing variables:', {
      DB_USER: !dbConfig.user ? 'MISSING' : 'OK',
      DB_PASSWORD: !dbConfig.password ? 'MISSING' : 'OK', 
      DB_NAME: !dbConfig.database ? 'MISSING' : 'OK',
    });
    logger.debug('initializeDatabase: Switching to mock mode due to missing env vars');
    pool = createMockPool();
    isMockMode = true;
    return;
  }
  
  try {
    logger.debug('initializeDatabase: Creating MariaDB connection pool', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      connectionLimit: dbConfig.connectionLimit,
    });
    
    pool = mariadb.createPool(dbConfig);

    logger.debug('initializeDatabase: Testing initial connection');
    const connection = await pool.getConnection();
    connection.release();
    
    logger.debug('initializeDatabase: Database pool created successfully');
  } catch (error) {
    logger.debug(`initializeDatabase: Database connection failed: ${error.message}`, { stack: error.stack });
    logger.error(`Error creating MariaDB pool connection: ${error.message}`);
    logger.warn('Falling back to mock mode due to database connection failure');
    pool = createMockPool();
    isMockMode = true;
    // Nicht mehr werfen - auf Mock-Modus fallen lassen
    return;
  }
}

/**
 * Returns the current MariaDB pool instance.
 * @returns {{ pool: typeof mariadb.Pool }} The database pool object.
 * @throws {databaseError} If the pool is not initialized.
 */
export function getDatabasePool() {
  if (!pool) {
    logger.error('No pool or database has been initialized. Call initializeDatabase() first.');
    throw new databaseError('Database has not been initialized. Call initializeDatabase() first.');
  }
  return pool;
}
// Datenbankverbindung testen
/**
 * Tests the connection to the MariaDB database (or mock database in development mode).
 * Logs the database version if successful, or logs an error if the connection fails.
 * @returns {Promise<boolean>} Returns true if the connection is successful, otherwise throws an error.
 * @throws {databaseError} If the connection fails.
 */
export async function testConnection() {
  let conn;
  try {
    conn = await getDatabasePool().getConnection();
    const result = await conn.query('SELECT VERSION() as version');
    if (isMockMode) {
      logger.info('Mock MariaDB connection successful, Version: ' + result[0].version);
    } else {
      logger.info('MariaDB connection successful, Version: ' + result[0].version);
    }
    return true;
  } catch (error) {
    if (isMockMode) {
      logger.error(`Mock MariaDB connection failed: ${error.message}`);
    } else {
      logger.error(`MariaDB connection failed: ${error.message}`);
    }
    throw new databaseError(`${isMockMode ? 'Mock MariaDB' : 'MariaDB'} connection failed: ${error.message}`, error);
  } finally {
    if (conn) conn.release();
  }
}
export async function initializeDatabaseSchema() {
  let conn;
  try {
    if(isMockMode) {
      logger.info('Mock mode - skipping actual database schema initialization.');
      return true; 
    }
    conn = await getDatabasePool().getConnection();
    logger.info('Initializing MariaDB schema...');
    // Posts-Tabelle
    await conn.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content LONGTEXT NOT NULL,
            slug VARCHAR(50) NOT NULL UNIQUE,
            tags JSON DEFAULT NULL,
            author VARCHAR(100) DEFAULT 'admin',
            views BIGINT DEFAULT 0,
            published BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_posts_created_at (created_at DESC),
            INDEX idx_posts_views (views DESC),
            INDEX idx_posts_author (author),
            INDEX idx_posts_published (published)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Comments-Tabelle
    await conn.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            postId BIGINT NOT NULL,
            username VARCHAR(100) NOT NULL DEFAULT 'Anonym',
            text VARCHAR(1000) NOT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            approved BOOLEAN DEFAULT 1,
            published BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_comments_postId (postId),
            INDEX idx_comments_created_at (created_at DESC),
            INDEX idx_comments_approved (approved),

            FOREIGN KEY (postId) REFERENCES posts(id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Uploads/Media-Tabelle
    await conn.query(`
        CREATE TABLE IF NOT EXISTS media (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            postId BIGINT NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            file_size BIGINT DEFAULT NULL,
            mime_type VARCHAR(100) DEFAULT NULL,
            uploaded_by VARCHAR(100) DEFAULT NULL,
            upload_path VARCHAR(500) DEFAULT NULL,
            alt_text VARCHAR(255) DEFAULT NULL,
            used_in_posts JSON DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            INDEX idx_media_uploaded_by (uploaded_by),
            INDEX idx_media_created_at (created_at DESC),
            INDEX idx_media_mime_type (mime_type),
            INDEX idx_media_original_name(original_name),

            FOREIGN KEY (postId) REFERENCES posts(id)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Analytics/Views-Tabelle
    // await conn.query(`
    //     CREATE TABLE IF NOT EXISTS post_analytics (
    //         id BIGINT AUTO_INCREMENT PRIMARY KEY,
    //         postId BIGINT NOT NULL,
    //         event_type ENUM('view', 'comment', 'share', 'download') DEFAULT 'view',
    //         ip_address VARCHAR(45) DEFAULT NULL,
    //         user_agent TEXT DEFAULT NULL,
    //         referer VARCHAR(500) DEFAULT NULL,
    //         country VARCHAR(50) DEFAULT NULL,
    //         city VARCHAR(100) DEFAULT NULL,
    //         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    //         INDEX idx_analytics_postId (postId),
    //         INDEX idx_analytics_event_type (event_type),
    //         INDEX idx_analytics_created_at (created_at DESC),
    //         INDEX idx_analytics_ip (ip_address),

    //         FOREIGN KEY (postId) REFERENCES posts(id)
    //             ON DELETE CASCADE ON UPDATE CASCADE
    //     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    // `);

    // Admin-Benutzer Tabelle (für zukünftige Multi-Admin-Unterstützung)
    await conn.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            full_name VARCHAR(255) DEFAULT NULL,
            role ENUM('admin', 'editor', 'viewer') DEFAULT 'admin',
            active BOOLEAN DEFAULT 1,
            last_login DATETIME DEFAULT NULL,
            login_attempts INT DEFAULT 0,
            locked_until DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_admins_username (username),
            INDEX idx_admins_active (active),
            INDEX idx_admins_role (role),
            INDEX idx_admins_last_login (last_login)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Backup-Tabelle für gelöschte Posts (Wiederherstellung)
    await conn.query(`
        CREATE TABLE IF NOT EXISTS deleted_posts (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            original_id BIGINT NOT NULL,
            title VARCHAR(500) NOT NULL,
            content LONGTEXT NOT NULL,
            tags JSON DEFAULT NULL,
            author VARCHAR(100) DEFAULT NULL,
            views BIGINT DEFAULT 0,
            original_created_at DATETIME NOT NULL,
            deleted_by VARCHAR(100) NOT NULL,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reason TEXT DEFAULT NULL,

            INDEX idx_deleted_posts_original_id (original_id),
            INDEX idx_deleted_posts_deleted_at (deleted_at DESC),
            INDEX idx_deleted_posts_author (author),
            INDEX idx_deleted_posts_deleted_by (deleted_by)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Karten-Tabelle
    await conn.query(`
        CREATE TABLE IF NOT EXISTS cards (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            subtitle VARCHAR(200) DEFAULT NULL,
            link VARCHAR(500) NOT NULL,
            img VARCHAR(500) NOT NULL,
            published BOOLEAN DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('MariaDB schema created/verified successfully');
    logger.info('MariaDB schema created/verified successfully');
    return true;
  } catch (error) {
    if(isMockMode) {
      logger.log('Mock-Schema erstellt');
      return true;
    }
    logger.error(`Error creating MariaDB schema: ${error.message}`);
    throw new databaseError(`Error creating MariaDB schema: ${error.message}`, error);
  } finally {
    if (conn) conn.release();
  }
}
export const DatabaseService = {
  // Posts
  /**
   * Retrieves a published post by its slug.
   * @param {string} slug - The slug of the post to retrieve.
   * @returns {Promise<object|null>} Resolves with the post object if found and published, otherwise null.
   * @throws {databaseError} If a database error occurs during the query.
   */
  async getPostBySlug(slug) {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      //const { query, params } = queryBuilder('get', 'posts', { slug });
      //const result = await conn.query(query, params);
      const result = await conn.query('SELECT * FROM posts WHERE slug = ? LIMIT 1', [slug]);
      if (!result || result.length === 0) return null;
      if (result.length > 1) return null;
      if (!result[0].published) return null;
      return convertBigInts(result[0]);
    } catch (error) {
      logger.error(`Error in getPostBySlug: ${error.message}`);
      throw new databaseError(`Error in getPostBySlug: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getPostById(id) {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      //const { query, params } = queryBuilder('get', 'posts', { id });
      //const result = await conn.query(query, params);
      const result = await conn.query('SELECT * FROM posts WHERE id = ?', [id]);
      if(!result || result.length === 0) {
        logger.warn(`Post with ID ${id} not found`);
        throw new Error('Post not found');
      }
      const post = result[0];
      convertBigInts(post);
      post.tags = parseTags(post.tags);
      return post;
    } catch (error) {
      logger.error(`Error in getPostById: ${error.message}`);
      throw new databaseError(`Error in getPostById: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getAllPosts() {
    let conn;
    logger.debug('DatabaseService.getAllPosts: Starting database query');
    try {
      logger.debug('DatabaseService.getAllPosts: Getting database connection');
      conn = await getDatabasePool().getConnection();
      
      logger.debug('DatabaseService.getAllPosts: Executing SELECT * FROM posts');
      //const { query, params } = queryBuilder('get', 'posts');
      //const result = await conn.query(query, params);
      const result = await conn.query('SELECT * FROM posts');
      
      logger.debug(`DatabaseService.getAllPosts: Query returned ${result ? result.length : 'null'} rows`);
      
      // Keine Posts gefunden ist kein Fehler, sondern ein leeres Ergebnis
      if(!result || result.length === 0) {
        logger.info('No posts found in database - returning empty array');
        logger.debug('DatabaseService.getAllPosts: Returning empty array');
        return []; // Leeres Array zurückgeben statt Exception
      }
      
      logger.debug(`DatabaseService.getAllPosts: Processing ${result.length} posts`);
      const processedPosts = result.map((post, index) => {
        logger.debug(`DatabaseService.getAllPosts: Processing post ${index + 1}/${result.length}, ID: ${post.id}`);
        convertBigInts(post);
        post.tags = parseTags(post.tags);
        
        // Datentyp-Konvertierung für Validation
        // Autor: NULL oder undefined zu String konvertieren
        if (post.author === null || post.author === undefined) {
          post.author = 'admin'; // Default-Autor
        }
        
        // Published: Integer (0/1) zu Boolean konvertieren
        if (typeof post.published === 'number') {
          post.published = post.published === 1;
        } else if (post.published === null || post.published === undefined) {
          post.published = false; // Default zu false
        }
        
        logger.debug(`DatabaseService.getAllPosts: Post ${post.id} - author: "${post.author}", published: ${post.published} (${typeof post.published})`);
        
        return post;
      });
      
      logger.debug(`DatabaseService.getAllPosts: Successfully processed ${processedPosts.length} posts`);
      return processedPosts;
    } catch (error) {
      logger.debug(`DatabaseService.getAllPosts: Database error occurred: ${error.message}`, { stack: error.stack });
      logger.error(`Error in getAllPosts: ${error.message}`);
      throw new databaseError(`Error in getAllPosts: ${error.message}`);
    } finally {
      if (conn) {
        logger.debug('DatabaseService.getAllPosts: Releasing database connection');
        conn.release();
      }
    }
  },
  async getArchivedPosts() {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('SELECT * FROM posts WHERE created_at < NOW() - INTERVAL 3 MONTH');
      if (!result || result.length === 0) {
        return [];
      }
      return result.map(post => {
        convertBigInts(post);
        post.tags = parseTags(post.tags);
        return post;
      });
    } catch (error) {
      logger.error(`Error in getArchivedPosts: ${error.message}`);
      throw new databaseError(`Error in getArchivedPosts: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getPostsByTag(tag) {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      //const { query, params } = queryBuilder('read', 'posts', { tags: { like: `%${tag}%` } });
      //const result = await conn.query(query, params);
      const result = await conn.query('SELECT * FROM posts WHERE tags LIKE ?', [`%${tag}%`]);
      if(!result || result.length === 0) {
        throw new Error('No posts found for this tag');
      }
      return result.map(post => {
        convertBigInts(post);
        post.tags = parseTags(post.tags);
        return post;
      });
    } catch (error) {
      logger.error(`Error in getPostsByTag: ${error.message}`);
      throw new databaseError(`Error in getPostsByTag: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getMostReadPosts() {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
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
      logger.error(`Error in getMostReadPosts: ${error.message}`);
      throw new databaseError(`Error in getMostReadPosts: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async increasePostViews(postId, _ipAddress, _userAgent, _referer) {
    // TODO: Implement tracking of post views
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      const update = await conn.query('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);
      if(!update || update.affectedRows === 0) {
        throw new Error('No rows affected');
      }
      return { success: true };
      //await conn.query(`INSERT INTO post_views (postId, event_type, ip_address, user_agent, referer) VALUES (?, 'view', ?, ?, ?)`, [postId, ipAddress, userAgent, referer]);
    } catch (error) {
      logger.error(`Error in increasePostViews: ${error.message}`);
      throw new databaseError(`Error in increasePostViews: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updatePost(post) {
    let conn;
    try {
      if (!post || typeof post !== 'object' || Array.isArray(post)) {
        throw new databaseError('Post is null or not an object');
      }
      const updatableFields = ['title', 'content', 'tags', 'published', 'author'];
      const hasUpdatableField = updatableFields.some(field => field in post);
      if (!hasUpdatableField) {
        throw new databaseError('No fields provided for update');
      }

      conn = await getDatabasePool().getConnection();

      const result = await conn.query('UPDATE posts SET ? WHERE id = ?', [post, post.id]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to update post');
      }
      return { success: true };
    } catch (error) {
      logger.error(`Error in updatePost: ${error.message}`);
      throw new databaseError(`Error in updatePost: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deletePost(id) {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('UPDATE posts SET published = 0, updated_at = NOW() WHERE id = ?', [id]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to delete post');
      }
      return { success: true };
    } catch (error) {
      logger.error(`Error in deletePost: ${error.message}`);
      throw new databaseError(`Error in deletePost: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async createPost(postData) {
    let conn;
    try {
      if(postData === null || typeof postData !== 'object' || Object.keys(postData).length === 0) {
        throw new databaseError('Post is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('INSERT INTO posts SET ?', [postData]);
      if(!result || result.affectedRows === 0) {
        throw new Error('Failed to create post');
      }
      return { success: true, id: result.insertId, ...postData };
    } catch (error) {
      logger.error(`Error in createPost: ${error.message}`);
      throw new databaseError(`Error in createPost: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  // Cards
  async createCard(cardData) {
    let conn;
    try {
      if (!cardData || typeof cardData !== 'object') {
        throw new databaseError('Card is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('INSERT INTO cards SET ?', [cardData]);
      if (result.affectedRows === 0) {
        throw new Error('No rows affected');
      }
      return {
        success: true,
        card: {...cardData, id: Number(result.insertId)},
      };
    } catch (error) {
      logger.error(`Error in createCard: ${error.message}`);
      throw new databaseError(`Error in createCard: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getAllCards() {
    let conn;
    try {
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('SELECT * FROM cards ORDER BY id DESC');
      if (!result || result.length === 0) {
        throw new Error('No cards found');
      }
      return result.map(card => ({
        ...convertBigInts(card),
      }));
    } catch (error) {
      logger.error(`Error in getAllCards: ${error.message}`);
      throw new databaseError(`Error in getAllCards: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getCardById(cardId) {
    let conn;
    try {
      if(cardId === null || isNaN(cardId)) {
        throw new databaseError('ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('SELECT * FROM cards WHERE id = ?', [cardId]);
      return result.length > 0 ? {
        ...convertBigInts(result[0]),
      } : null;
    } catch (error) {
      logger.error(`Error in getCardById: ${error.message}`);
      throw new databaseError(`Error in getCardById: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deleteCard(cardId) {
    let conn;
    try {
      if(cardId === null || isNaN(cardId)) {
        throw new databaseError('ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('DELETE FROM cards WHERE id = ?', [cardId]);
      if (result.affectedRows > 0) {
        return { success: true };
      } else {
        throw new databaseError('No rows affected');
      }
    } catch (error) {
      logger.error(`Error in deleteCard: ${error.message}`);
      throw new databaseError(`Error in deleteCard: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  // Comments
  async createComment(postId, commentData) {
    let conn;
    try {
      if (!postId || isNaN(postId) || postId === null) {
        throw new databaseError('Post ID is null or invalid');
      }
      if (!commentData || typeof commentData !== 'object' || commentData === null) {
        throw new databaseError('Comment data is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('INSERT INTO comments ? WHERE postId = ?', [commentData, postId]);

      return {
        success: true,
        comment: {
          id: Number(result.insertId),
          postId: Number(postId),
          ...commentData,
        },
      };
    } catch (error) {
      logger.error(`Error in createComment: ${error.message}`);
      throw new databaseError(`Error in createComment: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getCommentsByPostId(postId) {
    let conn;
    try {
      if (!postId || isNaN(postId) || postId === null) {
        throw new databaseError('Post ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query(`
            SELECT id, username, text, created_at
            FROM comments 
            WHERE postId = ? AND approved = 1
            ORDER BY created_at ASC
        `, [postId]);
      return result.map(comment => ({
        id: Number(comment.id),
        username: comment.username,
        text: comment.text,
        created_at: comment.created_at,
      }));
    } catch (error) {
      logger.error(`Error in getCommentsByPostId: ${error.message}`);
      throw new databaseError(`Error in getCommentsByPostId: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deleteComment(commentId, postId) {
    let conn;
    try {
      if (!commentId || isNaN(commentId) || commentId === null) {
        throw new databaseError('Comment ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query(
        'DELETE FROM comments WHERE id = ? AND postId = ?',
        [commentId, postId],
      );
      return result.affectedRows > 0 ? { success: true } : null;
    } catch (error) {
      logger.error(`Error in deleteComment: ${error.message}`);
      throw new databaseError(`Error in deleteComment: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  }, 
  // Media
  async addMedia(mediaData) {
    let conn;
    try {
      if (!mediaData || typeof mediaData !== 'object' || mediaData === null) {
        throw new databaseError('Media data is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('INSERT INTO media SET ?', [mediaData]);
      return {
        success: true,
        mediaId: Number(result.insertId),
      };
    } catch (error) {
      logger.error(`Error in addMedia: ${error.message}`);
      throw new databaseError(`Error in addMedia: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async deleteMedia(mediaId) {
    let conn;
    try {
      if (!mediaId || isNaN(mediaId) || mediaId === null) {
        throw new databaseError('Media ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('DELETE FROM media WHERE id = ?', [mediaId]);
      return result.affectedRows > 0 ? { success: true } : null;
    } catch (error) {
      logger.error(`Error in deleteMedia: ${error.message}`);
      throw new databaseError(`Error in deleteMedia: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async getMediaById(mediaId) {
    let conn;
    try {
      if (!mediaId || isNaN(mediaId) || mediaId === null) {
        throw new databaseError('Media ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('SELECT * FROM media WHERE id = ?', [mediaId]);
      return result.length > 0 ? convertBigInts(result[0]) : null;
    } catch (error) {
      logger.error(`Error in getMediaById: ${error.message}`);
      throw new databaseError(`Error in getMediaById: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  // Admin
  async getAdminByUsername(username) {
    let conn;
    try {
      if (!username || typeof username !== 'string' || username.trim() === '' || username === null) {
        throw new databaseError('Username is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      logger.error(`Error in getAdminByUsername: ${error.message}`);
      throw new databaseError(`Error in getAdminByUsername: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updateAdminLoginSuccess(adminId) {
    let conn;
    try {
      if (!adminId || isNaN(adminId) || adminId === null) {
        throw new databaseError('Admin ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const update = await conn.query('UPDATE admins SET last_login = NOW(), login_attempts = 0, locked_until = NULL WHERE id = ?', [adminId]);
      return update.affectedRows > 0 ? true : false;
    } catch (error) {
      logger.error(`Error in updateAdminLoginSuccess: ${error.message}`);
      throw new databaseError(`Error in updateAdminLoginSuccess: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updateAdminLoginFailure(adminId) {
    let conn;
    try {
      if (!adminId || isNaN(adminId) || adminId === null) {
        throw new databaseError('Admin ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
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
        return update.affectedRows > 0 ? true : false;
      }
      else {
        // Admin not found
        return false;
      }
    } catch (error) {
      logger.error(`Error in updateAdminLoginFailure: ${error.message}`);
      throw new databaseError(`Error in updateAdminLoginFailure: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  },
  async updateAdminStatus(adminId, active) {
    let conn;
    try {
      if(adminId === null || isNaN(adminId)) {
        throw new databaseError('Admin ID is null or invalid');
      }
      conn = await getDatabasePool().getConnection();
      const result = await conn.query('UPDATE admins SET active = ? WHERE id = ?', [active, adminId]);
      return result.affectedRows > 0 ? true : false;
    } catch (error) {
      logger.error(`Error in updateAdminStatus: ${error.message}`);
      throw new databaseError(`Error in updateAdminStatus: ${error.message}`, error);
    } finally {
      if (conn) conn.release();
    }
  }, 
};
// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('Closing MariaDB connections...');
  await getDatabasePool().end();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  console.log('Closing MariaDB connections...');
  await getDatabasePool().end();
  process.exit(0);
});
