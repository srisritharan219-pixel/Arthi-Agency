window.ATTENDFLOW_CONFIG = {
    // Netlify static hosting uses this serverless backend.
    // For Hostinger PHP/MySQL, change this to "https://your-domain.com/api.php".
    API_URL: "/.netlify/functions/api",

    // Hosted domains must use one central database. Local fallback is allowed only on localhost/dev.
    CLOUD_REQUIRED: true,
    ALLOW_LOCAL_FALLBACK: false
};
