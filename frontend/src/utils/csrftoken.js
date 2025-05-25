import Cookies from "js-cookie";

export const csrfHeader = {
  "X-CSRFToken": Cookies.get("csrftoken"),
};
 
export const getCsrfToken = () => Cookies.get("csrftoken"); 