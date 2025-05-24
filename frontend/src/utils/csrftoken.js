import Cookies from "js-cookie";

export const csrfHeader = {
  "X-CSRFToken": Cookies.get("csrftoken"),
};

// Function to get the raw token value, useful for direct comparison or logging
export const getCsrfToken = () => Cookies.get("csrftoken"); 