
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
    
    if (hostname.includes('preview--')) {
      const appNameMatch = hostname.match(/preview--(.*?)\.lovable\.app/);
      
      if (appNameMatch && appNameMatch[1]) {
        const basename = `/${appNameMatch[1]}`;
        console.log(`✅ Using basename: ${basename} from preview URL`);
        return basename;
      }
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

/**
 * Checks if the current route is correct, and returns the proper path if it's not
 * Useful for correcting nested routes like "bays/login" that should be just "/login"
 */
export const correctRoutePath = (currentPath: string): string | null => {
  // Get the basename for the environment
  const basename = getBasename();
  
  console.log('🛠️ correctRoutePath checking:', { 
    currentPath, 
    basename,
    isLovableEnv: isLovableEnvironment()
  });
  
  // Get the path without the basename
  let relativePath = currentPath;
  if (basename !== '/' && currentPath.startsWith(basename)) {
    relativePath = currentPath.slice(basename.length);
  }
  
  console.log('🔍 Processing relative path:', relativePath);
  
  // Check for common routing issues
  if (relativePath === '/bays/login' || relativePath === 'bays/login') {
    console.log('🔄 Correcting bays/login route to /login');
    return `${basename}/login`;
  }
  
  if ((relativePath.includes('/bays/my-bay') || relativePath.includes('bays/my-bay')) && 
      !relativePath.endsWith('/my-bay')) {
    console.log('🔄 Correcting nested my-bay route');
    return `${basename}/my-bay`;
  }
  
  if ((relativePath.includes('/bays/admin') || relativePath.includes('bays/admin')) && 
      !relativePath.endsWith('/admin')) {
    console.log('🔄 Correcting nested admin route');
    return `${basename}/admin`;
  }
  
  // For root path in preview environment
  if (isLovableEnvironment() && (currentPath === '/' || currentPath === '')) {
    console.log('🔄 Correcting empty root path in preview environment');
    return basename;
  }
  
  // No correction needed
  return null;
}
