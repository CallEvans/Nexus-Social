// subtle parallax on hero
document.addEventListener('mousemove', (e) => {
  const glow = document.querySelector('.hero-glow');
  if (!glow) return;
  const x = (e.clientX / window.innerWidth - 0.5) * 30;
  const y = (e.clientY / window.innerHeight - 0.5) * 20;
  glow.style.transform = `translateX(calc(-50% + ${x}px)) translateY(${y}px)`;
});
