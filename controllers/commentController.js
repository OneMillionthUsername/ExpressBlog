import { DatabaseService } from "../databases/mariaDB";
import { commentModel } from "../models/commentModel.js";

const addComment = async (post_id, commentData) => {
    const { error, value } = commentModel.validate(commentData);
    if (error) {
        throw new Error('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    try {
        const result = await DatabaseService.addComment(post_id, value);
        if (!result || result.affectedRows === 0) {
            throw new Error('Failed to add comment');
        }
        return { success: true, message: 'Comment added successfully' };
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
}
const getCommentsByPostId = async (post_id) => {
    try {
        const comments = await DatabaseService.getCommentsByPostId(post_id);
        if (!comments || comments.length === 0) {
            return [];
        }
        const validComments = [];
        for (const comment of comments) {
            const { error, value } = commentModel.validate(comment);
            if (error) {
                console.error('Validation failed for comment:', error.details.map(d => d.message).join('; '));
                continue;
            }
            validComments.push(new commentModel(value));
        }
        return validComments;
    } catch (error) {
        console.error('Error getting comments by post id:', error);
        throw error;
    }
}
const deleteComment = async (comment_id, post_id) => {
    try {
        const result = await DatabaseService.deleteComment(comment_id, post_id);
        if (!result) {
            throw new Error('Comment not found or not deleted');
        }
        return { success: true, message: 'Comment deleted successfully' };
    } catch (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }
}
export default {
    addComment,
    getCommentsByPostId,
    deleteComment
}