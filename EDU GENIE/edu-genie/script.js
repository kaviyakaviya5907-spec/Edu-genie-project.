const levelSelect = document.querySelector('#level');
const questionInput = document.querySelector('#question');
const askButton = document.querySelector('#goBtn');
const output = document.querySelector('#output');
const formStatus = document.querySelector('#form-status');
const answerBadge = document.querySelector('#answer-badge');
const charCount = document.querySelector('#char-count');
const modeButtons = [...document.querySelectorAll('.mode')];
let selectedMode = 'Explain';

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedMode = button.dataset.mode;
    modeButtons.forEach((modeButton) => {
      const isSelected = modeButton === button;
      modeButton.classList.toggle('active', isSelected);
      modeButton.setAttribute('aria-pressed', String(isSelected));
    });
  });
});

questionInput.addEventListener('input', () => {
  charCount.textContent = `${questionInput.value.length} / 4000`;
  formStatus.textContent = '';
});

questionInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') askQuestion();
});
askButton.addEventListener('click', askQuestion);

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) {
    formStatus.textContent = 'Add a topic or question to get started.';
    questionInput.focus();
    return;
  }

  formStatus.textContent = '';
  askButton.disabled = true;
  askButton.querySelector('span').textContent = 'Thinking…';
  answerBadge.textContent = 'THINKING';
  answerBadge.className = 'answer-badge loading';
  output.replaceChildren();
  const loadingText = document.createElement('p');
  loadingText.className = 'response-text';
  loadingText.textContent = 'Putting a clear answer together…';
  output.append(loadingText);

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: levelSelect.value, mode: selectedMode, question })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    const answer = document.createElement('div');
    answer.className = 'response-text';
    answer.textContent = data.answer;
    output.replaceChildren(answer);
    answerBadge.textContent = selectedMode.toUpperCase();
    answerBadge.className = 'answer-badge done';
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'response-text';
    message.textContent = error.message || 'Something went wrong. Please try again.';
    output.replaceChildren(message);
    answerBadge.textContent = 'NOT READY';
    answerBadge.className = 'answer-badge';
  } finally {
    askButton.disabled = false;
    askButton.querySelector('span').textContent = 'Ask Edu Gemini';
  }
}
