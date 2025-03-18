
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Record application start time for performance tracking
const startTime = performance.now();
const loadTimestamp = new Date().toISOString();

// Add comprehensive console logs to help debug routing in preview/production environments
console.log('🚀 Application initializing at', loadTimestamp, 'with: ', {
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  href: window.location.href,
  origin: window.location.origin,
  search: window.location.search,
  hash: window.location.hash,
  protocol: window.location.protocol,
  userAgent: navigator.userAgent
});

// Log that React is about to render
console.log('🏗️ Attempting to render React application...');

// Setup global error handling
window.addEventListener('error', (event) => {
  console.error('🔥 Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString()
  });
});

// Setup unhandled promise rejection handling
window.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 Unhandled Promise rejection:', {
    reason: event.reason,
    timestamp: new Date().toISOString()
  });
});

try {
  const rootElement = document.getElementById("root");
  console.log('📁 Root element found:', !!rootElement);
  
  if (rootElement) {
    const root = createRoot(rootElement);
    console.log('🌱 React root created successfully');
    
    // Wrap the rendering in a try-catch to catch any errors
    try {
      root.render(<App />);
      const renderTime = performance.now() - startTime;
      console.log(`✅ React application rendered successfully in ${renderTime.toFixed(2)}ms`);
    } catch (renderError) {
      console.error('❌ Error rendering React application:', renderError);
    }
  } else {
    console.error('❌ Could not find root element with id "root"');
    
    // Try to create a root element if it doesn't exist
    const bodyElement = document.body;
    if (bodyElement) {
      console.log('🔄 Attempting to create root element dynamically...');
      const newRootElement = document.createElement('div');
      newRootElement.id = 'root';
      bodyElement.appendChild(newRootElement);
      
      try {
        const root = createRoot(newRootElement);
        root.render(<App />);
        console.log('✅ React application rendered in dynamically created root');
      } catch (fallbackRenderError) {
        console.error('❌ Error rendering React in fallback root:', fallbackRenderError);
      }
    }
  }
} catch (error) {
  console.error('❌ Critical error during application initialization:', error);
  
  // Display a simple error message for the user
  const bodyElement = document.body;
  if (bodyElement) {
    bodyElement.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: white; padding: 20px; font-family: system-ui, sans-serif;">
        <div style="max-width: 500px; text-align: center; background: #1e293b; padding: 20px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <h1 style="margin-bottom: 16px; font-size: 24px;">Unable to load application</h1>
          <p style="margin-bottom: 20px; color: #cbd5e1;">We're having trouble loading the application. Please try refreshing the page.</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}
