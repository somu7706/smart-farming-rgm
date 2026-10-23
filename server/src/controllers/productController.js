import { Product } from "../models/Product.js";
import { Farmer } from "../models/Farmer.js";
import { broadcastSyncEvent } from "../config/websocket.js";

// 1. GET ALL PRODUCTS (Public / Marketplace)
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      crop,
      region,
      farmingType,
      minPrice,
      maxPrice,
      sortBy = "price_asc",
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { status: "available" };

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { region: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    if (crop && crop !== "all") {
      filter.name = new RegExp(crop, "i");
    }

    if (region && region !== "all") {
      filter.region = new RegExp(region, "i");
    }

    if (farmingType && farmingType !== "all") {
      filter.farmingType = farmingType;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined && minPrice !== "") filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined && maxPrice !== "") filter.price.$lte = parseFloat(maxPrice);
    }

    // Sort order
    let sort = {};
    if (sortBy === "price_asc") sort.price = 1;
    else if (sortBy === "price_desc") sort.price = -1;
    else if (sortBy === "yield_desc") sort.quantity = -1;
    else if (sortBy === "yield_asc") sort.quantity = 1;
    else sort.createdAt = -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("farmerId", "fullName phone region avatarUrl latitude longitude")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);

    // Format for frontend
    const formatted = products.map((p) => {
      const farmer = p.farmerId || {};
      return {
        id: p._id.toString(),
        farmer_id: p.supabaseFarmerId || (farmer._id ? farmer._id.toString() : ""),
        mongo_farmer_id: farmer._id ? farmer._id.toString() : "",
        farmer_name: farmer.fullName || "Local Farmer",
        farmer_phone: farmer.phone || "",
        region: p.region || farmer.region || "",
        crop_name: p.name,
        category: p.category,
        total_yield: p.quantity,
        expected_price: p.price,
        farming_type: p.farmingType,
        latitude: farmer.latitude || null,
        longitude: farmer.longitude || null,
        image_url: p.imageUrl,
        description: p.description,
        status: p.status,
      };
    });

    return res.status(200).json({
      success: true,
      products: formatted,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("[Product] Get products error:", error);
    return res.status(500).json({ message: "Failed to fetch products. " + error.message });
  }
};

// 2. GET PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate("farmerId", "fullName phone region avatarUrl latitude longitude");

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const farmer = product.farmerId || {};
    return res.status(200).json({
      id: product._id.toString(),
      farmer_id: product.supabaseFarmerId || (farmer._id ? farmer._id.toString() : ""),
      farmer_name: farmer.fullName || "Local Farmer",
      region: product.region || farmer.region || "",
      crop_name: product.name,
      category: product.category,
      total_yield: product.quantity,
      expected_price: product.price,
      farming_type: product.farmingType,
      latitude: farmer.latitude || null,
      longitude: farmer.longitude || null,
      image_url: product.imageUrl,
      description: product.description,
      status: product.status,
    });
  } catch (error) {
    console.error("[Product] Get product error:", error);
    return res.status(500).json({ message: "Failed to get product. " + error.message });
  }
};

// 3. CREATE PRODUCT (Farmer Only)
export const createProduct = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "farmer") {
      return res.status(403).json({ message: "Only registered farmers can list products." });
    }

    const farmer = await Farmer.findOne({ userId: user._id });
    if (!farmer) {
      return res.status(404).json({ message: "Farmer profile not found. Please complete profile first." });
    }

    const { name, category, farmingType, price, quantity, unit, description, imageUrl } = req.body;

    if (!name || price === undefined || quantity === undefined) {
      return res.status(400).json({ message: "Name, price, and quantity are required." });
    }

    const newProduct = await Product.create({
      farmerId: farmer._id,
      userId: user._id,
      supabaseFarmerId: user.supabaseId,
      name: name.trim(),
      category: category || "Produce",
      farmingType: farmingType || farmer.farmingType || "Mixed",
      price: parseFloat(price),
      quantity: parseFloat(quantity),
      unit: unit || "kg",
      region: farmer.region || "",
      description: description || "",
      imageUrl: imageUrl || "",
      status: "available",
    });

    // Broadcast new product to consumers in real time
    broadcastSyncEvent({
      entity: "product",
      action: "create",
      id: newProduct._id.toString(),
      data: {
        id: newProduct._id.toString(),
        farmer_id: newProduct.supabaseFarmerId || farmer._id.toString(),
        farmer_name: farmer.fullName,
        region: newProduct.region || farmer.region,
        crop_name: newProduct.name,
        category: newProduct.category,
        total_yield: newProduct.quantity,
        expected_price: newProduct.price,
        farming_type: newProduct.farmingType,
        latitude: farmer.latitude,
        longitude: farmer.longitude,
        description: newProduct.description,
        image_url: newProduct.imageUrl,
        status: newProduct.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product listed successfully.",
      product: newProduct,
    });
  } catch (error) {
    console.error("[Product] Create product error:", error);
    return res.status(500).json({ message: "Failed to create product. " + error.message });
  }
};

// 4. UPDATE PRODUCT (Farmer Owner Only)
export const updateProduct = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Ownership check
    if (product.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You can only update your own products." });
    }

    const updates = req.body;
    delete updates.farmerId;
    delete updates.userId;
    delete updates.supabaseFarmerId;

    if (updates.price !== undefined) updates.price = parseFloat(updates.price);
    if (updates.quantity !== undefined) updates.quantity = parseFloat(updates.quantity);

    const updated = await Product.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

    // Broadcast product update to consumers in real time
    broadcastSyncEvent({
      entity: "product",
      action: "update",
      id: updated._id.toString(),
      data: {
        id: updated._id.toString(),
        farmer_id: updated.supabaseFarmerId,
        crop_name: updated.name,
        category: updated.category,
        total_yield: updated.quantity,
        expected_price: updated.price,
        farming_type: updated.farmingType,
        description: updated.description,
        image_url: updated.imageUrl,
        status: updated.status,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product: updated,
    });
  } catch (error) {
    console.error("[Product] Update product error:", error);
    return res.status(500).json({ message: "Failed to update product. " + error.message });
  }
};

// 5. DELETE PRODUCT (Farmer Owner Only)
export const deleteProduct = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Ownership check
    if (product.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own products." });
    }

    await Product.findByIdAndDelete(id);

    // Broadcast deletion to consumers in real time
    broadcastSyncEvent({
      entity: "product",
      action: "delete",
      id,
    });

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("[Product] Delete product error:", error);
    return res.status(500).json({ message: "Failed to delete product. " + error.message });
  }
};
