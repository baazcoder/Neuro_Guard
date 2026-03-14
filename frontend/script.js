// ---- History Panel ----
function toggleHistory() {
    const panel = document.getElementById('historyPanel');
    const overlay = document.getElementById('historyOverlay');
    const isOpen = panel.classList.contains('open');

    if (isOpen) {
        panel.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        panel.classList.add('open');
        overlay.classList.add('active');
        loadHistory();
    }
}

async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="history-loading"><i class="ph ph-circle-notch loading-spin"></i>Loading...</div>';

    try {
        const res = await fetch('/entries');
        const entries = await res.json();

        if (!entries || entries.length === 0) {
            list.innerHTML = '<div class="history-empty"><i class="ph ph-tray"></i>No analyses yet. Submit your first one!</div>';
            return;
        }

        list.innerHTML = '';
        entries.forEach(e => {
            const card = document.createElement('div');
            card.className = 'history-card';

            const dt = e.timestamp ? new Date(e.timestamp) : null;
            const timeStr = dt ? dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const excerpt = (e.text || '').length > 80 ? e.text.slice(0, 80) + '...' : e.text;
            const confPct = ((e.confidence || 0) * 100).toFixed(1);

            let badgeClass = '';
            if (e.emergency_trigger) badgeClass = 'danger';
            else if (e.predicted_class === 'Normal') badgeClass = 'success';

            card.innerHTML = `
                <div class="history-card-top">
                    <span class="history-badge ${badgeClass}">${e.predicted_class || 'Unknown'}</span>
                    <span class="history-timestamp">${timeStr}</span>
                </div>
                <p class="history-excerpt">${excerpt || '<em>No text</em>'}</p>
                <p class="history-conf">Confidence: ${confPct}%</p>
            `;

            // Click to pre-fill textarea
            card.onclick = () => {
                document.getElementById('userInput').value = e.text || '';
                toggleHistory();
            };

            list.appendChild(card);
        });

    } catch (err) {
        console.error('History load error:', err);
        list.innerHTML = '<div class="history-empty"><i class="ph ph-warning"></i>Could not load history.</div>';
    }
}

// ---- Analyze Mood ----
async function analyzeMood() {
    const textInput = document.getElementById('userInput');
    const text = textInput.value.trim();

    if (!text) {
        textInput.focus();
        textInput.style.transition = 'transform 0.1s';
        ['10px', '-10px', '10px', '0'].forEach((v, i) => {
            setTimeout(() => textInput.style.transform = `translateX(${v})`, i * 60);
        });
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnIcon = btn.querySelector('i');
    const spinner = document.getElementById('btnSpinner');
    const resultArea = document.getElementById('resultArea');
    const errorAlert = document.getElementById('errorAlert');
    const resultContent = document.querySelector('.result-content');
    const emergencyAlert = document.getElementById('emergencyAlert');
    const topSection = document.getElementById('topPredictionsSection');
    const topList = document.getElementById('topPredictionsList');
    const wellnessCard = document.getElementById('wellnessTipCard');
    const wellnessText = document.getElementById('wellnessTipText');

    // Loading state
    btn.disabled = true;
    btnText.style.display = 'none';
    if (btnIcon) btnIcon.style.display = 'none';
    spinner.style.display = 'block';

    // Hide all result sections
    resultArea.style.display = 'none';
    errorAlert.style.display = 'none';
    resultContent.style.display = 'none';
    emergencyAlert.style.display = 'none';
    topSection.style.display = 'none';
    wellnessCard.style.display = 'none';
    topList.innerHTML = '';

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const data = await response.json();
        console.log('Analysis:', data);

        const confPercent = ((data.confidence || 0) * 100).toFixed(1);
        document.getElementById('predictionText').innerText = data.predicted_class || 'Unknown';
        document.getElementById('confidenceText').innerText = confPercent + '%';

        const predictionText = document.getElementById('predictionText');
        const statusIcon = document.getElementById('statusIcon');
        const progressFill = document.getElementById('confidenceFill');

        // Reset
        predictionText.style.color = 'var(--text-main)';
        statusIcon.style.color = 'var(--text-main)';
        progressFill.style.background = 'linear-gradient(90deg, var(--primary), #c4b5fd)';
        statusIcon.className = 'ph ph-brain';

        if (data.emergency_trigger) {
            predictionText.style.color = 'var(--danger)';
            statusIcon.style.color = 'var(--danger)';
            statusIcon.className = 'ph ph-warning-circle';
            progressFill.style.background = 'linear-gradient(90deg, var(--danger), #fca5a5)';
            emergencyAlert.style.display = 'flex';
        } else if (data.predicted_class === 'Normal') {
            predictionText.style.color = 'var(--success)';
            statusIcon.style.color = 'var(--success)';
            statusIcon.className = 'ph ph-check-circle';
            progressFill.style.background = 'linear-gradient(90deg, var(--success), #6ee7b7)';
        } else {
            statusIcon.className = 'ph ph-activity';
        }

        // Show results
        resultArea.style.display = 'block';
        resultContent.style.display = 'block';
        progressFill.style.width = '0%';
        setTimeout(() => { progressFill.style.width = confPercent + '%'; }, 50);

        // Top 3
        const tops = data.top_predictions || [];
        if (tops.length > 0) {
            topSection.style.display = 'block';
            tops.forEach((pred, i) => {
                const pct = (pred.confidence * 100).toFixed(1);
                const row = document.createElement('div');
                row.className = `prediction-row rank-${i + 1}`;
                row.innerHTML = `
                    <span class="prediction-rank">#${i + 1}</span>
                    <span class="prediction-row-label">${pred.label}</span>
                    <div class="prediction-row-bar-wrap">
                        <div class="prediction-row-bar" data-pct="${pct}"></div>
                    </div>
                    <span class="prediction-row-pct">${pct}%</span>
                `;
                topList.appendChild(row);
            });
            setTimeout(() => {
                topList.querySelectorAll('.prediction-row-bar').forEach(b => {
                    b.style.width = b.dataset.pct + '%';
                });
            }, 100);
        }

        // Wellness Tip
        if (data.wellness_tip) {
            wellnessText.innerText = data.wellness_tip;
            wellnessCard.style.display = 'block';
        }

    } catch (error) {
        console.error('Fetch Error:', error);
        resultArea.style.display = 'block';
        errorAlert.style.display = 'flex';
    } finally {
        btn.disabled = false;
        btnText.style.display = 'block';
        if (btnIcon) btnIcon.style.display = 'inline-block';
        spinner.style.display = 'none';
    }
}