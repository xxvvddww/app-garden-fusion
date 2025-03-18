
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">Oops! Page not found</p>
        <div className="flex justify-center gap-4">
          <Button asChild variant="default">
            <Link to="/">Return to Home</Link>
          </Button>
          <Button 
            asChild 
            variant="outline" 
            onClick={(e) => {
              // Ensure external links open properly
              e.preventDefault();
              window.location.href = "https://www.example.com";
            }}
          >
            <a 
              href="https://www.example.com" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Visit External Site
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
