/**
 * Fehler im Controller als Exceptions werfen
 * in der Route abfangen und an das Frontend zurückgeben
 */

import { Post } from '../models/postModel.js';
import { DatabaseService } from '../databases/mariaDB.js';
import { PostControllerException } from '../models/customExceptions.js';

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
}
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
    return new Post(valValue);
  } catch (error) {
    throw new PostControllerException(`Error creating post: ${error.message}`, error);
  }
}
const getPostById = async (postId) => {
  try {
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
}
const updatePost = async (postData) => {
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
    return new Post(valValue);
  } catch (error) {
    throw new PostControllerException(`Error in updatePost: ${error.message}`, error);
  }
}
const getAllPosts = async () => {
  try {
    const posts = await DatabaseService.getAllPosts();
    if (!posts) {
      throw new PostControllerException('No posts found');
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
      throw new PostControllerException('No valid published posts found');
    }
    return validPosts;
  } catch (error) {
    throw new PostControllerException(`Error fetching all posts: ${error.message}`, error);
  }
}
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
        console.error('Validation failed for post:', error.details.map(d => d.message).join('; '));
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
}
const deletePost = async (postId) => {
  try {
    const result = await DatabaseService.deletePost(postId);
    if (!result) {
      throw new PostControllerException('Post not found or not deleted');
    }
    return { success: true, message: 'Post deleted successfully' };
  } catch (error) {
    throw new PostControllerException(`Error deleting post: ${error.message}`, error);
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