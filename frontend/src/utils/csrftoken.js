import Cookies from "js-cookie";

// Assume API_BASE_URL is accessible here, e.g., from an env variable or a config file
// For demonstration, using the previously known URL. Replace with your actual API base URL.
const API_BASE_URL = 'https://team-14-take-6.onrender.com'; 

// This function now performs the fetch to get/set the CSRF cookie
export const ensureCsrfToken = async () => {
  try {
    console.log('Ensuring CSRF token by fetching from /api/auth/csrf_token/...');
    const response = await fetch(`${API_BASE_URL}/api/auth/csrf_token/`, {
      credentials: "include", // Crucial for Set-Cookie to work cross-site
    });
    if (!response.ok) {
      console.error('Failed to fetch CSRF token, status:', response.status);
    } else {
      console.log('CSRF token fetch successful. Cookie should be set by browser.');
    }
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
  }
};

// This function retrieves the X-CSRFToken header value for requests
export const getCsrfHeader = () => ({
  "X-CSRFToken": Cookies.get("csrftoken"), // Reads the cookie set by the ensureCsrfToken call
});

// Utility to just get the token value if needed elsewhere (e.g., for logging)
export const getRawCsrfToken = () => Cookies.get("csrftoken"); 