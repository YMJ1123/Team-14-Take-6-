import Cookies from "js-cookie";

export const getCsrfHeader = () => ({
  "X-CSRFToken": Cookies.get("csrftoken"),
});

export const getCsrfToken = () => Cookies.get("csrftoken"); 