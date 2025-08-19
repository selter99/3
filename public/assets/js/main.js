
document.querySelectorAll('[data-active]').forEach(a=>{
  const path = location.pathname.split('/').pop() || 'index.html';
  if(a.getAttribute('href').includes(path)) a.classList.add('active');
});
