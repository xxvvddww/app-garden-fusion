
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "🔍 404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    
    // Log additional information about the current environment
    console.log('📌 NotFound component loaded with:', {
      currentLocation: location,
      windowLocation: window.location,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
  }, [location.pathname]);

  // Determine if we're in a preview environment
  const isPreviewEnvironment = window.location.hostname.includes('lovable.app') || 
    window.location.hostname.includes('lovableproject.com');
  
  // Create appropriate home path based on environment
  const homePath = isPreviewEnvironment 
    ? `/${window.location.pathname.split('/')[1] || ''}`
    : '/';
  
  console.log(`🏠 Using home path: ${homePath} in NotFound component`);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">Oops! Page not found</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button asChild variant="default">
            <Link to={homePath}>Return to Home</Link>
          </Button>
          
          {/* Debug information in dev mode */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 text-left text-xs rounded">
              <p>Debug info:</p>
              <p>Current path: {location.pathname}</p>
              <p>Home path: {homePath}</p>
              <p>Hostname: {window.location.hostname}</p>
              <p>Preview mode: {isPreviewEnvironment ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
