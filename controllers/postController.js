import { Post } from '../models/postModel.js';
import { DatabaseService } from '../databases/mariaDB.js';

const getPostBySlug = async (slug) => {
  try {
    const post = await DatabaseService.getPostBySlug(slug);
    return new Post(post);
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    throw error;
  }
}

const createPost = async (postData) => {
  try {
    const newPost = await DatabaseService.createPost(postData);
    return new Post(newPost);
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

const getPostById = async (post_id) => {
  try {
    const post = await DatabaseService.getPostById(post_id);
    return new Post(post);
  } catch (error) {
    console.error('Error fetching post by id:', error);
    throw error;
  }
}

const updatePost = async (postId, postData) => {
  try {
    const updated = await DatabaseService.updatePost(postId, postData);
    if (!updated) {
      throw new Error('Post not found or not updated');
    }
    const post = await DatabaseService.getPostById(postId);
    return new Post(post);
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
}

const getAllPosts = async () => {
  try {
    const posts = await DatabaseService.getAllPosts();
    return posts.map(post => new Post(post));
  } catch (error) {
    console.error('Error fetching all posts:', error);
    throw error;
  }
}

const getMostReadPosts = async () => {
  try {
    const posts = await DatabaseService.getMostReadPosts();
    return posts.map(post => new Post(post));
  } catch (error) {
    console.error('Error fetching most read posts:', error);
    throw error;
  }
}

const deletePost = async (post_id) => {
  try {
    await DatabaseService.deletePost(post_id);
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