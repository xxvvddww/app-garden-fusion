
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Add console logs to help debug routing in preview/production environments
console.log('Application starting with: ', {
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  href: window.location.href
});

createRoot(document.getElementById("root")!).render(<App />);
