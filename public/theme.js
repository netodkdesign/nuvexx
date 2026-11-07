// Roda antes de a página aparecer, para quem escolheu o tema claro não ver um clarão escuro.
try {
  if (localStorage.getItem('nuvexx-tema') === 'light') document.documentElement.dataset.theme = 'light';
} catch {
  // Sem acesso ao armazenamento do navegador, fica o tema padrão.
}
