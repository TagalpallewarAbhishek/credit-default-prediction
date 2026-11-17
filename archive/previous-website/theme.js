const storedTheme = (() => {
  try { return localStorage.getItem('credit-default-theme'); }
  catch { return null; }
})();
const initialTheme = storedTheme === 'light' || storedTheme === 'dark'
  ? storedTheme
  : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = initialTheme;

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.theme-toggle');
  const showTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    buttons.forEach((button) => {
      button.textContent = dark ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.setAttribute('aria-pressed', String(dark));
    });
  };

  buttons.forEach((button) => button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('credit-default-theme', next); } catch { /* Theme still works for this page. */ }
    showTheme();
  }));
  showTheme();
});
