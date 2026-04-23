// Nexus Social — Auth
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm') || document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.auth-submit');
    const errEl = document.getElementById('authError');
    btn.disabled = true;
    btn.textContent = 'Please wait…';
    errEl.style.display = 'none';

    // Collect fields individually to guarantee email + password are present
    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const password = form.querySelector('[name="password"]').value;

    const data = { email, password };

    if (mode === 'register') {
      const fullNameEl = form.querySelector('[name="full_name"]');
      const usernameEl = form.querySelector('[name="username"]');
      const ageEl = form.querySelector('[name="age"]');
      const genderEl = form.querySelector('[name="gender"]');
      const pronounsEl = form.querySelector('[name="pronouns"]');
      const sexualityEl = form.querySelector('[name="sexuality"]');
      const countryEl = form.querySelector('[name="country"]');

      if (fullNameEl) data.full_name = fullNameEl.value.trim();
      if (usernameEl) data.username = usernameEl.value.trim().toLowerCase().replace('@','');
      if (ageEl) data.age = ageEl.value.trim();
      if (genderEl) data.gender = genderEl.value;
      if (pronounsEl) data.pronouns = pronounsEl.value;
      if (sexualityEl) data.sexuality = sexualityEl.value;
      if (countryEl) data.country = countryEl.value;
    }

    try {
      const r = await fetch(mode === 'register' ? '/register' : '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || 'Something went wrong');

      if (mode === 'register') {
        form.innerHTML = `
          <div style="text-align:center;padding:20px 0;">
            <div style="font-size:40px;margin-bottom:16px;">✉️</div>
            <div style="font-family:'Syne';font-weight:700;font-size:18px;margin-bottom:8px;">Check your email!</div>
            <div style="color:var(--text2);font-size:13px;line-height:1.6;">${json.message}</div>
            <a href="/login" style="display:inline-block;margin-top:20px;" class="btn-primary-nav">Sign In</a>
          </div>
        `;
      } else {
        window.location.href = '/feed';
      }
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = mode === 'register' ? 'Create Account → Get my Nexus ID' : 'Sign In ✦';
    }
  });
});
