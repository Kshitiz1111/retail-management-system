// Product Service - Business logic for product operations
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, orderBy, Timestamp, limit, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product, Warehouse } from "@/lib/types";
import { generateProductQR } from "@/lib/utils/qrCode";
import { ImageService } from "./imageService";

export class ProductService {
  /**
   * Create a new product
   */
  static async createProduct(
    productData: Omit<Product, "id" | "createdAt" | "updatedAt" | "trackTrace">,
    imageFile?: File
  ): Promise<string> {
    try {
      // Upload image if provided
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await ImageService.uploadImage(imageFile, "products");
      }

      // Generate QR code data
      const qrData = generateProductQR("", productData.sku); // ID will be set after creation

      // Create product document
      const productRef = await addDoc(collection(db, "products"), {
        ...productData,
        imageUrl,
        trackTrace: {
          qrCodeUrl: qrData,
          history: [],
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Update QR code with actual product ID
      const updatedQrData = generateProductQR(productRef.id, productData.sku);
      await updateDoc(productRef, {
        "trackTrace.qrCodeUrl": updatedQrData,
      });

      return productRef.id;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  /**
   * Update a product
   */
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  /**
   * Delete a product
   */
  static async deleteProduct(productId: string): Promise<void> {
    try {
      const productRef = doc(db, "products", productId);
      await deleteDoc(productRef);
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  /**
   * Get a product by ID
   */
  static async getProduct(productId: string): Promise<Product | null> {
    try {
      const productDoc = await getDoc(doc(db, "products", productId));
      if (productDoc.exists()) {
        return { id: productDoc.id, ...productDoc.data() } as Product;
      }
      return null;
    } catch (error) {
      console.error("Error fetching product:", error);
      throw error;
    }
  }

  /**
   * Get all products
   */
  static async getAllProducts(): Promise<Product[]> {
    try {
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const products: Product[] = [];
      querySnapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() } as Product);
      });
      return products;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }

  /**
   * Get products by warehouse
   */
  static async getProductsByWarehouse(warehouseId: string): Promise<Product[]> {
    try {
      const allProducts = await this.getAllProducts();
      return allProducts.filter(
        (product) => product.warehouses[warehouseId] && product.warehouses[warehouseId].quantity > 0
      );
    } catch (error) {
      console.error("Error fetching products by warehouse:", error);
      throw error;
    }
  }

  /**
   * Update product quantity in warehouse
   */
  static async updateWarehouseQuantity(
    productId: string,
    warehouseId: string,
    quantity: number,
    position?: string
  ): Promise<void> {
    try {
      const product = await this.getProduct(productId);
      if (!product) throw new Error("Product not found");

      const warehouseData = product.warehouses[warehouseId] || {
        quantity: 0,
        position: position || "",
        minQuantity: 0,
      };

      await updateDoc(doc(db, "products", productId), {
        [`warehouses.${warehouseId}`]: {
          ...warehouseData,
          quantity,
          position: position || warehouseData.position,
        },
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error("Error updating warehouse quantity:", error);
      throw error;
    }
  }

  /**
   * Generate the next SKU based on existing products
   */
  static async generateNextSku(): Promise<string> {
    try {
      const q = query(collection(db, "products"), orderBy("sku", "desc"), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return "PROD-0001";
      }

      const lastSku = querySnapshot.docs[0].data().sku;
      const match = lastSku.match(/PROD-(\d+)/);

      if (!match) {
        // If the SKU doesn't match the pattern, use the collection count as a base
        const countSnapshot = await getCountFromServer(collection(db, "products"));
        const nextNum = countSnapshot.data().count + 1;
        return `PROD-${nextNum.toString().padStart(4, "0")}`;
      }

      const nextNum = parseInt(match[1], 10) + 1;
      return `PROD-${nextNum.toString().padStart(4, "0")}`;
    } catch (error) {
      console.error("Error generating next SKU:", error);
      // Final fallback
      return `PROD-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
    }
  }
}

