/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import { Post } from '../models/postModel.js';
import { DatabaseService } from '../databases/mariaDB.js';
import { PostControllerException } from '../models/customExceptions.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// Lightweight posts checksum/version - updated on mutations to avoid hashing full payload
/**
 * Lightweight posts checksum/version - updated on mutations to avoid hashing full payload
 * @type {string|null}
 */
let postsChecksum = null;

/**
 * Erhöht die interne Checksum/Version für Posts, damit Caches/ETags aktualisiert werden.
 */
function bumpPostsChecksum() {
  try {
    // Use current time + random to produce a new checksum
    postsChecksum = crypto.createHash('sha1').update(String(Date.now()) + Math.random().toString(36).substr(2, 9)).digest('hex');
  } catch (e) { void e; postsChecksum = String(Date.now()); }
}
/**
 * Liefert die aktuelle Posts-Checksum (oder `null`, falls noch nicht gesetzt).
 * @returns {string|null}
 */
function getPostsChecksum() {
  return postsChecksum;
}
/**
 * Holt einen veröffentlichten Post anhand des Slugs.
 * @param {string} slug - URL-Slug des Posts.
 * @returns {Promise<Post>} Validierte `Post`-Instanz.
 * @throws {PostControllerException} Wenn Post nicht gefunden oder fehlerhaft ist.
 */
const getPostBySlug = async (slug) => {
  try {
    const post = await DatabaseService.getPostBySlug(slug);
    if (!post || !post.published) throw new PostControllerException('Post not found or not published');
    const { error, value } = Post.validate(post);
    if (error) {
      throw new PostControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    return new Post(value);
  } catch (error) {
    throw new PostControllerException(`Error fetching post by slug: ${error.message}`, error);
  }
};
/**
 * Erstellt einen neuen Post nach Validierung und bump der Posts-Checksum.
 * @param {Object} postData - Postdaten (title, content, etc.).
 * @returns {Promise<Post>} Die erstellte `Post`-Instanz.
 * @throws {PostControllerException} Bei Validierungs- oder DB-Fehlern.
 */
const createPost = async (postData) => {
  const { error, value } = Post.validate(postData);
  if (error) {
    throw new PostControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const post = await DatabaseService.createPost(value);
    if (!post) {
      throw new PostControllerException('Post creation failed');
    }
    const { error: valError, value: valValue } = Post.validate(post);
    if (valError) throw new PostControllerException('Validation failed after update: ' + valError.details.map(d => d.message).join('; '));
    // bump checksum so caches/ETags change
    try { bumpPostsChecksum(); } catch (e) { void e; }
    return new Post(valValue);
  } catch (error) {
    throw new PostControllerException(`Error creating post: ${error.message}`, error);
  }
};
/**
 * Holt einen Post anhand seiner ID.
 * @param {number} postId - Numerische Post-ID.
 * @returns {Promise<Post>} Validierte `Post`-Instanz.
 * @throws {PostControllerException} Wenn Post nicht gefunden oder fehlerhaft.
 */
const getPostById = async (postId) => {
  try {
    logger.debug(`postController.getPostById: Received postId=${postId} (type=${typeof postId})`);
    const post = await DatabaseService.getPostById(postId);
    if (!post) {
      throw new PostControllerException('Post not found');
    }
    const { error, value } = Post.validate(post);
    if (error) {
      throw new PostControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    if (!value.published) throw new PostControllerException('Blogpost deleted/not published');
    return new Post(value);
  } catch (error) {
    throw new PostControllerException(`Error fetching post by id: ${error.message}`, error);
  }
};
/**
 * Aktualisiert einen vorhandenen Post und bump die Posts-Checksum.
 * @param {Object} postData - Aktualisierte Postdaten, inklusive `id`.
 * @returns {Promise<Post>} Die aktualisierte `Post`-Instanz.
 * @throws {PostControllerException} Bei Validierungs- oder DB-Fehlern.
 */
const updatePost = async (postData) => {
  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
    throw new PostControllerException('Validation failed: postData missing');
  }
  if (!postData.id) {
    throw new PostControllerException('Validation failed: id missing');
  }
  // Always preserve slug on update to keep links stable.
  const existing = await DatabaseService.getPostById(postData.id);
  if (!existing || !existing.slug) {
    throw new PostControllerException('Validation failed: slug missing');
  }
  postData.slug = existing.slug;
  if (typeof postData.author === 'undefined') postData.author = existing.author;
  if (typeof postData.published === 'undefined') postData.published = existing.published;
  if (typeof postData.created_at === 'undefined') postData.updated_at = new Date();

  const { error, value } = Post.validate(postData);
  if (error) {
    throw new PostControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const updated = await DatabaseService.updatePost(value);
    if (!updated) {
      throw new PostControllerException('Post not found or not updated');
    }
    const post = await DatabaseService.getPostById(value.id);
    if (!post) throw new PostControllerException('Post not found after update');
    const { error: valError, value: valValue } = Post.validate(post);
    if (valError) throw new PostControllerException('Validation failed after update: ' + valError.details.map(d => d.message).join('; '));
    // bump checksum after successful update
    try { bumpPostsChecksum(); } catch (e) { void e; }
    return new Post(valValue);
  } catch (error) {
    throw new PostControllerException(`Error in updatePost: ${error.message}`, error);
  }
};
/**
 * Liest alle Posts aus der DB, validiert sie und gibt nur veröffentlichte zurück.
 * @returns {Promise<Post[]>} Array gültiger, veröffentlichter Posts.
 * @throws {PostControllerException} Bei kritischen DB-Fehlern.
 */
const getAllPosts = async () => {
  // logger.debug('getAllPosts: Starting to fetch all posts');
  try {
    // logger.debug('getAllPosts: Calling DatabaseService.getAllPosts()');
    const posts = await DatabaseService.getAllPosts();
    
    logger.debug(`getAllPosts: Database returned ${posts ? posts.length : 'null'} posts`);
    
    if (!posts || posts.length === 0) {
      // Unterscheide zwischen leerem Ergebnis und DB-Fehler
      logger.warn('No posts found in database - returning empty array');
      logger.debug('getAllPosts: Returning empty array due to no posts');
      return []; // Leeres Array zurückgeben statt Exception
    }
    
    // logger.debug(`getAllPosts: Processing ${posts.length} posts for validation`);
    const validPosts = [];
    for (const post of posts) {
      // logger.debug(`getAllPosts: Validating post ID ${post.id}, title: "${post.title}"`);
      const { error, value } = Post.validate(post);
      if (error) {
        logger.debug(`getAllPosts: Validation failed for post ID ${post.id}: ${error.details.map(d => d.message).join('; ')}`);
        continue;
      }
      if (value.published) {
        // logger.debug(`getAllPosts: Adding published post ID ${post.id} to valid posts`);
        validPosts.push(new Post(value));
      } else {
        // logger.debug(`getAllPosts: Skipping unpublished post ID ${post.id}`);
      }
    }
    
    // logger.debug(`getAllPosts: Found ${validPosts.length} valid published posts`);
    
    if (validPosts.length === 0) {
      logger.debug('getAllPosts: Returning empty array due to no valid published posts');
      return []; // Leeres Array zurückgeben statt Exception
    }
    
    logger.debug(`getAllPosts: Successfully returning ${validPosts.length} posts`);
    return validPosts;
  } catch (error) {
    // Hier wird zwischen DB-Fehlern und anderen Fehlern unterschieden
    logger.debug(`getAllPosts: Caught error: ${error.message}`, { stack: error.stack });
    
    if (error.message && error.message.includes('No posts found')) {
      logger.debug('getAllPosts: Treating "No posts found" as empty result');
      return []; // Leeres Array bei "keine Posts gefunden"
    }
    
    logger.error(`Critical database error in getAllPosts: ${error.message}`);
    logger.debug('getAllPosts: Throwing PostControllerException due to critical error');
    throw new PostControllerException(`Error fetching all posts: ${error.message}`, error);
  }
};
/**
 * 
 * @param {string} category - Kategorie, nach der gefiltert werden soll (z.B. "Philosophie", "Wissenschaft"). 
 * @returns {Promise<Post[]>} Array gültiger, veröffentlichter Posts der Kategorie.
 */
const getPostsByCategory = async (category) => {
  try {
    const posts = await DatabaseService.getPostsByCategory(category);
    if (!posts || posts.length === 0) {
      return [];
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        logger.debug('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (!value.published) {
        continue;
      }
      validPosts.push(new Post(value));
    }
    return validPosts;
  } catch (error) {
    throw new PostControllerException(`Error fetching posts by category: ${error.message}`, error);
  }
};
/**
 * 
 * @param {Number} category_id - Kategorie-ID, nach der gefiltert werden soll. 
 * @returns {Promise<Post[]>} Array gültiger, veröffentlichter Posts der Kategorie.
 */
const getPostsByCategoryId = async (category_id) => {
  try {
    const posts = await DatabaseService.getPostsByCategoryId(category_id);
    if (!posts || posts.length === 0) {
      return [];
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        logger.debug('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (!value.published) {
        continue;
      }
      validPosts.push(new Post(value));
    }
    return validPosts;
  } catch (error) {
    throw new PostControllerException(`Error fetching posts by category ID: ${error.message}`, error);
  }
};
/**
 * Liest die meistgelesenen Posts aus der DB, validiert und filtert veröffentlichte Posts.
 * @returns {Promise<Post[]>} Array gültiger, veröffentlichter Posts.
 * @throws {PostControllerException} Bei Fehlern.
 */
const getMostReadPosts = async () => {
  try {
    const posts = await DatabaseService.getMostReadPosts();
    if(!posts) {
      throw new PostControllerException('No posts found');
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        logger.debug('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (!value.published) {
        continue;
      }
      validPosts.push(new Post(value));
    }
    if(validPosts.length === 0) {
      throw new PostControllerException('No valid published posts found');
    }
    return validPosts;
  } catch (error) {
    throw new PostControllerException(`Error fetching most read posts: ${error.message}`, error);
  }
};
/**
 * Liest archivierte Posts (z.B. ältere/archivierte) und validiert sie.
 * @returns {Promise<Post[]>} Array gültiger, veröffentlichter Posts.
 * @throws {PostControllerException} Bei Fehlern.
 */
const getArchivedPosts = async (year) => {
  try {
    // If a year is provided, request DB for that specific year; otherwise get all archived posts
    const posts = typeof year !== 'undefined' && year !== null ? await DatabaseService.getArchivedPosts(year) : await DatabaseService.getArchivedPosts();
    if (!posts || posts.length === 0) {
      // No archived posts available — return empty array (not an exception)
      return [];
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        logger.debug('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (!value.published) {
        continue;
      }
      validPosts.push(new Post(value));
    }
    if (validPosts.length === 0) {
      // No valid published archived posts — return empty array (not an exception)
      return [];
    }
    return validPosts; // Return in reverse chronological order
  } catch (error) {
    // If the database explicitly returned no posts, treat as empty; otherwise wrap and rethrow
    if (error && error.message && error.message.includes('No posts found')) {
      return [];
    }
    throw new PostControllerException(`Error fetching archived posts: ${error.message}`, error);
  }
};
/*
 * Returns an array of years for which archived posts exist. Sorted descending.
 */
const getArchivedYears = async () => {
  try {
    if (typeof DatabaseService.getArchivedYears !== 'function') return [];
    const years = await DatabaseService.getArchivedYears();
    if (!years || years.length === 0) return [];
    return Array.isArray(years) ? years.sort((a, b) => b - a) : [];
  } catch (error) {
    throw new PostControllerException(`Error fetching archived years: ${error.message}`, error);
  }
};
/**
 * Löscht einen Post anhand seiner ID und bump die Posts-Checksum.
 * @param {number} postId - Numerische Post-ID.
 * @returns {Promise<Object>} Ergebnisobjekt mit Erfolgsinfo.
 * @throws {PostControllerException} Bei Fehlern.
 */
const deletePost = async (postId) => {
  try {
    const result = await DatabaseService.deletePost(postId);
    if (!result) {
      throw new PostControllerException('Post not found or not deleted');
    }
    // bump checksum on deletion
    try { bumpPostsChecksum(); } catch (e) { void e; }
    return { success: true, message: 'Post deleted successfully' };
  } catch (error) {
    throw new PostControllerException(`Error deleting post: ${error.message}`, error);
  }
};
export default {
  getPostBySlug,
  createPost,
  getPostById,
  getArchivedPosts,
  getArchivedYears,
  updatePost,
  getAllPosts,
  getMostReadPosts,
  deletePost,
  getPostsChecksum,
  getPostsByCategory,
  getPostsByCategoryId,
};