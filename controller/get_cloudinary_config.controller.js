require("dotenv").config();

// GET /api/get_cloudinary_config
// Returns the Cloudinary settings the frontend needs to upload images
// directly from the browser. This reads ONLY from process.env — there is
// no hardcoded fallback here on purpose, so changing the .env is the one
// and only way to change which Cloudinary account/preset the site uses.
const get_cloudinary_config = (req, res) => {
    try {

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
            return res.status(500).json({
                success: false,
                message: "Cloudinary is not configured on the server (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET in .env)",
                data: null
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cloudinary config",
            data: {
                cloudName,
                uploadPreset,
                uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
            }
        });

    } catch (error) {

        console.log(error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            data: null
        });
    }
};

module.exports = get_cloudinary_config;