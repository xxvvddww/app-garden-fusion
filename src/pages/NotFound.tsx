
import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const [appInfo, setAppInfo] = useState({
    currentPath: '',
    hostname: '',
    fullUrl: '',
    isPreview: false,
    basename: '',
    timeLoaded: ''
  });

  useEffect(() => {
    // Log detailed information about the 404 error
    console.error(
      "🚨 404 Error: Page not found for route:",
      location.pathname
    );
    
    // Determine if we're in a preview environment
    const isPreviewEnvironment = window.location.hostname.includes('lovable.app') || 
      window.location.hostname.includes('lovableproject.com');
    
    // Create appropriate home path based on environment
    const basename = isPreviewEnvironment 
      ? `/${window.location.pathname.split('/')[1] || ''}`
      : '/';
    
    // Set detailed diagnostic information
    setAppInfo({
      currentPath: location.pathname,
      hostname: window.location.hostname,
      fullUrl: window.location.href,
      isPreview: isPreviewEnvironment,
      basename: basename,
      timeLoaded: new Date().toISOString()
    });
    
    // Log additional information about the current environment
    console.log('📊 NotFound Diagnostics:', {
      location,
      windowLocation: window.location,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      environmentInfo: {
        isPreview: isPreviewEnvironment,
        basename,
        href: window.location.href,
        origin: window.location.origin,
        hostname: window.location.hostname
      }
    });
  }, [location]);

  const goBack = () => {
    window.history.back();
  };
  
  const goHome = () => {
    // For preview environments, we need to use the full URL to navigate to the root
    if (appInfo.isPreview) {
      const rootUrl = `${window.location.origin}/${window.location.pathname.split('/')[1] || ''}`;
      console.log(`🏠 Navigating to home: ${rootUrl}`);
      window.location.href = rootUrl;
    } else {
      console.log('🏠 Navigating to home: /');
      window.location.href = '/';
    }
  };

  const refreshPage = () => {
    console.log('🔄 Refreshing page...');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-lg shadow-xl p-6">
        <h1 className="text-3xl font-bold mb-4 text-center">Page Not Found</h1>
        <p className="mb-6 text-slate-300">
          The page you're looking for doesn't exist or you don't have permission to view it.
        </p>
        
        <div className="flex flex-col gap-4">
          <Button 
            variant="default" 
            onClick={goHome}
            className="w-full flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
          
          <Button 
            variant="outline" 
            onClick={goBack}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={refreshPage}
            className="w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
        
        {/* Diagnostic information */}
        <div className="mt-8 p-4 bg-slate-800 rounded text-xs text-slate-300 font-mono overflow-auto">
          <h2 className="font-bold mb-2">Diagnostic Information:</h2>
          <pre className="whitespace-pre-wrap break-all">
            {JSON.stringify(appInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
