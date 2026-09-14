/*
 * FIX: there was no server-side logout endpoint anywhere in the app.
 * The "logout" buttons (site-shell.js, pages/common.js) only removed
 * unrelated localStorage keys ("token"/"user" - leftovers from an
 * older approach) and reloaded the page. The real session cookie set
 * by log_in/register/register_super_admin is httpOnly, which means
 * client-side JS can never read or delete it with document.cookie -
 * that's the whole point of httpOnly (XSS protection). Without a
 * dedicated endpoint that calls res.clearCookie() server-side, the
 * cookie never actually went away: after "logging out" and reloading,
 * /api/auth/me still validated the same token and the user was
 * immediately treated as signed in again.
 *
 * clearCookie's options (httpOnly/sameSite/secure/path) must match the
 * options used when the cookie was originally set (see log_in
 * .controller.js / register.controller.js / register_super_admin.js)
 * for the browser to actually remove it instead of silently ignoring
 * the clear instruction.
 */

const log_out = (req, res) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: false,
            sameSite: "lax"
        });

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.log(error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = log_out;
