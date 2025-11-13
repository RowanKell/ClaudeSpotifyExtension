// Get the redirect URI using the same method as background.js
const redirectURI = browser.identity.getRedirectURL();

// Display it
document.getElementById('redirect-uri').textContent = redirectURI;

// Also log it to console
console.log('Redirect URI:', redirectURI);

// Copy to clipboard function
function copyToClipboard() {
  navigator.clipboard.writeText(redirectURI).then(() => {
    const button = document.querySelector('button');
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    button.style.background = '#4CAF50';

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#1DB954';
    }, 2000);
  }).catch(err => {
    alert('Could not copy to clipboard. Please select and copy manually.');
    console.error('Copy failed:', err);
  });
}
