import { DatabaseService } from "../databases/mariaDB.js";
import Comment from "../models/commentModel.js";
import { CommentControllerException } from "../models/customExceptions.js";

const createComment = async (postId, commentData) => {
    const { error, value } = Comment.validate(commentData);
    if (error) {
        throw new CommentControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    try {
        const result = await DatabaseService.createComment(postId, value);
        if (!result || result.affectedRows === 0) {
            throw new Error('Failed to add comment');
        }
        return { success: true, message: 'Comment created successfully' };
    } catch (error) {
        throw new CommentControllerException(`Error adding comment: ${error.message}`, error);
    }
}
const getCommentsByPostId = async (postId) => {
    try {
        const comments = await DatabaseService.getCommentsByPostId(postId);
        if (!comments || comments.length === 0) {
            return [];
        }
        const validComments = [];
        for (const comment of comments) {
            const { error, value } = Comment.validate(comment);
            if (error) {
                console.error('Validation failed for comment:', error.details.map(d => d.message).join('; '));
                continue;
            }
            if (!value.approved || !value.published) {
                continue;
            }
            validComments.push(new Comment(value));
        }
        return validComments;
    } catch (error) {
        throw new CommentControllerException(`Error getting comments by post id: ${error.message}`, error);
    }
}
const deleteComment = async (commentId, postId) => {
    try {
        const result = await DatabaseService.deleteComment(commentId, postId);
        if (!result || !result.success) {
            throw new CommentControllerException('Comment not found or not deleted');
        }
        return { success: true, message: 'Comment deleted successfully' };
    } catch (error) {
        throw new CommentControllerException(`Error deleting comment: ${error.message}`, error);
    }
}
export default {
    createComment,
    getCommentsByPostId,
    deleteComment
}