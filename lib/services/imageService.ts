// Image Service - Wrapper around StorageService for image-specific operations
import { storageService } from "./storage";

export class ImageService {
  /**
   * Upload an image file and return its URL
   */
  static async uploadImage(file: File, folder?: string): Promise<string> {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image");
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error("Image size must be less than 5MB");
    }

    // Create path if folder is provided
    const path = folder ? `${folder}/${file.name}` : file.name;

    return await storageService.upload(file, path);
  }

  /**
   * Delete an image by URL
   */
  static async deleteImage(url: string): Promise<void> {
    return await storageService.delete(url);
  }

  /**
   * Validate image file before upload
   */
  static validateImage(file: File): { valid: boolean; error?: string } {
    // Check file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: "Invalid image type. Please upload JPEG, PNG, or WebP images.",
      };
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "Image size must be less than 5MB.",
      };
    }

    return { valid: true };
  }
}

