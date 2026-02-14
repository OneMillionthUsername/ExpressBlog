import { Category } from '../models/categoryModel.js';
import { CategoryControllerException } from '../models/customExceptions.js';
import { DatabaseService } from '../databases/mariaDB.js';

const getAllCategories = async () => {
  try {
    const categories = await DatabaseService.getAllCategories();
    if (!categories || categories.length === 0) {
        return [];
    }
    const validCategories = [];
    for (const category of categories) {
      const { error, value } = Category.validate(category);
        if (error) {
            console.error('Validation failed for category:', error.details.map(d => d.message).join('; '));
            continue;
        }
        validCategories.push(new Category(value));
    }
    return validCategories;
  } catch (error) {
    throw new CategoryControllerException(`Error getting all categories: ${error.message}`, error);
  }
};

const getCategoryById = async (id) => {
  try {
    if (!Number.isInteger(id) || id <= 0) {
        throw new CategoryControllerException('Invalid category ID');
    }
    const category = await DatabaseService.getCategoryById(id);
    if (!category) {
        throw new CategoryControllerException('Category not found');
    }
    const { error, value } = Category.validate(category);
    if (error) {
        throw new CategoryControllerException('Validation failed: ' + error.details.map(d => d.message).join('; '));
    }
    return new Category(value);
  } catch (error) {
    throw new CategoryControllerException(`Error getting category by id: ${error.message}`, error);
  } 
};

export default {
  getAllCategories,
  getCategoryById,
};