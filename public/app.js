const state = { user: null, posts: [], view: 'discover', category: 'All', query: '', authMode: 'login' };
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const formatDate = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value.replace(' ', 'T')}Z`));

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialogs() { $$('dialog[open]').forEach(d => d.close()); }

function updateAuthUI() {
  $$('.auth-only').forEach(el => el.classList.toggle('hidden', !state.user));
  $$('.guest-only').forEach(el => el.classList.toggle('hidden', !!state.user));
  if (state.user) {
    $('#profile-name').textContent = state.user.name; $('#profile-email').textContent = state.user.email;
    $('#profile-button').textContent = state.user.name.slice(0, 1).toUpperCase();
  }
}

async function loadPosts() {
  const params = new URLSearchParams();
  if (state.view === 'mine') params.set('mine', '1');
  if (state.query) params.set('q', state.query);
  if (state.category !== 'All') params.set('category', state.category);
  const data = await api(`/api/posts?${params}`); state.posts = data.posts; renderPosts();
}

function renderFilters() {
  const categories = ['All', 'Creativity', 'Design', 'Technology', 'Life', 'Culture'];
  $('#filters').innerHTML = categories.map(c => `<button class="filter ${state.category === c ? 'active' : ''}" data-category="${c}">${c}</button>`).join('');
}

function renderPosts() {
  renderFilters(); $('#empty').classList.toggle('hidden', state.posts.length > 0);
  $('#post-grid').innerHTML = state.posts.map(post => `<article class="post-card" data-id="${post.id}">
    <div class="card-art">${escapeHtml(post.category.slice(0,1))}${post.status === 'draft' ? '<span class="card-status">Draft</span>' : ''}</div>
    <div class="card-body"><span class="category">${escapeHtml(post.category)}</span><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p>
    <div class="card-meta"><span>By ${escapeHtml(post.author)}</span><span>${formatDate(post.created_at)} · ${post.comment_count} comments</span></div>
    ${state.view === 'mine' ? `<div class="card-actions"><button data-edit="${post.id}">Edit</button><button data-delete="${post.id}">Delete</button></div>` : ''}</div></article>`).join('');
}

function showAuth(mode = 'login') {
  state.authMode = mode; const register = mode === 'register';
  $('#auth-kicker').textContent = register ? 'JOIN THE COMMUNITY' : 'WELCOME BACK';
  $('#auth-title').textContent = register ? 'Create your account' : 'Log in to Inkspire';
  $('#auth-subtitle').textContent = register ? 'A world of ideas is waiting.' : 'Continue the conversation.';
  $('.register-field').classList.toggle('hidden', !register);
  $('[name=name]').required = register; $('[name=password]').autocomplete = register ? 'new-password' : 'current-password';
  $('#auth-form button[type=submit]').textContent = register ? 'Create account' : 'Log in';
  $('.switch-auth').childNodes[0].textContent = register ? 'Already a member? ' : 'New here? ';
  $('#switch-auth').textContent = register ? 'Log in' : 'Create an account'; $('#auth-error').textContent = '';
  openDialog($('#auth-dialog'));
}

function openEditor(post) {
  if (!state.user) return showAuth('register');
  const form = $('#editor-form'); form.reset(); $('#editor-error').textContent = '';
  $('#editor-title').textContent = post ? 'Edit your story' : 'Write something memorable';
  if (post) ['id','title','excerpt','category','content'].forEach(k => form.elements[k].value = post[k] || '');
  openDialog($('#editor-dialog'));
}

async function showStory(id) {
  try {
    const { post } = await api(`/api/posts/${id}`); const mine = state.user?.id === post.user_id;
    $('#story-content').innerHTML = `<header class="story-head"><span class="category">${escapeHtml(post.category)}</span><h1>${escapeHtml(post.title)}</h1><p class="story-meta">By ${escapeHtml(post.author)} · ${formatDate(post.created_at)}${post.status === 'draft' ? ' · Draft' : ''}</p></header>
      ${mine ? `<div class="story-owner-actions"><button class="button ghost" data-story-edit="${post.id}">Edit story</button><button class="button ghost" data-story-delete="${post.id}">Delete</button></div>` : ''}
      <div class="story-body">${escapeHtml(post.content)}</div>
      <section class="comments"><h2>Conversation <small>(${post.comments.length})</small></h2>
      ${post.status === 'draft' ? '<p class="login-prompt">Publish this draft to enable comments.</p>' : state.user ? `<form class="comment-form" data-post="${post.id}"><textarea name="content" rows="3" maxlength="1000" placeholder="Add to the conversation…" required></textarea><button class="button coral">Post comment</button></form>` : '<p class="login-prompt"><button data-login>Log in</button> to join the conversation.</p>'}
      <div>${post.comments.map(c => `<div class="comment"><div class="comment-head"><strong>${escapeHtml(c.author)}</strong><span>${formatDate(c.created_at)}</span></div><p>${escapeHtml(c.content)}</p>${state.user?.id === c.user_id ? `<button class="delete-comment" data-comment-delete="${c.id}" data-post="${post.id}">Delete</button>` : ''}</div>`).join('')}</div></section>`;
    $('#story-dialog').dataset.postId = id; openDialog($('#story-dialog'));
  } catch (error) { toast(error.message); }
}

async function deletePost(id) {
  if (!confirm('Delete this story and all of its comments? This cannot be undone.')) return;
  try { await api(`/api/posts/${id}`, { method: 'DELETE' }); closeDialogs(); toast('Story deleted.'); await loadPosts(); } catch (error) { toast(error.message); }
}

document.addEventListener('click', async e => {
  const close = e.target.closest('[data-close]'); if (close) close.closest('dialog').close();
  const auth = e.target.closest('[data-auth]'); if (auth) showAuth(auth.dataset.auth);
  if (e.target.closest('#switch-auth')) { $('#auth-dialog').close(); showAuth(state.authMode === 'login' ? 'register' : 'login'); }
  if (e.target.closest('#start-writing') || e.target.closest('#new-post')) openEditor();
  const nav = e.target.closest('[data-view]'); if (nav) { state.view = nav.dataset.view; state.category = 'All'; $$('.nav-link').forEach(n => n.classList.toggle('active', n === nav)); $('#section-kicker').textContent = state.view === 'mine' ? 'YOUR LIBRARY' : 'EXPLORE STORIES'; $('#section-title').textContent = state.view === 'mine' ? 'Your stories' : 'Fresh perspectives'; await loadPosts(); }
  const filter = e.target.closest('[data-category]'); if (filter) { state.category = filter.dataset.category; await loadPosts(); }
  const card = e.target.closest('.post-card'); if (card && !e.target.closest('button')) showStory(card.dataset.id);
  const edit = e.target.closest('[data-edit]'); if (edit) { const { post } = await api(`/api/posts/${edit.dataset.edit}`); openEditor(post); }
  const del = e.target.closest('[data-delete]'); if (del) deletePost(del.dataset.delete);
  const storyEdit = e.target.closest('[data-story-edit]'); if (storyEdit) { const { post } = await api(`/api/posts/${storyEdit.dataset.storyEdit}`); $('#story-dialog').close(); openEditor(post); }
  const storyDelete = e.target.closest('[data-story-delete]'); if (storyDelete) deletePost(storyDelete.dataset.storyDelete);
  if (e.target.closest('[data-login]')) { $('#story-dialog').close(); showAuth('login'); }
  const commentDelete = e.target.closest('[data-comment-delete]'); if (commentDelete && confirm('Delete your comment?')) { await api(`/api/comments/${commentDelete.dataset.commentDelete}`, { method: 'DELETE' }); await showStory(commentDelete.dataset.post); toast('Comment deleted.'); }
  if (e.target.closest('#profile-button')) $('#profile-menu').classList.toggle('hidden');
  if (e.target.closest('#logout')) { await api('/api/auth/logout', { method: 'POST' }); state.user = null; state.view = 'discover'; updateAuthUI(); $('#profile-menu').classList.add('hidden'); toast('You are logged out.'); await loadPosts(); }
});

$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = new FormData(e.currentTarget); const payload = Object.fromEntries(form);
  try { const data = await api(`/api/auth/${state.authMode}`, { method: 'POST', body: JSON.stringify(payload) }); state.user = data.user; updateAuthUI(); $('#auth-dialog').close(); e.currentTarget.reset(); toast(state.authMode === 'register' ? 'Welcome to Inkspire!' : 'Welcome back!'); await loadPosts(); } catch (error) { $('#auth-error').textContent = error.message; }
});

$('#editor-form').addEventListener('submit', async e => {
  e.preventDefault(); const submitter = e.submitter; const form = new FormData(e.currentTarget); const id = form.get('id'); const payload = Object.fromEntries(form); payload.status = submitter.dataset.status;
  try { await api(id ? `/api/posts/${id}` : '/api/posts', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }); $('#editor-dialog').close(); toast(payload.status === 'draft' ? 'Draft saved.' : 'Story published!'); await loadPosts(); } catch (error) { $('#editor-error').textContent = error.message; }
});

$('#story-content').addEventListener('submit', async e => {
  if (!e.target.matches('.comment-form')) return; e.preventDefault(); const content = new FormData(e.target).get('content');
  try { await api(`/api/posts/${e.target.dataset.post}/comments`, { method: 'POST', body: JSON.stringify({ content }) }); await showStory(e.target.dataset.post); toast('Comment posted.'); } catch (error) { toast(error.message); }
});

let searchTimer; $('#search').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = e.target.value.trim(); loadPosts(); }, 300); });
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

(async function init() { try { state.user = (await api('/api/auth/me')).user; updateAuthUI(); await loadPosts(); } catch (error) { toast(error.message); } })();
