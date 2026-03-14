// ---- Counselor Database ----
const counselorDatabase = [
    {
        id: 1,
        name: 'Dr. Priya Sharma',
        specialization: 'Depression & Anxiety',
        phone: '9876543210',
        distance: 2.3,
        area: 'Jalandhar (LPU Campus)',
        availability: 'Available Now'
    },
    {
        id: 2,
        name: 'Ms. Anjali Patel',
        specialization: 'Stress Management',
        phone: '9876543211',
        distance: 3.5,
        area: 'Jalandhar City',
        availability: 'Available in 30 min'
    },
    {
        id: 3,
        name: 'Dr. Rajesh Kumar',
        specialization: 'Crisis Counseling',
        phone: '9876543212',
        distance: 1.8,
        area: 'LPU Medical Center',
        availability: 'Available Now'
    },
    {
        id: 4,
        name: 'Ms. Deepa Singh',
        specialization: 'Mental Health Support',
        phone: '9876543213',
        distance: 4.2,
        area: 'Civil Hospital, Jalandhar',
        availability: 'Available in 45 min'
    },
    {
        id: 5,
        name: 'Dr. Vikram Mehta',
        specialization: 'Suicidal Ideation',
        phone: '9876543214',
        distance: 2.0,
        area: 'Sterling Hospital, Jalandhar',
        availability: 'Available Now'
    }
];

// ---- LPU Helpline Modal ----
function showLpuHelpline() {
    const modal = document.getElementById('helplineModal');
    modal.classList.add('show');
    loadNearbyCounselors();
}

function closeLpuHelpline() {
    const modal = document.getElementById('helplineModal');
    modal.classList.remove('show');
}

function loadNearbyCounselors() {
    const counselorsList = document.getElementById('counselorsList');
    
    // Sort counselors by distance and show top 5
    const nearbyCounselors = counselorDatabase.sort((a, b) => a.distance - b.distance).slice(0, 5);
    
    if (nearbyCounselors.length === 0) {
        counselorsList.innerHTML = '<div class="no-counselors">No counselors available at the moment.</div>';
        return;
    }
    
    counselorsList.innerHTML = '';
    nearbyCounselors.forEach(counselor => {
        const card = document.createElement('div');
        card.className = 'counselor-card';
        card.innerHTML = `
            <div class="counselor-name">${counselor.name}</div>
            <div class="counselor-info">
                <i class="ph ph-map-pin"></i>
                <span>${counselor.area} • ${counselor.distance} km</span>
            </div>
            <div class="counselor-info">
                <i class="ph ph-briefcase"></i>
                <span>${counselor.specialization}</span>
            </div>
            <div class="counselor-info" style="color: var(--success);">
                <i class="ph ph-check-circle"></i>
                <span>${counselor.availability}</span>
            </div>
            <div class="counselor-phone">
                <span>${counselor.phone}</span>
                <button class="counselor-phone-btn" onclick="callCounselor('${counselor.phone}', '${counselor.name}')" title="Call">
                    <i class="ph ph-phone"></i>
                </button>
            </div>
        `;
        counselorsList.appendChild(card);
    });
}

function callCounselor(phone, name) {
    // Copy phone to clipboard and show feedback
    navigator.clipboard.writeText(phone).then(() => {
        console.log('Copied: ' + phone);
        alert(`Call ${name} at ${phone}`);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function copyNumber(number) {
    navigator.clipboard.writeText(number).then(() => {
        console.log('Copied: ' + number);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// ---- Layout Interactions ----
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

// Reset Chat to initial state
function resetChat() {
    document.getElementById('userInput').value = '';
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('userInput').focus();
    
    // On mobile, auto close sidebar after starting new
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

// Auto-resize textarea
const tx = document.getElementById('userInput');
tx.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Load History on startup
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    // Handle Enter to submit (Shift+Enter for newline)
    tx.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            analyzeMood();
        }
    });
});

async function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="history-loading"><i class="ph ph-circle-notch loading-spin"></i>Loading...</div>';

    try {
        const res = await fetch('/entries');
        const entries = await res.json();

        if (!entries || entries.length === 0) {
            list.innerHTML = '<div class="history-empty">No previous analyses found.</div>';
            return;
        }

        list.innerHTML = '';
        entries.forEach(e => {
            const card = document.createElement('div');
            card.className = 'history-card';

            const dt = e.timestamp ? new Date(e.timestamp) : null;
            const timeStr = dt ? dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const excerpt = (e.text || '').length > 40 ? e.text.slice(0, 40) + '...' : e.text;
            
            let badgeClass = '';
            if (e.emergency_trigger) badgeClass = 'danger';
            else if (e.predicted_class === 'Normal') badgeClass = 'success';

            card.innerHTML = `
                <div class="history-card-top">
                    <span class="history-badge ${badgeClass}">${e.predicted_class || 'Unknown'}</span>
                    <span class="history-timestamp">${timeStr}</span>
                </div>
                <p class="history-excerpt">${excerpt || '<em>No text</em>'}</p>
            `;

            // Click to pre-fill textarea
            card.onclick = () => {
                resetChat();
                document.getElementById('userInput').value = e.text || '';
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
                tx.style.height = 'auto'; // Reset size
            };

            list.appendChild(card);
        });

    } catch (err) {
        console.error('History load error:', err);
        list.innerHTML = '<div class="history-empty">Could not load history.</div>';
    }
}

// ---- Analyze Mood ----
async function analyzeMood() {
    const textInput = document.getElementById('userInput');
    const text = textInput.value.trim();

    if (!text) {
        textInput.focus();
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    const sendIcon = document.getElementById('sendIcon');
    const spinner = document.getElementById('btnSpinner');
    
    // UI Elements
    const welcomeScreen = document.getElementById('welcomeScreen');
    const resultArea = document.getElementById('resultArea');
    const errorAlert = document.getElementById('errorAlert');
    const resultContent = document.querySelector('.result-content');
    const emergencyAlert = document.getElementById('emergencyAlert');
    const topSection = document.getElementById('topPredictionsSection');
    const topList = document.getElementById('topPredictionsList');
    const wellnessCard = document.getElementById('wellnessTipCard');
    const wellnessText = document.getElementById('wellnessTipText');
    const displayUserInput = document.getElementById('displayUserInput');

    // Display user input
    displayUserInput.innerText = text;

    // Loading state
    btn.disabled = true;
    sendIcon.style.display = 'none';
    spinner.style.display = 'block';

    // Transition view
    welcomeScreen.style.display = 'none';
    resultArea.style.display = 'flex';
    
    // Hide all result sub-sections initially
    errorAlert.style.display = 'none';
    resultContent.style.display = 'none';
    emergencyAlert.style.display = 'none';
    topSection.style.display = 'none';
    wellnessCard.style.display = 'none';
    topList.innerHTML = '';

    try {
       const response = await fetch(`${window.location.origin}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
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
        predictionText.style.color = 'var(--text-primary)';
        statusIcon.style.color = 'var(--text-primary)';
        progressFill.style.background = 'var(--text-primary)';
        statusIcon.className = 'ph ph-brain';

        if (data.emergency_trigger) {
            predictionText.style.color = 'var(--danger)';
            statusIcon.style.color = 'var(--danger)';
            statusIcon.className = 'ph ph-warning-circle';
            progressFill.style.background = 'var(--danger)';
            emergencyAlert.style.display = 'flex';
            showLpuHelpline();
        } else if (data.predicted_class === 'Normal') {
            predictionText.style.color = 'var(--success)';
            statusIcon.style.color = 'var(--success)';
            statusIcon.className = 'ph ph-check-circle';
            progressFill.style.background = 'var(--success)';
        } else {
            statusIcon.className = 'ph ph-activity';
        }

        // Show results
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

        // Refresh history to show new entry
        loadHistory();

    } catch (error) {
        console.error('Fetch Error:', error);
        errorAlert.style.display = 'flex';
    } finally {
        btn.disabled = false;
        sendIcon.style.display = 'inline-block';
        spinner.style.display = 'none';
        textInput.value = ''; // clear input after message is sent
        textInput.style.height = 'auto'; // reset height
        
        // Scroll to bottom
        const chatArea = document.querySelector('.chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Close helpline modal when clicking overlay
document.addEventListener('DOMContentLoaded', function() {
    const helplineModal = document.getElementById('helplineModal');
    if (helplineModal) {
        helplineModal.querySelector('.helpline-overlay').onclick = closeLpuHelpline;
    }
});