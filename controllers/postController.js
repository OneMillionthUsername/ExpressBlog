import postModel from '../models/postModel.js';

const getPostBySlug = async (slug) => {
  try {
    const post = await postModel.findOne({ slug });
    return post;
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    throw error;
  }
};

const createPost = async (postData) => {
  try {
    const newPost = new postModel(postData);
    await newPost.save();
    return newPost;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export default {
  getPostBySlug,
  createPost,
};