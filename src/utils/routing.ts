
/**
 * Utility functions for handling routing in different environments
 */

// Detect if we're in a Lovable preview/production environment
export const isLovableEnvironment = (): boolean => {
  return window.location.hostname.includes('lovable.app') || 
         window.location.hostname.includes('lovableproject.com');
};

/**
 * Determines the appropriate basename for React Router
 * This is crucial for making routing work in both development and preview environments
 */
export const getBasename = (): string => {
  console.log('🔍 getBasename() called with:', {
    pathname: window.location.pathname,
    hostname: window.location.hostname,
    href: window.location.href,
    isLovableEnv: isLovableEnvironment()
  });

  // If we're in a Lovable environment (preview or production)
  if (isLovableEnvironment()) {
    // For preview URLs, extract the app name from the hostname
    // e.g., "preview--app-garden-fusion.lovable.app" -> "app-garden-fusion"
    const hostname = window.location.hostname;
    const appNameMatch = hostname.match(/preview--(.*?)\.lovable\.app/);
    
    if (appNameMatch && appNameMatch[1]) {
      const basename = `/${appNameMatch[1]}`;
      console.log(`✅ Using basename: ${basename} from preview URL`);
      return basename;
    }
    
    // Extract from pathname as fallback
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    console.log('📊 Path segments:', pathSegments);
    
    if (pathSegments.length > 0) {
      const basename = `/${pathSegments[0]}`;
      console.log(`✅ Using basename: ${basename} from pathname`);
      return basename;
    }
    
    console.log('⚠️ No path segments found in Lovable environment, using root basename');
    return '/';
  }
  
  // For local development, use root basename
  console.log('✅ Using root basename for local development');
  return '/';
};

/**
 * Builds a full URL for navigation, considering the current environment
 */
export const buildNavigationUrl = (path: string): string => {
  const baseUrl = window.location.origin;
  const basename = getBasename();
  
  // Ensure we don't duplicate slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (isLovableEnvironment()) {
    return `${baseUrl}${basename}${cleanPath}`;
  }
  
  return `${baseUrl}${cleanPath}`;
};

