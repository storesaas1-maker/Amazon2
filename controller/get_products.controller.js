const products = require("../models/products");
const cache = require("../utils/cache");

const get_products = async (req, res) => {
  try {
    // Number of products per page
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    // Page number
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    // Calculate number of products to skip
    const skip = (page - 1) * limit;

    // Unique cache key for each page
    const cacheKey = `products:page=${page}:limit=${limit}`;

    // Check Cache
    const cachedProducts = await cache.get(cacheKey);

    if (cachedProducts) {
      console.log("Products from CACHE");

      return res.status(200).json({
        success: true,
        message: "get products successfully",
        data: cachedProducts.data,
        pagination: cachedProducts.pagination,
      });
    }

    // Get products
    // 'section' is an ObjectId, so we use populate
    const all_products = await products
      .find()
      .populate("section", "name")
      .skip(skip)
      .limit(limit);

    // Total number of products
    const totalProducts = await products.estimatedDocumentCount();

    const totalPages = Math.ceil(totalProducts / limit);

    // No products found
    if (all_products.length === 0) {
      return res.status(200).json({
        success: true,
        message: "not found",
        data: [],
        pagination: {
          page,
          limit,
          totalProducts,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      });
    }

    // Data to be stored in Cache
    const responseData = {
      data: all_products,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }; // Store the page in Cache
    await cache.set(cacheKey, responseData);

    console.log("Products from DATABASE");

    return res.status(200).json({
      success: true,
      message: "get products successfully",
      data: all_products,
      pagination: responseData.pagination,
    });
  } catch (e) {
    console.log(e.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: e.message,
    });
  }
};

module.exports = get_products;
