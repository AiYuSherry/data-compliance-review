import { createReviewJob, listJobs } from '../storage/jobs';

type PendingSource =
  | { kind: 'text'; fileName: string; text: string }
  | { kind: 'binary'; fileName: string; mimeType: string; bytes: ArrayBuffer }
  | null;

const documentNameInput = document.querySelector<HTMLInputElement>('#documentName')!;
const textInput = document.querySelector<HTMLTextAreaElement>('#textInput')!;
const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;
const pickFileButton = document.querySelector<HTMLButtonElement>('#pickFileButton')!;
const currentPageButton = document.querySelector<HTMLButtonElement>('#currentPageButton')!;
const startButton = document.querySelector<HTMLButtonElement>('#startReviewButton')!;
const statusBox = document.querySelector<HTMLDivElement>('#statusBox')!;
const recentJobs = document.querySelector<HTMLDivElement>('#recentJobs')!;
const settingsButton = document.querySelector<HTMLButtonElement>('#openSettingsButton')!;

let pendingSource: PendingSource = null;

function setStatus(message: string, tone: 'info' | 'error' = 'info') {
  statusBox.textContent = message;
  statusBox.dataset.tone = tone;
}

async function refreshJobs() {
  const jobs = await listJobs(8);
  if (!jobs.length) {
    recentJobs.innerHTML = '<p class="empty-state">还没有审查记录。</p>';
    return;
  }
  recentJobs.innerHTML = jobs
    .map(
      (job) => `
        <button class="job-card" data-job-id="${job.id}">
          <div class="job-card-head">
            <span class="job-status status-${job.status}">${job.status}</span>
            <span class="job-time">${new Date(job.updatedAt).toLocaleString()}</span>
          </div>
          <p class="job-title">${job.documentName}</p>
          <p class="job-message">${job.progress.message}</p>
        </button>
      `
    )
    .join('');

  recentJobs.querySelectorAll<HTMLButtonElement>('[data-job-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({
        type: 'openResultPage',
        jobId: button.dataset.jobId
      });
    });
  });
}

async function selectFile(file: File) {
  const bytes = await file.arrayBuffer();
  pendingSource = {
    kind: 'binary',
    fileName: file.name,
    mimeType: file.type || inferMimeType(file.name),
    bytes
  };
  if (!documentNameInput.value.trim()) {
    documentNameInput.value = file.name.replace(/\.[^.]+$/, '');
  }
  setStatus(`已选择文件：${file.name}`);
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.md')) return 'text/markdown';
  return 'text/plain';
}

pickFileButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  textInput.value = '';
  await selectFile(file);
});

currentPageButton.addEventListener('click', async () => {
  setStatus('正在读取当前页 PDF...');
  const response = await chrome.runtime.sendMessage({ type: 'readCurrentTabPdf' });
  if (!response?.ok) {
    setStatus(response?.error || '当前页面无法读取 PDF', 'error');
    return;
  }

  const bytes = new Uint8Array(response.payload.bytes).buffer;
  pendingSource = {
    kind: 'binary',
    fileName: response.payload.fileName,
    mimeType: response.payload.mimeType,
    bytes
  };
  if (!documentNameInput.value.trim()) {
    documentNameInput.value = response.payload.fileName.replace(/\.[^.]+$/, '');
  }
  textInput.value = '';
  setStatus(`已读取当前页 PDF：${response.payload.fileName}`);
});

settingsButton.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'openOptionsPage' });
});

startButton.addEventListener('click', async () => {
  const documentName = documentNameInput.value.trim();
  if (!documentName) {
    setStatus('请输入文档名称', 'error');
    return;
  }

  let source = pendingSource;
  const text = textInput.value.trim();
  if (!source && text) {
    source = {
      kind: 'text',
      fileName: `${documentName}.txt`,
      text
    };
  }

  if (!source) {
    setStatus('请上传文件、粘贴文本，或读取当前页 PDF', 'error');
    return;
  }

  const job = await createReviewJob({ documentName, source });
  setStatus('已创建任务，正在打开结果页...');
  await chrome.runtime.sendMessage({ type: 'openResultPage', jobId: job.id });
  await refreshJobs();
});

refreshJobs().catch((error) => setStatus(String(error), 'error'));
