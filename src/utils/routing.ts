
/**
 * Utility functions for handling routing in different environments
 */

// Detect if we're in a Lovable preview/production environment
export const isLovableEnvironment = (): boolean => {
  const isLovable = window.location.hostname.includes('lovable.app') || 
         window.location.hostname.includes('lovableproject.com');
  console.log('🔍 isLovableEnvironment check:', { isLovable, hostname: window.location.hostname });
  return isLovable;
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
    
    console.log('🔎 Analyzing hostname for basename:', hostname);
    
    if (hostname.includes('preview--')) {
      const appNameMatch = hostname.match(/preview--(.*?)\.lovable\.app/);
      console.log('🔎 Preview hostname match result:', appNameMatch);
      
      if (appNameMatch && appNameMatch[1]) {
        const basename = `/${appNameMatch[1]}`;
        console.log(`✅ Using basename: ${basename} from preview URL`);
        return basename;
      } else {
        console.warn('⚠️ Failed to extract app name from preview URL:', hostname);
      }
    }
    
    // Extract from pathname as fallback
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    console.log('📊 Path segments for fallback basename:', pathSegments);
    
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
  
  const finalUrl = isLovableEnvironment() 
    ? `${baseUrl}${basename}${cleanPath}`
    : `${baseUrl}${cleanPath}`;
    
  console.log('🔗 buildNavigationUrl:', { 
    path, 
    baseUrl, 
    basename, 
    cleanPath, 
    finalUrl 
  });
  
  return finalUrl;
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
    isLovableEnv: isLovableEnvironment(),
    fullUrl: window.location.href
  });
  
  // Get the path without the basename
  let relativePath = currentPath;
  if (basename !== '/' && currentPath.startsWith(basename)) {
    relativePath = currentPath.slice(basename.length);
    console.log('🔍 Extracted relative path from basename:', relativePath);
  } else {
    console.log('🔍 Using original path as relative path (no basename extraction):', relativePath);
  }
  
  console.log('🔎 Processing relative path for corrections:', relativePath);
  
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
    console.log(`⚡ Redirecting to ${basename}/login as default route`);
    return `${basename}/login`;
  }
  
  // No correction needed
  console.log('✅ No route correction needed for:', currentPath);
  return null;
}
