
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add comprehensive console logs to help debug routing in preview/production environments
console.log('🚀 Application starting with: ', {
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

try {
  const rootElement = document.getElementById("root");
  console.log('📁 Root element found:', !!rootElement);
  
  if (rootElement) {
    const root = createRoot(rootElement);
    console.log('🌱 React root created successfully');
    
    // Wrap the rendering in a try-catch to catch any errors
    try {
      root.render(<App />);
      console.log('✅ React application rendered successfully');
    } catch (renderError) {
      console.error('❌ Error rendering React application:', renderError);
    }
  } else {
    console.error('❌ Could not find root element with id "root"');
  }
} catch (error) {
  console.error('❌ Critical error during application initialization:', error);
}
