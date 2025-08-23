/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import { Post } from '../models/postModel.js';
import { DatabaseService } from '../databases/mariaDB.js';

const getPostBySlug = async (slug) => {
  try {
    const post = await DatabaseService.getPostBySlug(slug);
    if (!post || !post.published) throw new Error('Post not found or not published');
    const { error, value } = Post.validate(post);
    if (error) {
      throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    return new Post(value);
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    throw error;
  }
}
const createPost = async (postData) => {
  const { error, value } = Post.validate(postData);
  if (error) {
    throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
  try {
    const post = await DatabaseService.createPost(value);
    if (!post) {
      throw new Error('Post creation failed');
    }
    const { error: valError, value: valValue } = Post.validate(post);
    if (valError) throw new Error('Validation failed after update: ' + valError.details.map(d => d.message).join('; '));
    return new Post(valValue);
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}
const getPostById = async (post_id) => {
  try {
    const post = await DatabaseService.getPostById(post_id);
    if (!post) {
      throw new Error('Post not found');
    }
    const { error, value } = Post.validate(post);
    if (error) {
      throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    if (value.deleted) throw({ error: 'Blogpost deleted' });
    if (!value.published) throw({ error: 'Blogpost not published' });
    return new Post(value);
  } catch (error) {
    console.error('Error fetching post by id:', error);
    throw error;
  }
}
const updatePost = async (postId, postData) => {
  const { error, value } = Post.validate(postData);
  if (error) {
    throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
  }
try {
    const updated = await DatabaseService.updatePost(postId, value);
    if (!updated) {
      throw new Error('Post not found or not updated');
    }
    const post = await DatabaseService.getPostById(postId);
    if (!post) throw new Error('Post not found after update');
    const { error: valError, value: valValue } = Post.validate(post);
    if (valError) throw new Error('Validation failed after update: ' + valError.details.map(d => d.message).join('; '));
    return new Post(valValue);
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
}
const getAllPosts = async () => {
  try {
    const posts = await DatabaseService.getAllPosts();
    if (!posts) {
      throw new Error('No posts found');
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        console.error('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (value.published) {
        validPosts.push(new Post(value));
      }
    }
    if (validPosts.length === 0) {
      throw new Error('No valid published posts found');
    }
    return validPosts;
  } catch (error) {
    console.error('Error fetching all posts:', error);
    throw error;
  }
}
const getMostReadPosts = async () => {
  try {
    const posts = await DatabaseService.getMostReadPosts();
    if(!posts) {
      throw new Error('No posts found');
    }
    const validPosts = [];
    for (const post of posts) {
      const { error, value } = Post.validate(post);
      if (error) {
        console.error('Validation failed for post:', error.details.map(d => d.message).join('; '));
        continue;
      }
      if (!value.published) {
        continue;
      }
      validPosts.push(new Post(value));
    }
    if(validPosts.length === 0) {
      throw new Error('No valid published posts found');
    }
    return validPosts;
  } catch (error) {
    console.error('Error fetching most read posts:', error);
    throw error;
  }
}
const deletePost = async (post_id) => {
  try {
    const result = await DatabaseService.deletePost(post_id);
    if (!result) {
      throw new Error('Post not found or not deleted');
    }
    return { success: true, message: 'Post deleted successfully' };
  } catch (error) {
    console.error('Error deleting post', error);
    throw error;
  }
}
export default {
  getPostBySlug,
  createPost,
  getPostById,
  updatePost,
  getAllPosts,
  getMostReadPosts,
  deletePost
};