
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
    // Extract the first segment of the URL path (e.g., 'app-garden-fusion' from '/app-garden-fusion/...')
    const pathSegments = window.location.pathname.split('/').filter(Boolean);
    console.log('📊 Path segments:', pathSegments);
    
    if (pathSegments.length > 0) {
      const basename = `/${pathSegments[0]}`;
      console.log(`✅ Using basename: ${basename} for Lovable environment`);
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
  
  if (isLovableEnvironment()) {
    const projectSegment = window.location.pathname.split('/')[1] || '';
    if (projectSegment) {
      return `${baseUrl}/${projectSegment}${path.startsWith('/') ? path : `/${path}`}`;
    }
  }
  
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
