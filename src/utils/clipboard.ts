/**
 * Universal clipboard utility with fallback support for non-HTTPS / restricted contexts.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  // Primary method: modern Navigator Clipboard API (works in secure contexts HTTPS/localhost)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
  }

  // Fallback method: hidden textarea + document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Position fixed offscreen so it doesn't cause page scroll
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('Fallback execCommand copy failed:', fallbackErr);
    return false;
  }
};
