
/**
 * Utility function to check if a URL is external
 */
export const isExternalLink = (url: string): boolean => {
  // Check if the URL is absolute (starts with http:// or https://)
  if (!url) return false;
  return /^(https?:)?\/\//.test(url);
};

/**
 * Safely open an external link
 */
export const openExternalLink = (url: string, target: string = '_blank'): void => {
  if (!url) return;
  
  console.log("Opening external link:", url);
  
  // Use the native window.open method
  const newWindow = window.open(url, target);
  
  // Add a fallback method if window.open fails
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    console.log("Fallback method for opening link");
    // Create and click an anchor element
    const a = document.createElement('a');
    a.href = url;
    a.target = target;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

/**
 * Handle link click with router awareness
 */
export const handleLinkClick = (
  e: React.MouseEvent<HTMLAnchorElement>,
  url: string,
  preventDefaultForExternal: boolean = true
): void => {
  if (isExternalLink(url) && preventDefaultForExternal) {
    e.preventDefault();
    openExternalLink(url);
  }
  // Internal links are handled normally by React Router
};
