import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const authResult = await authenticate.admin(request);
  
  // Si authenticate.admin() retourne une Response (redirection), on la propage
  if (authResult instanceof Response) {
    return authResult;
  }
  
  // Sinon, on continue normalement
  return null;
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
