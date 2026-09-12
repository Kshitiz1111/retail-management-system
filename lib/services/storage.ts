// Storage Service Abstraction Layer
// This allows us to swap between ImgBB and S3 without changing the rest of the app

export interface StorageService {
  upload(file: File, path?: string): Promise<string>; // Returns URL
  delete(url: string): Promise<void>;
}

// ImgBB Implementation (Current)
export const imgbbService: StorageService = {
  upload: async (file: File, path?: string): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);

    // Get API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
      throw new Error("ImgBB API key is not configured. Please set NEXT_PUBLIC_IMGBB_API_KEY in your .env file");
    }

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ImgBB upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.data?.url) {
        return data.data.url;
      } else {
        throw new Error("ImgBB upload failed: Invalid response");
      }
    } catch (error) {
      console.error("Storage upload error:", error);
      throw error;
    }
  },

  delete: async (url: string): Promise<void> => {
    // ImgBB doesn't easily support delete via API without heavy setup
    // We can leave this empty or log a warning for now
    console.warn("ImgBB delete is not implemented. URL:", url);
  },
};

// Future S3 Implementation (Placeholder)
// Uncomment and implement when ready to switch to S3
/*
export const s3Service: StorageService = {
  upload: async (file: File, path?: string): Promise<string> => {
    // Implement S3 upload logic here
    // Use AWS SDK or similar
    throw new Error("S3 service not yet implemented");
  },
  delete: async (url: string): Promise<void> => {
    // Implement S3 delete logic here
  },
};
*/

// Export the current service (change this to s3Service when ready)
export const storageService: StorageService = imgbbService;

