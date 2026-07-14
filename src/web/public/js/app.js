function updatePreview() {
  const textarea = document.getElementById('content');
  const preview = document.getElementById('preview');
  if (textarea && preview) {
    preview.innerHTML = marked.parse(textarea.value || '');
  }
}

function insertMd(before, after) {
  const textarea = document.getElementById('content');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const newText = before + selected + after;
  textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  updatePreview();
}

async function uploadImage(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) { alert('上传失败'); return; }
    const data = await res.json();
    const textarea = document.getElementById('content');
    if (textarea) {
      const md = `![${file.name}](${data.url})\n`;
      const pos = textarea.selectionStart;
      textarea.value = textarea.value.substring(0, pos) + md + textarea.value.substring(pos);
      updatePreview();
    }
  } catch (e) {
    alert('上传失败: ' + e.message);
  }
  input.value = '';
}

window.updatePreview = updatePreview;
window.insertMd = insertMd;
window.uploadImage = uploadImage;

document.addEventListener('DOMContentLoaded', function() {
  document.body.addEventListener('htmx:afterRequest', function(evt) {
    const target = evt.detail.target;
    if (target && target.id === 'comment-list' && evt.detail.successful) {
      const form = document.querySelector('.comment-form');
      if (form) form.reset();
    }
  });

  document.querySelectorAll('.reply-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const commentId = this.dataset.commentId;
      const form = document.querySelector('.comment-form');
      const parentIdInput = form.querySelector('input[name="parent_id"]');
      if (parentIdInput) parentIdInput.value = commentId;
      form.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
